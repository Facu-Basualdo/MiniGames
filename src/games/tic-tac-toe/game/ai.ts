/**
 * IA "dificil" para el modo solo: busqueda negamax con poda alfa-beta sobre la
 * variante ciclica. Como no hay empates, el arbol podria no terminar nunca por
 * si solo, asi que la busqueda esta acotada en profundidad y usa una heuristica
 * en las hojas. Igualmente juega fuerte: siempre toma la victoria inmediata,
 * bloquea la amenaza rival y prefiere las jugadas que arman doble amenaza.
 *
 * Es fuerte pero vencible con planeo (dobles amenazas), lo que mantiene viva la
 * racha de victorias del modo solo.
 */

import {
  applyMove,
  legalMoves,
  LINES,
  otherPlayer,
  type Player,
  type TttState,
} from "./logic";

/** Puntaje de una posicion ganada/perdida (lejos de cualquier heuristica). */
const WIN = 1_000_000;
/** Profundidad de busqueda: alta para jugar duro, acotada para responder rapido. */
const DEPTH = 8;
/** Orden de exploracion (centro, esquinas, lados): mejora la poda alfa-beta. */
const MOVE_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];

/** Elige la mejor casilla para `ai` en el estado dado (se asume que hay jugadas). */
export function chooseMove(state: TttState, ai: Player): number {
  const moves = orderMoves(legalMoves(state));
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = search(applyMove(state, move), ai, DEPTH - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function orderMoves(moves: number[]): number[] {
  return MOVE_ORDER.filter((cell) => moves.includes(cell));
}

/**
 * Minimax con poda, siempre evaluado desde la perspectiva de `ai`. `depth` es la
 * profundidad restante; los terminales se ajustan por `depth` para preferir
 * ganar cuanto antes y demorar las derrotas lo mas posible.
 */
function search(state: TttState, ai: Player, depth: number, alpha: number, beta: number): number {
  if (state.winner !== null) {
    return state.winner === ai ? WIN + depth : -WIN - depth;
  }
  if (depth === 0) return evaluate(state, ai);

  const moves = orderMoves(legalMoves(state));
  const maximizing = state.turn === ai;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const value = search(applyMove(state, move), ai, depth - 1, alpha, beta);
    if (maximizing) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Heuristica de una posicion sin resolver: suma el control de cada linea. Una
 * linea con 2 fichas propias (y ninguna rival) es una amenaza fuerte; con 1 es
 * potencial. Las lineas rivales restan igual. Un pequeno bono por el centro.
 */
function evaluate(state: TttState, ai: Player): number {
  const opp = otherPlayer(ai);
  let score = 0;

  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const cell of line) {
      if (state.cells[cell] === ai) mine++;
      else if (state.cells[cell] === opp) theirs++;
    }
    if (mine > 0 && theirs === 0) score += mine === 2 ? 12 : 1;
    else if (theirs > 0 && mine === 0) score -= theirs === 2 ? 12 : 1;
  }

  if (state.cells[4] === ai) score += 3;
  else if (state.cells[4] === opp) score -= 3;

  return score;
}
