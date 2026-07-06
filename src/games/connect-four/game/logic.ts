/**
 * Logica pura del Conecta 4, compartida por el modo solo (vs IA) y el modo sala
 * (PvP sobre tablero compartido). Sin DOM ni red: el estado es serializable tal
 * cual a jsonb (room_match_state.state) y todas las transiciones son funciones
 * puras, asi cualquier cliente computa lo mismo.
 *
 * Tablero de 7 columnas x 6 filas. Una jugada es elegir una columna: la ficha
 * "cae" hasta la casilla libre mas baja. Gana quien alinea 4 fichas propias en
 * horizontal, vertical o diagonal. Si el tablero se llena sin linea, es empate.
 */

export type Player = 0 | 1;
export type Cell = Player | null;

export const COLS = 7;
export const ROWS = 6;
export const SIZE = COLS * ROWS; // 42 casillas
/** Fichas en linea necesarias para ganar. */
export const CONNECT = 4;

/** Indice de casilla a partir de fila (0 = arriba) y columna. */
export function idx(row: number, col: number): number {
  return row * COLS + col;
}

export interface C4State {
  /** 42 casillas: player que la ocupa o null. Indice = fila*COLS + columna, fila 0 arriba. */
  cells: Cell[];
  /** Fichas apiladas en cada columna (0..ROWS); define donde cae la proxima. */
  heights: number[];
  /** Jugador al que le toca mover. */
  turn: Player;
  /** Jugador que alineo 4, o null si la partida sigue o empato. */
  winner: Player | null;
  /** Casillas de la linea ganadora (>= 4) cuando hay ganador, si no null. */
  winningLine: readonly number[] | null;
  /** Tablero lleno sin ganador. */
  draw: boolean;
  /** Ultima casilla colocada (para animar la caida), o null al inicio. */
  lastMove: number | null;
}

export function otherPlayer(p: Player): Player {
  return p === 0 ? 1 : 0;
}

export function createState(first: Player = 0): C4State {
  return {
    cells: new Array<Cell>(SIZE).fill(null),
    heights: new Array<number>(COLS).fill(0),
    turn: first,
    winner: null,
    winningLine: null,
    draw: false,
    lastMove: null,
  };
}

/** Columnas donde todavia se puede soltar una ficha (vacio si la partida termino). */
export function legalMoves(state: C4State): number[] {
  if (state.winner !== null || state.draw) return [];
  const moves: number[] = [];
  for (let c = 0; c < COLS; c++) if (state.heights[c] < ROWS) moves.push(c);
  return moves;
}

/** Fila (0 = arriba) donde caeria una ficha soltada en `col`, o null si esta llena. */
export function landingRow(state: C4State, col: number): number | null {
  const h = state.heights[col];
  return h < ROWS ? ROWS - 1 - h : null;
}

/** Direcciones de linea: horizontal, vertical y las dos diagonales. */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * Linea ganadora (>= 4 casillas contiguas del mismo jugador) que pasa por
 * (row, col), o null si esa jugada no gano. Se explora desde la ultima ficha
 * colocada, la unica que puede haber completado una linea.
 */
function winningLineAt(cells: Cell[], row: number, col: number, player: Player): number[] | null {
  for (const [dr, dc] of DIRS) {
    const line = [idx(row, col)];
    // Hacia un lado.
    for (let r = row + dr, c = col + dc; inBounds(r, c) && cells[idx(r, c)] === player; r += dr, c += dc) {
      line.push(idx(r, c));
    }
    // Hacia el otro.
    for (let r = row - dr, c = col - dc; inBounds(r, c) && cells[idx(r, c)] === player; r -= dr, c -= dc) {
      line.push(idx(r, c));
    }
    if (line.length >= CONNECT) return line;
  }
  return null;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/**
 * Suelta la ficha del jugador de turno en `col` (se asume legal) y devuelve el
 * estado nuevo. La ficha cae a la casilla libre mas baja; luego se revisa si el
 * que jugo alineo 4 (solo el que mueve puede ganar en su turno). Si el tablero
 * queda lleno sin linea, es empate.
 */
export function applyMove(state: C4State, col: number): C4State {
  const player = state.turn;
  const cells = state.cells.slice();
  const heights = state.heights.slice();

  const row = ROWS - 1 - heights[col];
  const cell = idx(row, col);
  cells[cell] = player;
  heights[col] = heights[col] + 1;

  const winningLine = winningLineAt(cells, row, col, player);
  const full = heights.every((h) => h >= ROWS);

  return {
    cells,
    heights,
    turn: winningLine ? player : otherPlayer(player),
    winner: winningLine ? player : null,
    winningLine,
    draw: !winningLine && full,
    lastMove: cell,
  };
}
