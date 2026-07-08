import { getSupabase } from "./supabase";
import { getScoring, getDirection } from "./scoring";
import { games } from "../games";

/**
 * "Salón de la fama": ranking de quienes son #1 (líder) en el ranking global de
 * más juegos. Es un valor DERIVADO en vivo de la tabla `scores` (los mismos
 * rankings que muestran las cards), no un contador persistente: por cada juego
 * del roster se toma su líder actual (dirección/variante como en la card) y se
 * cuenta cuántos juegos lidera cada jugador. Sin credenciales devuelve vacío y
 * la sección no aparece.
 */

export interface LeaderRow {
  player: string;
  /** Cantidad de juegos que este jugador lidera (es #1 del ranking). */
  games: number;
}

export interface GameLeaders {
  ranking: LeaderRow[];
  /** Total de juegos que tienen al menos un líder (un puntaje cargado). */
  totalGames: number;
}

interface ScoreRow {
  game_id: string;
  variant: string | null;
  player: string;
  score: number;
}

const PAGE = 1000;

/**
 * Trae todos los puntajes (paginado, por si superan el tope de 1000 filas de
 * Supabase) y calcula el ranking de líderes. Una sola pasada de datos: para cada
 * juego del roster se busca el mejor puntaje de su tablero representativo
 * (variante `variants[0]`, dirección incluida) y se suma a su dueño.
 */
export async function fetchGameLeaders(): Promise<GameLeaders> {
  const supabase = getSupabase();
  if (!supabase) return { ranking: [], totalGames: 0 };

  const all: ScoreRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("scores")
      .select("game_id, variant, player, score")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as ScoreRow[]));
    if (data.length < PAGE) break;
  }
  if (all.length === 0) return { ranking: [], totalGames: 0 };

  // Agrupa por juego una sola vez para no recorrer todo por cada juego.
  const byGame = new Map<string, ScoreRow[]>();
  for (const row of all) {
    const list = byGame.get(row.game_id);
    if (list) list.push(row);
    else byGame.set(row.game_id, [row]);
  }

  const tally = new Map<string, number>();
  let totalGames = 0;

  for (const game of games) {
    const rows = byGame.get(game.id);
    if (!rows) continue;

    // Tablero representativo del juego (el que muestra la card): la 1.a variante,
    // o el tablero sin variante ("") para los juegos que no las tienen.
    const variant0 = getScoring(game.id).variants?.[0];
    const board = variant0 ?? "";
    const lower = getDirection(game.id, variant0) === "lower";

    let best: ScoreRow | null = null;
    for (const row of rows) {
      if ((row.variant ?? "") !== board) continue;
      if (!best || (lower ? row.score < best.score : row.score > best.score)) best = row;
    }
    if (!best) continue;

    totalGames++;
    tally.set(best.player, (tally.get(best.player) ?? 0) + 1);
  }

  const ranking = [...tally.entries()]
    .map(([player, count]) => ({ player, games: count }))
    .sort((a, b) => b.games - a.games || (a.player < b.player ? -1 : 1));

  return { ranking, totalGames };
}
