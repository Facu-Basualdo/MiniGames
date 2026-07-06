/**
 * IA "dificil" para el modo solo: busqueda negamax con poda alfa-beta acotada en
 * profundidad, con una heuristica clasica de Conecta 4 en las hojas (puntua cada
 * "ventana" de 4 casillas segun cuantas fichas propias y libres tiene, penaliza
 * las amenazas rivales y premia el control del centro).
 *
 * Toma siempre la victoria inmediata y bloquea la amenaza directa del rival
 * dentro de su horizonte, pero es vencible planeando amenazas dobles, lo que
 * mantiene viva la racha de victorias del modo solo.
 */

import {
  applyMove,
  COLS,
  CONNECT,
  idx,
  legalMoves,
  otherPlayer,
  ROWS,
  type C4State,
  type Player,
} from "./logic";

/** Puntaje de una posicion ganada/perdida (lejos de cualquier heuristica). */
const WIN = 1_000_000;
/** Profundidad de busqueda: fuerte pero acotada para responder rapido. */
const DEPTH = 6;
/** Columna central: controlarla habilita mas lineas, asi que se explora primero. */
const CENTER = Math.floor(COLS / 2);
/** Orden de exploracion (centro hacia afuera): mejora la poda alfa-beta. */
const COL_ORDER = buildColumnOrder();

/** Todas las ventanas de 4 casillas contiguas del tablero (para la heuristica). */
const WINDOWS = buildWindows();

/** Elige la mejor columna para `ai` en el estado dado (se asume que hay jugadas). */
export function chooseMove(state: C4State, ai: Player): number {
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
  return COL_ORDER.filter((col) => moves.includes(col));
}

/**
 * Minimax con poda, siempre evaluado desde la perspectiva de `ai`. Los terminales
 * se ajustan por `depth` restante para preferir ganar cuanto antes y demorar las
 * derrotas lo mas posible.
 */
function search(state: C4State, ai: Player, depth: number, alpha: number, beta: number): number {
  if (state.winner !== null) {
    return state.winner === ai ? WIN + depth : -WIN - depth;
  }
  if (state.draw) return 0;
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
 * Heuristica de una posicion sin resolver: suma el aporte de cada ventana de 4
 * casillas (3 propias + 1 libre es amenaza fuerte, 2 propias potencial; las
 * ventanas rivales restan, con extra peso al bloqueo de 3), mas un bono por
 * cada ficha propia en la columna central.
 */
function evaluate(state: C4State, ai: Player): number {
  const opp = otherPlayer(ai);
  const cells = state.cells;
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    if (cells[idx(r, CENTER)] === ai) score += 3;
    else if (cells[idx(r, CENTER)] === opp) score -= 3;
  }

  for (const win of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const cell of win) {
      const owner = cells[cell];
      if (owner === ai) mine++;
      else if (owner === opp) theirs++;
    }
    if (mine > 0 && theirs === 0) {
      score += mine === 3 ? 8 : mine === 2 ? 3 : 1;
    } else if (theirs > 0 && mine === 0) {
      score -= theirs === 3 ? 10 : theirs === 2 ? 3 : 1;
    }
  }

  return score;
}

function buildColumnOrder(): number[] {
  const cols: number[] = [];
  for (let d = 0; d < COLS; d++) {
    const left = CENTER - d;
    const right = CENTER + d;
    if (d === 0) cols.push(CENTER);
    else {
      if (right < COLS) cols.push(right);
      if (left >= 0) cols.push(left);
    }
  }
  return cols;
}

function buildWindows(): number[][] {
  const windows: number[][] = [];
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const win: number[] = [];
        for (let k = 0; k < CONNECT; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) {
            win.length = 0;
            break;
          }
          win.push(idx(rr, cc));
        }
        if (win.length === CONNECT) windows.push(win);
      }
    }
  }
  return windows;
}
