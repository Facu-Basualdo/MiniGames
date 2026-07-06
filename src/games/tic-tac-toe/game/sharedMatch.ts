import {
  createMatchState,
  fetchMatchState,
  updateMatchState,
} from "../../../shared/room/matchState";
import type { RoomMode } from "../../../shared/room/roomMode";
import { AFK_MOVE_MS, MATCH_POLL_MS } from "./constants";
import type { Hud } from "./Hud";
import {
  applyMove,
  createState,
  legalMoves,
  pieceToRemove,
  type TttState,
} from "./logic";
import { SoundEffects } from "./SoundEffects";

/**
 * Estado durable de una partida de sala: el tablero + los nicknames de los dos
 * asientos (X = players[0], O = players[1]) y un correlativo de jugadas para que
 * los clientes remotos animen/suenen cada movimiento una sola vez.
 */
interface TttMatchState extends TttState {
  players: [string, string];
  seq: number;
}

function applyRoomMove(state: TttMatchState, cell: number): TttMatchState {
  const base = applyMove(state, cell);
  return { ...base, players: state.players, seq: state.seq + 1 };
}

/**
 * Controlador del tablero compartido (modo sala, PvP). Misma sincronizacion que
 * el resto de las salas: el jugador de turno escribe en room_match_state (con
 * version optimista) -> ping "sync" -> los demas refetchean, mas un poll de
 * respaldo. El host crea el tablero inicial y, si un jugador se queda AFK,
 * mueve por el para que la partida (que no puede empatar) siga hasta el ganador.
 */
export class SharedMatch {
  private state: TttMatchState | null = null;
  private version = 0;
  private lastAnimSeq = 0;
  private lastChangeAt = Date.now();
  private finished = false;
  /** Serializa las escrituras: dos jugadas rapidas deben llegar en orden. */
  private writeChain: Promise<void> = Promise.resolve();

  private readonly room: RoomMode;
  private readonly hud: Hud;
  private readonly onFinished: () => void;

  constructor(room: RoomMode, hud: Hud, onFinished: () => void) {
    this.room = room;
    this.hud = hud;
    this.onFinished = onFinished;
  }

  start(): void {
    this.hud.setStatus("Preparando el tablero...");
    this.hud.setInteractive(false);
    this.hud.showPlayers(null);
    this.room.onSync(() => void this.refresh());
    window.setInterval(() => void this.refresh(), MATCH_POLL_MS);
    window.setInterval(() => void this.maybeMoveAfk(), 1000);
    void this.boot();
  }

  /** Puntaje de la ronda (y parcial por timeout): 1 si voy ganando, si no 0. */
  myScore(): number {
    const state = this.state;
    if (!state || state.winner === null) return 0;
    return state.players[state.winner] === this.room.me ? 1 : 0;
  }

  /**
   * Espera (o crea, si somos el host) el estado inicial. Los dos asientos son
   * los dos primeros jugadores de la sala; el resto mira. Ante la carrera de
   * hosts gana el primer insert (PK) y todos releen lo que quedo.
   */
  private async boot(): Promise<void> {
    for (;;) {
      if (this.state) return;
      const row = await fetchMatchState<TttMatchState>(this.room.code, this.room.round());
      if (row) {
        this.apply(row.state, row.version);
        return;
      }
      const players = this.room.players();
      if (players.length >= 2 && this.room.isHost()) {
        const seats: [string, string] = [players[0], players[1]];
        const init: TttMatchState = { ...createState(0), players: seats, seq: 0 };
        const ok = await createMatchState(this.room.code, this.room.round(), init);
        if (ok) this.room.ping();
        continue;
      }
      if (players.length < 2) this.hud.setStatus("Esperando un rival...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async refresh(): Promise<void> {
    const row = await fetchMatchState<TttMatchState>(this.room.code, this.room.round());
    if (row && row.version > this.version) this.apply(row.state, row.version);
  }

  /** Relee descartando el estado local (tras un conflicto de escritura). */
  private async forceRefresh(): Promise<void> {
    const row = await fetchMatchState<TttMatchState>(this.room.code, this.room.round());
    if (row) this.apply(row.state, row.version, true);
  }

  private apply(state: TttMatchState, version: number, force = false): void {
    if (!force && this.state && version <= this.version) return;
    if (version !== this.version) this.lastChangeAt = Date.now();

    this.state = state;
    this.version = version;

    // Jugada nueva hecha por otro cliente: sonarla una sola vez.
    if (state.seq > this.lastAnimSeq) {
      this.lastAnimSeq = state.seq;
      SoundEffects.playPlace(state.winner !== null ? state.winner : state.turn === 0 ? 1 : 0);
    }

    this.render();
    this.checkFinish();
  }

  /** Clic en una casilla (lo enruta el Game desde su unico handler). */
  handleCell(index: number): void {
    const state = this.state;
    if (!state || this.finished || state.winner !== null) return;
    if (state.players[state.turn] !== this.room.me) return; // no es mi turno
    if (state.cells[index] !== null) return; // casilla ocupada

    const player = state.turn;
    const expected = this.version;
    const next = applyRoomMove(state, index);

    // Local-first: la jugada propia se ve al instante, la escritura va detras.
    this.state = next;
    this.version = expected + 1;
    this.lastAnimSeq = next.seq;
    this.lastChangeAt = Date.now();
    if (pieceToRemove(state, player) !== null) SoundEffects.playRemove();
    SoundEffects.playPlace(player);
    this.queueWrite(next, expected);

    this.render();
    this.checkFinish();
  }

  /** Host: si el jugador de turno no mueve en AFK_MOVE_MS, juega por el (al azar). */
  private async maybeMoveAfk(): Promise<void> {
    const state = this.state;
    if (!state || this.finished || state.winner !== null || !this.room.isHost()) return;
    if (Date.now() - this.lastChangeAt < AFK_MOVE_MS) return;

    const moves = legalMoves(state);
    if (moves.length === 0) return;
    this.lastChangeAt = Date.now(); // un intento por ventana de inactividad

    const cell = moves[Math.floor(Math.random() * moves.length)];
    const expected = this.version;
    const next = applyRoomMove(state, cell);
    this.state = next;
    this.version = expected + 1;
    this.lastAnimSeq = next.seq;
    SoundEffects.playPlace(state.turn);
    this.render();
    this.checkFinish();
    this.queueWrite(next, expected);
  }

  /** Encadena las escrituras; ante conflicto de version se readopta la DB. */
  private queueWrite(next: TttMatchState, expected: number): void {
    this.writeChain = this.writeChain.then(async () => {
      const ok = await updateMatchState(this.room.code, this.room.round(), next, expected);
      if (ok) this.room.ping();
      else await this.forceRefresh();
    });
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const me = this.room.me;
    const seat = state.players.indexOf(me);
    const iAmPlayer = seat === 0 || seat === 1;

    const removable = state.winner === null ? pieceToRemove(state, state.turn) : null;
    this.hud.renderBoard(state.cells, { removable, winningLine: state.winningLine });

    const myTurn = state.winner === null && state.players[state.turn] === me;
    this.hud.setInteractive(myTurn);

    if (iAmPlayer) {
      this.hud.setScore(`SOS ${seat === 0 ? "X" : "O"}`);
    } else {
      this.hud.setScore("MIRANDO");
    }
    this.hud.setBest("");

    if (state.winner !== null) {
      const winner = state.players[state.winner];
      this.hud.setStatus(
        winner === me ? "GANASTE" : iAmPlayer ? "PERDISTE" : `GANO ${winner}`,
        winner === me,
      );
    } else {
      const turnName = state.players[state.turn];
      this.hud.setStatus(myTurn ? "TU TURNO" : `TURNO DE ${turnName}`, myTurn);
    }

    this.hud.showPlayers(
      state.players.map((player, idx) => ({
        player,
        markLabel: idx === 0 ? "X" : "O",
        colorIdx: idx,
        isTurn: state.winner === null && idx === state.turn,
        isMe: player === me,
      })),
    );
  }

  private checkFinish(): void {
    const state = this.state;
    if (!state || this.finished || state.winner === null) return;
    this.finished = true;
    this.hud.setInteractive(false);

    const iWon = state.players[state.winner] === this.room.me;
    if (iWon) SoundEffects.playWin();
    else SoundEffects.playLose();

    this.render();
    this.room.reportScore(this.myScore());
    this.onFinished();
  }
}
