import { games } from "../../games";
import { formatScore } from "../scoring";
import { getNickname } from "../nickname";
import { getSupabase } from "../supabase";
import {
  castVote,
  closeRound,
  fetchRoomState,
  finishRoom,
  finishTimeVote,
  openVote,
  reportScore,
  resetRoom,
  sanitizeCode,
  startRound,
  startTimeVote,
  takeOverHost,
  updateDeadline,
} from "./api";
import { RoomChannel } from "./channel";
import { RoomOverlay, type WaitingEntry } from "./RoomOverlay";
import { computeTotals, rankRound } from "./points";
import {
  formatRoundTimeLimit,
  NO_TIME_LIMIT,
  TIME_VOTE_OPTIONS,
  type RoomState,
} from "./types";

/**
 * Orquestador del modo sala dentro de cada juego. Contrato minimo por juego:
 *
 *   private readonly room = initRoomMode("<id>", { getScore: () => this.score });
 *   // input en estado "dead": if (this.room) return;   // una sola partida
 *   // game over: if (this.room) this.room.reportScore(this.score);
 *   //            else this.hud.showRanking("<id>", this.score);
 *
 * initRoomMode devuelve null sin `?room=` en la URL o sin Supabase, asi que
 * fuera del modo sala el juego no cambia en nada. En modo sala NO se envia el
 * puntaje al ranking global (las partidas cortadas por timeout lo
 * contaminarian).
 */

export interface RoomModeHooks {
  /** Puntaje actual de la partida en curso (para el parcial por timeout). */
  getScore: () => number;
  /**
   * Arranca la partida de la ronda (normalmente `beginCountdown`). El modo sala
   * lo dispara solo al empezar la ronda para que todos inicien juntos, sin que
   * cada jugador tenga que tocar Enter. Si no se pasa, el juego espera el input
   * manual como siempre.
   */
  onStart?: () => void;
}

export interface RoomMode {
  readonly active: true;
  /** Llamar en el game-over, donde fuera del modo sala va hud.showRanking. */
  reportScore(finalScore: number): void;

  // Contexto para juegos de tablero compartido (p.ej. Memoria). Los juegos
  // "cada uno en su pantalla" siguen usando solo reportScore.
  /** Codigo de la sala. */
  readonly code: string;
  /** Nickname propio. */
  readonly me: string;
  /** Numero de ronda que esta pagina esta jugando. */
  round(): number;
  /** Jugadores registrados en la sala (orden por joined_at, deterministico). */
  players(): string[];
  isHost(): boolean;
  /** Avisa al resto que hay cambios en la DB (broadcast "sync"). */
  ping(): void;
  /** Se dispara cuando otro cliente hizo ping (releer la DB). */
  onSync(cb: () => void): void;
  /**
   * Fin de la ronda en curso segun lo que fijo el host (ajuste fijo o votacion
   * de tiempo), o null si la ronda no tiene tope ("Sin límite"). Incluye el
   * margen de navegacion/countdown, asi que al arrancar la partida el tiempo
   * restante ronda el valor nominal elegido por el anfitrion.
   */
  deadline(): Date | null;
}

/** Variante fija que usa cada juego con variantes cuando corre en modo sala. */
export const ROOM_VARIANTS: Record<string, string> = {
  "sliding-puzzle": "3",
  "lights-out": "5",
};

/** Chequeo barato (sin red) de si la pagina corre en modo sala. */
export function isRoomMode(): boolean {
  return readRoomCode() !== null;
}

function readRoomCode(): string | null {
  const raw = new URLSearchParams(window.location.search).get("room");
  return raw ? sanitizeCode(raw) : null;
}

/** URL de un juego dentro de una sala. */
export function roomGameUrl(gameId: string, code: string): string {
  const game = games.find((g) => g.id === gameId);
  return game ? `${game.path}?room=${code}` : "/";
}

/** Un juego al azar (para la primera ronda sin playlist). */
export function randomGameId(): string {
  return games[Math.floor(Math.random() * games.length)].id;
}

/** Candidatos de la votacion de tiempo, como strings de segundos (para vote_options). */
export function timeVoteOptionIds(): string[] {
  return TIME_VOTE_OPTIONS.map(String);
}

/**
 * Margen extra sobre el tope de ronda para cubrir la navegacion entre paginas
 * y el countdown 3/2/1/YA de cada juego.
 */
const NAV_GRACE_SEC = 10;

/** Deadline de una ronda que arranca ahora, o null si no hay tope de tiempo. */
export function computeRoundDeadline(roundTimeLimitSec: number): Date | null {
  if (roundTimeLimitSec === NO_TIME_LIMIT) return null;
  return new Date(Date.now() + (roundTimeLimitSec + NAV_GRACE_SEC) * 1000);
}

const TICK_MS = 500;
const POLL_MS = 5000;
/** Duracion de las votaciones (proximo juego y tope de tiempo). */
export const VOTE_SECONDS = 20;
/**
 * Cuando ya votaron todos los presentes, el host comprime la votacion a este
 * margen final en vez de esperar el tope completo (no tiene sentido dejar 10s
 * si ya voto todo el mundo).
 */
const VOTE_GRACE_MS = 3000;
/** Espera tras el deadline antes de cerrar, para que lleguen los parciales. */
const CLOSE_LAG_MS = 2500;
/** Cierre anticipado: todos los presentes reportaron y hay ausentes. */
const CLOSE_EARLY_GRACE_MS = 15000;
/** Ausencia continua del host antes de ofrecer "tomar el control". */
const HOST_ABSENT_MS = 20000;
/** Pausa en resultados antes de que el host abra la votacion. */
const RESULTS_TO_VOTE_MS = 5000;

export function initRoomMode(gameId: string, hooks: RoomModeHooks): RoomMode | null {
  const code = readRoomCode();
  if (!code || !getSupabase()) return null;

  const me = getNickname();
  if (!me) {
    // Nunca se unio: que pase por el lobby a elegir nombre. Stub inerte
    // mientras navega (la pagina se descarta enseguida).
    window.location.href = `/rooms/?code=${code}`;
    return {
      active: true,
      reportScore: () => {},
      code,
      me: "",
      round: () => 0,
      players: () => [],
      isHost: () => false,
      ping: () => {},
      onSync: () => {},
      deadline: () => null,
    };
  }

  const controller = new RoomModeController(gameId, code, me, hooks);
  void controller.boot();
  return controller;
}

class RoomModeController implements RoomMode {
  readonly active = true as const;

  private readonly overlay = new RoomOverlay();
  private channel: RoomChannel | null = null;
  private state: RoomState | null = null;
  /** Ronda que esta pagina esta jugando (fijada al cargar). */
  private myRound = 0;
  private reported = false;
  /** Reporte en vuelo: evita escrituras duplicadas concurrentes del mismo parcial. */
  private reporting = false;
  /**
   * Espectador: entro con la partida ya empezada, no esta registrado en la sala.
   * No juega ni puntua, solo mira hasta que termine (o vuelva al lobby, donde
   * recien podra sumarse). Se detecta al bootear (no esta en room_players y la
   * sala no esta en el lobby).
   */
  private spectator = false;
  /** El cartel de espectador ya se mostro (para no re-renderizar en cada poll). */
  private spectatorRendered = false;
  /** Fase+ronda cuya votacion ya se comprimio (evita reescribir el deadline). */
  private compressedVoteKey = "";
  /** Ya se disparo el auto-inicio de la partida para esta pagina/ronda. */
  private gameStarted = false;
  private navigating = false;
  private refreshing = false;
  private refreshQueued = false;
  /** Evita disparar dos veces una mutacion de host. */
  private actionInFlight = false;
  private voteScheduledForRound = 0;
  private hostAbsentSince: number | null = null;
  /** Cuando esta pagina vio por primera vez la ronda vigente en "playing"
   * (fallback de inicio de ronda para la gracia sin tope de tiempo). */
  private playingSinceRound = 0;
  private playingSince = 0;
  /** El tablero final ya se mostro en esta pagina (para no arrastrar al lobby). */
  private finalShown = false;
  /** El tablero final ya se renderizo una vez (evita re-render en cada poll). */
  private finalRendered = false;
  /** Ya se ofrecio el "volver a la sala" tras el reset de la sala. */
  private lobbyReturnRendered = false;
  /** Tabla final cacheada: el reset de la sala borra los puntajes de la DB. */
  private finalTotals: ReturnType<typeof computeTotals> | null = null;

  private readonly gameId: string;
  readonly code: string;
  readonly me: string;
  private readonly hooks: RoomModeHooks;
  /** Suscriptores del juego al broadcast "sync" (tableros compartidos). */
  private readonly gameSyncCbs: Array<() => void> = [];

  constructor(gameId: string, code: string, me: string, hooks: RoomModeHooks) {
    this.gameId = gameId;
    this.code = code;
    this.me = me;
    this.hooks = hooks;
  }

  async boot(): Promise<void> {
    const state = await fetchRoomState(this.code);
    if (!state) {
      this.overlay.showError("La sala no existe o no se pudo cargar.");
      return;
    }
    if (!state.players.includes(this.me)) {
      // No registrado: si la sala esta en juego, entra como espectador (mira sin
      // jugar); si esta en el lobby (o volvio a el), pasa a registrarse.
      if (state.room.status !== "lobby" && state.room.status !== "finished") {
        this.spectator = true;
      } else {
        this.navigate(`/rooms/?code=${this.code}`);
        return;
      }
    }

    this.myRound = state.room.current_round;
    this.reported = state.scores.some(
      (s) => s.round_no === this.myRound && s.player === this.me,
    );

    this.channel = new RoomChannel(this.code, this.me);
    this.channel.onSync(() => {
      void this.refresh();
      for (const cb of this.gameSyncCbs) cb();
    });
    this.channel.onPresence(() => this.applyState());

    this.applyState(state);

    window.setInterval(() => this.tick(), TICK_MS);
    window.setInterval(() => void this.refresh(), POLL_MS);
  }

  reportScore(finalScore: number): void {
    void this.submitScore(finalScore, true);
  }

  // ---------- Contexto para tableros compartidos ----------

  round(): number {
    return this.myRound;
  }

  players(): string[] {
    return this.state?.players ?? [];
  }

  ping(): void {
    this.channel?.ping();
  }

  onSync(cb: () => void): void {
    this.gameSyncCbs.push(cb);
  }

  deadline(): Date | null {
    const iso = this.state?.room.deadline;
    return iso ? new Date(iso) : null;
  }

  // ---------- Estado ----------

  private async refresh(): Promise<void> {
    if (this.navigating) return;
    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }
    this.refreshing = true;
    const state = await fetchRoomState(this.code);
    this.refreshing = false;
    if (state) this.applyState(state);
    if (this.refreshQueued) {
      this.refreshQueued = false;
      void this.refresh();
    }
  }

  /** Re-renderiza segun el ultimo snapshot (o uno nuevo si se pasa). */
  private applyState(state?: RoomState): void {
    if (state) this.state = state;
    if (!this.state || this.navigating) return;
    const room = this.state.room;

    if (this.spectator) {
      this.applySpectator(room);
      return;
    }

    if (room.status === "lobby") {
      // Solo quien todavia no vio el tablero final va directo al lobby. A los que
      // estan mirando los resultados NO se los arrastra cuando OTRO resetea la
      // sala (incluido el host): se quedan en el tablero final con su propio boton
      // "Volver a la sala". El que apreto el boton se navega solo (returnToLobby).
      if (!this.finalShown) {
        this.navigate(`/rooms/?code=${this.code}`);
        return;
      }
      if (!this.lobbyReturnRendered) {
        this.lobbyReturnRendered = true;
        this.overlay.setStrip(null);
        this.overlay.showFinal(this.finalTotals ?? [], this.me, {
          hostAction: {
            label: "Volver a la sala",
            onClick: () => this.navigate(`/rooms/?code=${this.code}`),
          },
          waitingText: null,
        });
      }
      return;
    }
    if (room.status === "finished") {
      // Se renderiza una sola vez (no en cada poll, para que no parpadee).
      // Cualquier jugador puede volver a la sala: no hay que esperar al anfitrion
      // (el que vuelve resetea la sala al lobby para todos).
      if (!this.finalRendered) {
        this.finalRendered = true;
        this.finalShown = true;
        if (!this.finalTotals) this.finalTotals = computeTotals(this.state);
        this.overlay.setStrip(null);
        this.overlay.showFinal(this.finalTotals, this.me, {
          hostAction: { label: "Volver a la sala", onClick: () => void this.returnToLobby() },
          waitingText: null,
        });
      }
      this.updateTakeover();
      return;
    }

    // Otra ronda u otro juego: esta pagina ya no es la vigente.
    if (room.current_round !== this.myRound || room.current_game !== this.gameId) {
      void this.leaveForCurrentRound();
      return;
    }

    switch (room.status) {
      case "playing":
        if (this.playingSinceRound !== room.current_round) {
          this.playingSinceRound = room.current_round;
          this.playingSince = Date.now();
        }
        this.updateStrip();
        if (this.reported) {
          this.renderWaiting();
        } else {
          this.overlay.hide();
          this.autoStartGame();
        }
        if (this.isHost()) void this.maybeCloseRound();
        break;
      case "results":
        this.reportPartialIfNeeded();
        this.overlay.setStrip(null);
        this.renderResults();
        break;
      case "voting":
        this.reportPartialIfNeeded();
        this.overlay.setStrip(null);
        this.renderVoting();
        break;
      case "time_voting":
        // Antes de jugar: se vota el tope de tiempo de esta ronda. Todavia no
        // se jugo, asi que no se reporta ningun parcial.
        this.overlay.setStrip(null);
        this.renderTimeVoting();
        break;
    }
    this.updateTakeover();
  }

  /**
   * Vista del espectador: no juega ni escribe nada. Mira un cartel fijo mientras
   * la partida corre y el tablero final cuando termina; si la sala vuelve al
   * lobby, va a /rooms para poder sumarse a la revancha.
   */
  private applySpectator(room: RoomState["room"]): void {
    if (room.status === "lobby") {
      this.navigate(`/rooms/?code=${this.code}`);
      return;
    }
    if (room.status === "finished") {
      if (!this.finalRendered) {
        this.finalRendered = true;
        if (!this.finalTotals) this.finalTotals = computeTotals(this.state!);
        this.overlay.setStrip(null);
        this.overlay.showFinal(this.finalTotals, this.me, {
          hostAction: null,
          waitingText: "La partida termino",
        });
      }
      return;
    }
    // En juego: seguir a la pagina del juego vigente para mirar desde ahi.
    if (room.current_game && room.current_game !== this.gameId) {
      this.navigate(roomGameUrl(room.current_game, this.code));
      return;
    }
    this.updateStrip();
    if (!this.spectatorRendered) {
      this.spectatorRendered = true;
      this.overlay.showSpectator();
    }
  }

  /**
   * Arranca la partida en cuanto la ronda esta "playing" (una sola vez por
   * pagina), asi todos empiezan juntos sin tocar Enter. Los juegos que no pasan
   * `onStart` siguen esperando el input manual.
   */
  private autoStartGame(): void {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.hooks.onStart?.();
  }

  /**
   * Red de seguridad: si la ronda de esta pagina ya paso a resultados/votacion y
   * el jugador seguia vivo sin haber reportado (se perdio el submit por deadline
   * del tick, p.ej. si el host cerro la ronda antes), manda el parcial con el
   * puntaje en curso para que no quede como ausente (0 puntos). El upsert de
   * reportScore igual cuenta en el ranking/totales, que se recalculan de la DB.
   */
  private reportPartialIfNeeded(): void {
    if (this.reported || this.myRound <= 0) return;
    void this.submitScore(this.hooks.getScore(), false);
  }

  /** Reporta el parcial si hacia falta y navega a la ronda vigente. */
  private async leaveForCurrentRound(): Promise<void> {
    const room = this.state!.room;
    if (!this.reported && this.myRound > 0) {
      await this.submitScore(this.hooks.getScore(), false);
    }
    this.navigate(roomGameUrl(room.current_game ?? "", this.code));
  }

  private async submitScore(score: number, finished: boolean): Promise<void> {
    // Un espectador no puntua nunca (no esta registrado en la sala).
    if (this.spectator) return;
    // No re-reportar si ya se confirmo, ni lanzar una segunda escritura mientras
    // hay una en vuelo (varios caminos llaman aca: muerte, timeout del tick, parcial
    // al cambiar de fase, navegacion).
    if (this.reported || this.reporting) return;
    this.reporting = true;
    this.renderWaiting();
    const ok = await reportScore(this.code, this.myRound, this.me, score, finished);
    this.reporting = false;
    // Solo latchear "reportado" si la escritura funciono: ante un fallo transitorio
    // (red / RLS / score no finito) queda para reintentar en el proximo tick o al
    // pasar a resultados, en vez de perder el puntaje y contar como ausente.
    if (ok) {
      this.reported = true;
      this.channel?.ping();
    }
    void this.refresh();
  }

  private navigate(url: string): void {
    if (this.navigating) return;
    this.navigating = true;
    window.location.href = url;
  }

  isHost(): boolean {
    return this.state?.room.host === this.me;
  }

  private deadlineMs(): number | null {
    const iso = this.state?.room.deadline;
    return iso ? new Date(iso).getTime() : null;
  }

  private totalRounds(): number {
    const settings = this.state!.room.settings;
    return settings.playlist ? settings.playlist.length : settings.totalRounds;
  }

  private roundScores() {
    return this.state!.scores.filter((s) => s.round_no === this.state!.room.current_round);
  }

  private gameTitle(gameId: string): string {
    return games.find((g) => g.id === gameId)?.title ?? gameId;
  }

  // ---------- Ticker ----------

  private tick(): void {
    if (!this.state || this.navigating) return;
    const room = this.state.room;

    // El espectador solo mantiene vivo el contador del strip mientras hay ronda.
    if (this.spectator) {
      if (room.status !== "lobby" && room.status !== "finished") this.updateStrip();
      return;
    }

    const deadline = this.deadlineMs();
    const now = Date.now();

    if (room.status === "playing") {
      this.updateStrip();
      if (deadline !== null) {
        this.overlay.setTimeText(`La ronda termina en ${formatClock(deadline - now)}`);
        if (!this.reported && now >= deadline) {
          void this.submitScore(this.hooks.getScore(), false);
        }
        if (this.isHost() && now >= deadline + CLOSE_LAG_MS) {
          void this.maybeCloseRound(true);
        }
      }
    } else if (room.status === "voting" || room.status === "time_voting") {
      if (this.isHost()) this.maybeCompressVote();
      if (deadline !== null) {
        this.overlay.setTimeText(formatClock(deadline - now));
        // Sin CLOSE_LAG en las votaciones: no hay parciales que esperar, asi
        // cierra apenas vence (incluido el deadline comprimido a pocos segundos).
        if (this.isHost() && now >= deadline) {
          if (room.status === "voting") void this.closeVoting();
          else void this.closeTimeVote();
        }
      }
    }

    this.updateTakeover();
  }

  private updateStrip(): void {
    const room = this.state!.room;
    const deadline = this.deadlineMs();
    const time = deadline !== null ? ` - ${formatClock(deadline - Date.now())}` : "";
    this.overlay.setStrip(
      `SALA ${this.code} - Ronda ${room.current_round}/${this.totalRounds()}${time}`,
    );
  }

  // ---------- Vistas ----------

  private renderWaiting(): void {
    const state = this.state;
    const present = this.channel?.presentPlayers() ?? [];
    const done = new Set(state ? this.roundScores().map((s) => s.player) : [this.me]);
    const players = state?.players ?? [this.me];

    const entries: WaitingEntry[] = players.map((player) => ({
      player,
      state: done.has(player) ? "done" : present.includes(player) ? "playing" : "offline",
    }));
    this.overlay.showWaiting(entries, this.me);
  }

  private renderResults(): void {
    const state = this.state!;
    const room = state.room;
    const ranked = rankRound(this.gameId, state.players, this.roundScores());

    const rows = ranked.map((r) => ({
      rank: r.rank,
      player: r.player,
      scoreText:
        r.score === null
          ? "sin jugar"
          : formatScore(this.gameId, r.score) + (r.finished ? "" : " (parcial)"),
      points: r.points,
    }));

    const isLast = room.current_round >= this.totalRounds();
    const playlist = room.settings.playlist;

    let hostAction: { label: string; onClick: () => void } | null = null;
    let waitingText: string | null = "Esperando al anfitrion...";

    if (this.isHost()) {
      if (isLast) {
        hostAction = { label: "Ver resultados finales", onClick: () => void this.finish() };
      } else if (playlist) {
        hostAction = {
          label: "Siguiente juego",
          onClick: () => void this.startNextRound(playlist[room.current_round]),
        };
      } else {
        // Sin playlist: la votacion arranca sola tras una pausa para leer.
        waitingText = "La votacion arranca en unos segundos...";
        this.scheduleVote();
      }
    } else if (!isLast && !playlist) {
      waitingText = "La votacion arranca en unos segundos...";
    }

    this.overlay.showResults({
      roundNo: room.current_round,
      totalRounds: this.totalRounds(),
      gameTitle: this.gameTitle(this.gameId),
      rows,
      totals: computeTotals(state),
      me: this.me,
      hostAction,
      waitingText,
    });
  }

  private renderVoting(): void {
    const state = this.state!;
    const room = state.room;
    const optionIds = room.vote_options ?? [];
    const voteRound = room.current_round + 1;

    const votes = state.votes.filter(
      (v) => v.round_no === voteRound && optionIds.includes(v.game_id),
    );
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.game_id] = (counts[v.game_id] ?? 0) + 1;
    const myVote = votes.find((v) => v.player === this.me)?.game_id ?? null;

    this.overlay.showVoting({
      round: voteRound,
      options: optionIds.map((id) => {
        const game = games.find((g) => g.id === id);
        return { id, title: game?.title ?? id, accent: game?.accent };
      }),
      counts,
      myVote,
      onVote: (id) => {
        void castVote(this.code, voteRound, this.me, id).then((ok) => {
          if (ok) this.channel?.ping();
          void this.refresh();
        });
      },
    });

    if (this.isHost()) this.maybeCompressVote();
  }

  /** Votacion del tope de tiempo de esta ronda (antes de jugar). */
  private renderTimeVoting(): void {
    const state = this.state!;
    const room = state.room;
    const optionIds = room.vote_options ?? [];
    // El voto de tiempo se guarda en room_votes con round_no = la ronda a jugar
    // (el string de segundos va en game_id). El filtro por vote_options descarta
    // votos viejos (p.ej. del voto de juego previo, que se sobrescriben al votar).
    const round = room.current_round;

    const votes = state.votes.filter(
      (v) => v.round_no === round && optionIds.includes(v.game_id),
    );
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.game_id] = (counts[v.game_id] ?? 0) + 1;
    const myVote = votes.find((v) => v.player === this.me)?.game_id ?? null;

    this.overlay.showVoting({
      round,
      kicker: `Ronda ${room.current_round}/${this.totalRounds()} - ${this.gameTitle(this.gameId)}`,
      title: "Elegi el tiempo",
      hint: "Gana la mayoria; empate se define al azar",
      options: optionIds.map((id) => ({ id, title: formatRoundTimeLimit(Number(id)) })),
      counts,
      myVote,
      onVote: (id) => {
        void castVote(this.code, round, this.me, id).then((ok) => {
          if (ok) this.channel?.ping();
          void this.refresh();
        });
      },
    });

    if (this.isHost()) this.maybeCompressVote();
  }

  // ---------- Logica de host ----------

  private async hostAction(action: () => Promise<unknown>): Promise<void> {
    if (this.actionInFlight) return;
    this.actionInFlight = true;
    try {
      await action();
      this.channel?.ping();
      await this.refresh();
    } finally {
      this.actionInFlight = false;
    }
  }

  /** Cierra la ronda si todos reportaron, vencio el tope, o solo faltan ausentes. */
  private async maybeCloseRound(deadlinePassed = false): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "playing") return;

    const done = new Set(this.roundScores().map((s) => s.player));
    const allReported = state.players.every((p) => done.has(p));

    let onlyAbsentMissing = false;
    if (!allReported) {
      const present = this.channel?.presentPlayers() ?? [];
      const presentAllDone = state.players
        .filter((p) => present.includes(p))
        .every((p) => done.has(p));
      // Inicio de ronda = cuando esta pagina la vio en "playing". No se deriva
      // del deadline porque con tiempo votado / sin tope el deadline no lo refleja.
      // Gracia para que la presencia se estabilice tras la navegacion.
      onlyAbsentMissing =
        presentAllDone &&
        done.has(this.me) &&
        Date.now() - this.playingSince > CLOSE_EARLY_GRACE_MS;
    }

    if (!allReported && !deadlinePassed && !onlyAbsentMissing) return;
    await this.hostAction(() => closeRound(this.code));
  }

  private scheduleVote(): void {
    const round = this.state!.room.current_round;
    if (this.voteScheduledForRound === round) return;
    this.voteScheduledForRound = round;

    window.setTimeout(() => {
      void (async () => {
        // Revalidar contra la DB: pudo cambiar el host o la fase mientras tanto.
        const fresh = await fetchRoomState(this.code);
        if (!fresh || fresh.room.status !== "results" || fresh.room.host !== this.me) return;
        if (fresh.room.current_round !== round) return;
        this.state = fresh;
        const options = pickVoteOptions(fresh);
        const deadline = new Date(Date.now() + VOTE_SECONDS * 1000);
        await this.hostAction(() => openVote(this.code, options, deadline));
      })();
    }, RESULTS_TO_VOTE_MS);
  }

  /**
   * Si ya votaron todos los jugadores presentes, el host adelanta el deadline a
   * VOTE_GRACE_MS (unos segundos) en vez de esperar el tope completo: no tiene
   * sentido dejar la cuenta corriendo cuando no falta nadie por votar. Solo
   * cuenta a los presentes (a los ausentes no se los espera). Se escribe una
   * sola vez por fase+ronda.
   */
  private maybeCompressVote(): void {
    const state = this.state;
    if (!state || !this.isHost()) return;
    const room = state.room;
    if (room.status !== "voting" && room.status !== "time_voting") return;

    const options = room.vote_options ?? [];
    if (options.length === 0) return;
    // El voto del proximo juego se guarda en la ronda siguiente; el de tiempo, en
    // la ronda a jugar (la vigente).
    const voteRound = room.status === "voting" ? room.current_round + 1 : room.current_round;
    const voters = new Set(
      state.votes
        .filter((v) => v.round_no === voteRound && options.includes(v.game_id))
        .map((v) => v.player),
    );

    const present = this.channel?.presentPlayers() ?? [];
    const registeredPresent = state.players.filter((p) => present.includes(p));
    const allPresentVoted =
      registeredPresent.length > 0 && registeredPresent.every((p) => voters.has(p));
    if (!allPresentVoted) return;

    const key = `${room.status}:${room.current_round}`;
    if (this.compressedVoteKey === key) return;
    this.compressedVoteKey = key;

    const target = Date.now() + VOTE_GRACE_MS;
    const current = this.deadlineMs();
    // Solo escribir si realmente acorta (con un pequeno margen para no rebotar).
    if (current !== null && current <= target + 250) return;
    void this.hostAction(() => updateDeadline(this.code, new Date(target)));
  }

  private async closeVoting(): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "voting" || this.actionInFlight) return;
    const options = state.room.vote_options ?? [];
    if (options.length === 0) return;

    const voteRound = state.room.current_round + 1;
    const counts = new Map<string, number>();
    for (const v of state.votes) {
      if (v.round_no === voteRound && options.includes(v.game_id)) {
        counts.set(v.game_id, (counts.get(v.game_id) ?? 0) + 1);
      }
    }
    const max = Math.max(0, ...counts.values());
    const top = max > 0 ? options.filter((id) => counts.get(id) === max) : options;
    const winner = top[Math.floor(Math.random() * top.length)];
    await this.startNextRound(winner);
  }

  private async startNextRound(gameId: string): Promise<void> {
    const state = this.state;
    if (!state) return;
    const roundNo = state.room.current_round + 1;
    if (state.room.settings.timeVote) {
      // Con votacion de tiempo habilitada, antes de jugar se vota el tope: se
      // pasa a 'time_voting' y el tope real se fija al cerrar la votacion.
      const deadline = new Date(Date.now() + VOTE_SECONDS * 1000);
      await this.hostAction(() =>
        startTimeVote(this.code, roundNo, gameId, timeVoteOptionIds(), deadline),
      );
    } else {
      const deadline = computeRoundDeadline(state.room.settings.roundTimeLimitSec);
      await this.hostAction(() => startRound(this.code, roundNo, gameId, deadline));
    }
  }

  /** Cierra la votacion de tiempo y arranca a jugar con el tope ganador. */
  private async closeTimeVote(): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "time_voting" || this.actionInFlight) return;
    const options = state.room.vote_options ?? [];
    if (options.length === 0) return;

    const round = state.room.current_round;
    const counts = new Map<string, number>();
    for (const v of state.votes) {
      if (v.round_no === round && options.includes(v.game_id)) {
        counts.set(v.game_id, (counts.get(v.game_id) ?? 0) + 1);
      }
    }
    const max = Math.max(0, ...counts.values());
    const top = max > 0 ? options.filter((id) => counts.get(id) === max) : options;
    const winner = top[Math.floor(Math.random() * top.length)];
    const deadline = computeRoundDeadline(Number(winner));
    await this.hostAction(() => finishTimeVote(this.code, deadline));
  }

  private async finish(): Promise<void> {
    await this.hostAction(() => finishRoom(this.code));
  }

  /**
   * "Volver a la sala" desde el tablero final. Lo puede tocar cualquier jugador
   * (no solo el anfitrion): resetea la sala al lobby para todos y lleva a quien
   * lo apreto directo al lobby, sin tener que esperar a que el lider vuelva.
   */
  private async returnToLobby(): Promise<void> {
    await this.hostAction(() => resetRoom(this.code));
    this.navigate(`/rooms/?code=${this.code}`);
  }

  // ---------- Migracion de host ----------

  private updateTakeover(): void {
    const state = this.state;
    // Un espectador no puede tomar el control (no es jugador de la sala).
    if (!state || this.spectator || this.isHost()) {
      this.hostAbsentSince = null;
      return;
    }
    // Solo en fases estables: la presencia parpadea durante la navegacion.
    const stable =
      state.room.status === "results" ||
      state.room.status === "voting" ||
      state.room.status === "time_voting" ||
      state.room.status === "finished" ||
      (state.room.status === "playing" && this.reported);
    const present = this.channel?.presentPlayers() ?? [];
    if (!stable || present.includes(state.room.host)) {
      this.hostAbsentSince = null;
      return;
    }
    if (this.hostAbsentSince === null) this.hostAbsentSince = Date.now();
    if (Date.now() - this.hostAbsentSince < HOST_ABSENT_MS) return;

    this.overlay.offerTakeover(() => {
      void takeOverHost(this.code, this.me).then((ok) => {
        if (ok) this.channel?.ping();
        void this.refresh();
      });
    });
  }
}

/** 3 juegos al azar que todavia no salieron (o los que queden; nunca vacio). */
export function pickVoteOptions(state: RoomState): string[] {
  const played = new Set(state.rounds.map((r) => r.game_id));
  let pool = games.map((g) => g.id).filter((id) => !played.has(id));
  if (pool.length === 0) pool = games.map((g) => g.id);

  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool[i]);
    pool.splice(i, 1);
  }
  return picked;
}

/** "1:43" a partir de milisegundos restantes (piso 0:00). */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
