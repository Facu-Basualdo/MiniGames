/**
 * Logica pura del tablero de memoria, compartida por el modo solo y el modo
 * sala. Sin DOM ni red: el estado es serializable tal cual a jsonb
 * (room_match_state.state) y todas las transiciones son funciones puras que
 * devuelven un estado nuevo, asi cualquier cliente computa lo mismo.
 */

export interface MemoryReveal {
  /** Indices de las dos cartas del ultimo intento resuelto. */
  a: number;
  b: number;
  /** Quien se llevo el par, o null si no eran iguales. */
  matchedBy: string | null;
  /** Correlativo del intento, para que cada cliente anime cada reveal una vez. */
  seq: number;
}

export interface MemoryState {
  /** Id de par de cada carta (dos cartas comparten id), ya mezcladas. */
  cards: number[];
  /** Dueno de cada carta emparejada, o null si sigue boca abajo. */
  matchedBy: (string | null)[];
  /** Cartas boca arriba sin resolver: [] o [indice] (la segunda resuelve). */
  flipped: number[];
  /** Indice del jugador de turno dentro de turnOrder. */
  turn: number;
  turnOrder: string[];
  /** Ultimo intento resuelto, para animarlo en los clientes remotos. */
  reveal: MemoryReveal | null;
  /** Se incrementa con cada intento resuelto. */
  seq: number;
}

export interface BoardDims {
  cols: number;
  rows: number;
  pairs: number;
}

/** Tablero del modo solo (contrarreloj): 4x4 fijo. */
export const SOLO_DIMS: BoardDims = { cols: 4, rows: 4, pairs: 8 };

/** Tamano del tablero compartido segun jugadores registrados en la sala. */
export function boardDimsFor(playerCount: number): BoardDims {
  if (playerCount <= 2) return { cols: 4, rows: 4, pairs: 8 };
  if (playerCount <= 4) return { cols: 6, rows: 4, pairs: 12 };
  if (playerCount <= 6) return { cols: 6, rows: 5, pairs: 15 };
  return { cols: 6, rows: 6, pairs: 18 };
}

/** Baraja de `pairs` pares mezclada (Fisher-Yates). */
export function shuffledCards(pairs: number): number[] {
  const cards: number[] = [];
  for (let p = 0; p < pairs; p++) cards.push(p, p);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function createState(pairs: number, turnOrder: string[]): MemoryState {
  return {
    cards: shuffledCards(pairs),
    matchedBy: new Array<string | null>(pairs * 2).fill(null),
    flipped: [],
    turn: 0,
    turnOrder,
    reveal: null,
    seq: 0,
  };
}

export function currentPlayer(state: MemoryState): string {
  return state.turnOrder[state.turn];
}

/** Si `player` puede dar vuelta la carta `index` ahora mismo. */
export function canFlip(state: MemoryState, player: string, index: number): boolean {
  if (currentPlayer(state) !== player) return false;
  if (index < 0 || index >= state.cards.length) return false;
  if (state.matchedBy[index] !== null) return false;
  return !state.flipped.includes(index);
}

/**
 * Aplica un flip valido y devuelve el estado nuevo. La primera carta queda en
 * `flipped`; la segunda resuelve el intento en la misma transicion: par ->
 * ambas pasan a matchedBy[player] y el turno se conserva (regla clasica);
 * fallo -> el turno pasa al siguiente. `reveal` describe el intento para que
 * los clientes que lo reciban ya resuelto puedan animarlo igual.
 */
export function applyFlip(state: MemoryState, player: string, index: number): MemoryState {
  if (state.flipped.length === 0) {
    return { ...state, flipped: [index], reveal: null };
  }

  const first = state.flipped[0];
  const matched = state.cards[first] === state.cards[index];
  const matchedBy = [...state.matchedBy];
  if (matched) {
    matchedBy[first] = player;
    matchedBy[index] = player;
  }
  return {
    ...state,
    matchedBy,
    flipped: [],
    turn: matched ? state.turn : (state.turn + 1) % state.turnOrder.length,
    reveal: { a: first, b: index, matchedBy: matched ? player : null, seq: state.seq + 1 },
    seq: state.seq + 1,
  };
}

/** Salta el turno (jugador AFK): la carta a medio dar vuelta vuelve boca abajo. */
export function skipTurn(state: MemoryState): MemoryState {
  return {
    ...state,
    flipped: [],
    turn: (state.turn + 1) % state.turnOrder.length,
    reveal: null,
  };
}

/** Todos los pares encontrados. */
export function isComplete(state: MemoryState): boolean {
  return state.matchedBy.every((owner) => owner !== null);
}

/** Pares que se llevo un jugador. */
export function pairsOf(state: MemoryState, player: string): number {
  let cards = 0;
  for (const owner of state.matchedBy) if (owner === player) cards++;
  return cards / 2;
}
