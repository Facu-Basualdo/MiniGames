/**
 * Logica pura del Ta-Te-Ti "ciclico" (sin empates), compartida por el modo
 * solo (vs IA) y el modo sala (PvP sobre tablero compartido). Sin DOM ni red:
 * el estado es serializable tal cual a jsonb (room_match_state.state) y todas
 * las transiciones son funciones puras, asi cualquier cliente computa lo mismo.
 *
 * Regla que elimina el empate: cada jugador mantiene como maximo 3 fichas. Al
 * colocar la cuarta se elimina primero la mas antigua que puso, de modo que el
 * tablero nunca se llena (siempre queda al menos una casilla libre) y la partida
 * continua hasta que alguien arma una linea de 3.
 */

export type Player = 0 | 1;
export type Cell = Player | null;

/** Cantidad maxima de fichas por jugador en el tablero (la 4ta elimina la 1ra). */
export const MAX_PIECES = 3;

/** Las 8 lineas ganadoras de un tablero 3x3. */
export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface TttState {
  /** 9 casillas: player que la ocupa, o null si esta libre. */
  cells: Cell[];
  /** Casillas ocupadas por cada jugador, en orden de colocacion (mas vieja primero). */
  queues: [number[], number[]];
  /** Jugador al que le toca mover. */
  turn: Player;
  /** Jugador que armo linea, o null si la partida sigue. */
  winner: Player | null;
  /** Linea ganadora (indices) cuando hay ganador, si no null. */
  winningLine: readonly number[] | null;
}

export function otherPlayer(p: Player): Player {
  return p === 0 ? 1 : 0;
}

export function createState(first: Player = 0): TttState {
  return {
    cells: new Array<Cell>(9).fill(null),
    queues: [[], []],
    turn: first,
    winner: null,
    winningLine: null,
  };
}

/** Casillas libres donde el jugador de turno puede colocar (vacio si ya termino). */
export function legalMoves(state: TttState): number[] {
  if (state.winner !== null) return [];
  const moves: number[] = [];
  for (let i = 0; i < 9; i++) if (state.cells[i] === null) moves.push(i);
  return moves;
}

/**
 * Casilla que se eliminara cuando `player` coloque su proxima ficha (su ficha
 * mas antigua si ya tiene el maximo), o null si todavia no llego al tope. Sirve
 * para atenuarla en pantalla y avisar que va a desaparecer.
 */
export function pieceToRemove(state: TttState, player: Player): number | null {
  const q = state.queues[player];
  return q.length >= MAX_PIECES ? q[0] : null;
}

function lineFor(cells: Cell[], player: Player): readonly number[] | null {
  for (const line of LINES) {
    if (cells[line[0]] === player && cells[line[1]] === player && cells[line[2]] === player) {
      return line;
    }
  }
  return null;
}

/**
 * Aplica la jugada del jugador de turno en `cell` (se asume legal) y devuelve el
 * estado nuevo. Si el jugador ya tenia el maximo de fichas, primero se elimina
 * la mas antigua (la 1ra que puso) y despues se coloca la nueva; luego se revisa
 * si el que jugo armo linea. Solo el jugador que mueve puede ganar en su turno.
 */
export function applyMove(state: TttState, cell: number): TttState {
  const player = state.turn;
  const cells = state.cells.slice();
  const queues: [number[], number[]] = [state.queues[0].slice(), state.queues[1].slice()];
  const queue = queues[player];

  if (queue.length >= MAX_PIECES) {
    const oldest = queue.shift()!;
    cells[oldest] = null;
  }
  cells[cell] = player;
  queue.push(cell);

  const winningLine = lineFor(cells, player);
  return {
    cells,
    queues,
    turn: otherPlayer(player),
    winner: winningLine ? player : null,
    winningLine,
  };
}
