import { getNickname } from "../../../shared/nickname";
import { fetchRoomState, sanitizeCode } from "../../../shared/room/api";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { botAction, botTradeResponse } from "./Bot";
import { Hud, type SoloSetup } from "./Hud";
import { MonopolyChannel } from "./MonopolyChannel";
import { playFx, sfx } from "./audio";
import {
  BEST_KEY,
  BOT_NAMES,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  GAME_ID,
  MAX_PLAYERS,
  TURN_TIMEOUT_MS,
} from "./constants";
import { applyAction, createGame, current, netWorth } from "./engine";
import type { Action, GameState } from "./types";

type Screen = "start" | "countdown" | "playing" | "over";

const BOT_DELAY_MS = 950;
/** Heartbeat del host: cura a clientes que se perdieron un broadcast. */
const HOST_SYNC_MS = 3000;

/**
 * Orquestador. Dos modos:
 * - Solitario (sin ?room=): el humano + 1-7 bots; todo corre local.
 * - Sala online (?room=CODE): hasta 8 humanos; el host corre el motor y
 *   difunde el GameState entero por broadcast; los clientes solo mandan
 *   acciones. Si un jugador se cuelga, el host lo auto-juega con la logica
 *   de bot pasados TURN_TIMEOUT_MS.
 */
export class Game {
  private readonly hud: Hud;
  private readonly me: string;

  private screen: Screen = "start";
  private state: GameState | null = null;
  private setup: SoloSetup = { rivals: 3, difficulty: "profesional", token: 0 };

  private countdownTime = 0;
  private countdownIndex = -1;
  private lastFxSeq = -1;
  private botTimer = 0;
  private lastTick = 0;

  // Modo sala
  private readonly room: RoomMode | null;
  private readonly roomCode: string | null;
  private channel: MonopolyChannel | null = null;
  private roomPlayers: string[] = [];
  private isHost = false;
  private lastStateChange = 0;
  private pendingRemoteState: GameState | null = null;

  constructor(container: HTMLElement) {
    this.me = getNickname() ?? "Jugador";
    this.hud = new Hud(container, {
      onAction: (action) => this.onLocalAction(action),
      onStart: () => this.onStartPressed(),
    });

    const rawCode = new URLSearchParams(window.location.search).get("room");
    this.roomCode = rawCode ? sanitizeCode(rawCode) : null;
    this.room = initRoomMode(GAME_ID, {
      getScore: () => (this.state ? netWorth(this.state, this.me) : 0),
    });

    if (this.room && this.roomCode) {
      void this.bootRoom(this.roomCode);
    } else {
      this.showSoloStart();
    }

    this.lastTick = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  // ---------- Pantallas ----------

  private showSoloStart(): void {
    this.screen = "start";
    const raw = localStorage.getItem(BEST_KEY);
    const best = raw ? Number(raw) : null;
    this.hud.showSoloStart(this.me, Number.isFinite(best) && best ? best : null, this.setup, (s) => {
      this.setup = s;
      this.showSoloStart();
    });
  }

  private async bootRoom(code: string): Promise<void> {
    const roomState = await fetchRoomState(code);
    if (!roomState) {
      this.hud.showError("No se pudo cargar la sala.");
      return;
    }
    this.roomPlayers = roomState.players.slice(0, MAX_PLAYERS);
    const host = this.roomPlayers.includes(roomState.room.host)
      ? roomState.room.host
      : this.roomPlayers[0];
    this.isHost = host === this.me;

    this.channel = new MonopolyChannel(code, roomState.room.current_round);
    this.channel.onState((s) => this.onRemoteState(s));
    this.channel.onGo((p) => {
      this.roomPlayers = p.players;
      if (!this.isHost) this.beginCountdown();
    });
    this.channel.onAction((p) => {
      if (this.isHost && this.state) {
        this.applyAndBroadcast(p.p, p.a);
      }
    });
    this.channel.onHello(() => {
      if (this.isHost && this.state) this.channel?.sendState(this.state);
    });
    this.channel.sendHello(this.me);

    if (this.roomPlayers.length < 2) {
      this.hud.showError("Se necesitan al menos 2 jugadores en la sala.");
      return;
    }
    this.hud.showRoomWait(this.roomPlayers, this.me, this.isHost);

    if (this.isHost) {
      window.setInterval(() => {
        if (this.state && this.screen === "playing") this.channel?.sendState(this.state);
      }, HOST_SYNC_MS);
    }
  }

  private onStartPressed(): void {
    if (this.screen === "countdown") return;
    if (this.roomCode) {
      // Online: solo el anfitrion arranca, y solo desde la espera.
      if (!this.isHost || this.screen !== "start") return;
      this.channel?.sendGo({ players: this.roomPlayers });
      this.beginCountdown();
      return;
    }
    // Desde el game over, Enter va directo a la revancha via countdown
    // (mismo setup); para cambiar rivales/ficha esta el boton MENU.
    this.beginCountdown();
  }

  // ---------- Countdown 3/2/1/YA (patron obligatorio del repo) ----------

  private beginCountdown(): void {
    this.screen = "countdown";
    this.countdownTime = 0;
    this.countdownIndex = -1;
    this.hud.hideOverlay();
  }

  private updateCountdown(dt: number): void {
    this.countdownTime += dt;
    const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
    if (index >= COUNTDOWN_LABELS.length) {
      this.hud.showCountdown(null);
      this.startMatch();
      return;
    }
    if (index !== this.countdownIndex) {
      this.countdownIndex = index;
      this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      sfx.count(index === COUNTDOWN_LABELS.length - 1);
    }
  }

  private startMatch(): void {
    this.screen = "playing";
    if (this.roomCode) {
      if (this.isHost) {
        const players = this.roomPlayers.map((name) => ({ name, isBot: false }));
        this.state = createGame(players);
        this.lastFxSeq = this.state.fxSeq - 1;
        this.lastStateChange = Date.now();
        this.channel?.sendState(this.state);
        this.renderState();
      } else if (this.pendingRemoteState) {
        this.adoptRemoteState(this.pendingRemoteState);
        this.pendingRemoteState = null;
      }
      return;
    }
    // Solitario: humano + bots con nombres de DT.
    const names = new Set([this.me]);
    const players = [{ name: this.me, isBot: false }];
    for (let i = 0; i < this.setup.rivals; i++) {
      let name = BOT_NAMES[i % BOT_NAMES.length];
      while (names.has(name)) name = `${name} II`;
      names.add(name);
      players.push({ name, isBot: true });
    }
    this.state = createGame(players);
    // El humano usa la ficha elegida; los bots, las siguientes (6 fichas max).
    const order = [this.setup.token, ...Array.from({ length: 6 }, (_, i) => i).filter((i) => i !== this.setup.token)];
    this.state.players.forEach((p, i) => (p.token = order[i % order.length]));
    this.lastFxSeq = this.state.fxSeq - 1;
    this.renderState();
    this.scheduleBot();
  }

  // ---------- Acciones ----------

  private onLocalAction(action: Action): void {
    if (!this.state || this.screen !== "playing") return;
    if (this.roomCode && !this.isHost) {
      this.channel?.sendAction({ p: this.me, a: action });
      return;
    }
    this.applyAndBroadcast(this.me, action);
  }

  /** Host y modo solitario: aplica, difunde y re-renderiza. */
  private applyAndBroadcast(actor: string, action: Action): void {
    if (!this.state) return;
    applyAction(this.state, actor, action);
    this.lastStateChange = Date.now();
    if (this.roomCode) this.channel?.sendState(this.state);
    this.renderState();
    if (!this.roomCode) this.scheduleBot();
  }

  // ---------- Bots (solo modo solitario) ----------

  private scheduleBot(): void {
    window.clearTimeout(this.botTimer);
    if (!this.state || this.state.phase === "over" || this.screen !== "playing") return;

    // Canje pendiente dirigido a un bot: responde el.
    const trade = this.state.trade;
    if (trade) {
      const target = this.state.players.find((p) => p.name === trade.to);
      if (target?.isBot) {
        this.botTimer = window.setTimeout(() => {
          if (!this.state || this.state.trade !== trade) return;
          applyAction(this.state, trade.to, botTradeResponse(this.state, trade, this.setup.difficulty));
          this.renderState();
          this.scheduleBot();
        }, BOT_DELAY_MS);
        return;
      }
    }

    const player = current(this.state);
    if (!player.isBot) return;
    this.botTimer = window.setTimeout(() => {
      if (!this.state || this.state.phase === "over") return;
      const action = botAction(this.state, this.setup.difficulty);
      if (action) applyAction(this.state, player.name, action);
      this.renderState();
      this.scheduleBot();
    }, BOT_DELAY_MS);
  }

  // ---------- Modo sala: recepcion de estado ----------

  private onRemoteState(remote: GameState): void {
    if (this.isHost) return;
    if (this.screen === "start") {
      // Llegamos tarde (el countdown ya paso en el resto): entrar directo.
      this.pendingRemoteState = remote;
      this.beginCountdown();
      return;
    }
    if (this.screen === "countdown") {
      this.pendingRemoteState = remote;
      return;
    }
    this.adoptRemoteState(remote);
  }

  private adoptRemoteState(remote: GameState): void {
    this.state = remote;
    this.screen = "playing";
    this.renderState();
  }

  // ---------- Render + fin de partida ----------

  private renderState(): void {
    const state = this.state;
    if (!state) return;

    // SFX por delta de fx (funciona igual local y remoto).
    for (const event of state.fx) {
      if (event.seq > this.lastFxSeq) {
        this.lastFxSeq = event.seq;
        playFx(event.kind);
      }
    }

    this.hud.remember(state, this.me);
    this.hud.render(state, this.me);
    this.hud.maybeShowBuyModal(state, this.me);

    const meState = state.players.find((p) => p.name === this.me);
    const humanDone = state.phase === "over" || (meState?.bankrupt ?? false) && !this.roomCode;
    if (humanDone && this.screen === "playing") {
      this.finishMatch();
    }
  }

  private finishMatch(): void {
    const state = this.state!;
    this.screen = "over";
    const myWorth = netWorth(state, this.me);

    if (this.room) {
      this.room.reportScore(myWorth);
      this.hud.showGameOver(state, this.me, { restartHint: "La sala sigue con la proxima ronda" });
      return;
    }

    const raw = localStorage.getItem(BEST_KEY);
    const best = raw ? Number(raw) : 0;
    if (myWorth > best) localStorage.setItem(BEST_KEY, String(myWorth));
    this.hud.showGameOver(state, this.me, {
      restartHint: "ENTER para la revancha",
      onMenu: () => this.showSoloStart(),
    });
    this.hud.showRanking(GAME_ID, myWorth);
  }

  // ---------- Loop ----------

  private tick(t: number): void {
    const dt = Math.min(0.1, (t - this.lastTick) / 1000);
    this.lastTick = t;

    if (this.screen === "countdown") this.updateCountdown(dt);

    // Host online: auto-juega al jugador de turno si se paso del timeout
    // (desconexion o distraccion), usando la logica de bot.
    if (
      this.roomCode &&
      this.isHost &&
      this.state &&
      this.screen === "playing" &&
      this.state.phase !== "over" &&
      Date.now() - this.lastStateChange > TURN_TIMEOUT_MS
    ) {
      const state = this.state;
      const trade = state.trade;
      if (trade) {
        applyAction(state, trade.to, { type: "tradeReject" });
      } else {
        const action = botAction(state, "profesional");
        if (action) applyAction(state, current(state).name, action);
      }
      this.lastStateChange = Date.now();
      this.channel?.sendState(state);
      this.renderState();
    }

    requestAnimationFrame((now) => this.tick(now));
  }
}
