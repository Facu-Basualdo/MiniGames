import { getSupabase } from "./supabase";
import { getDirection } from "./scoring";
import { getNickname } from "./nickname";

export interface ScoreRow {
  player: string;
  score: number;
  created_at: string;
}

interface SubmitOpts {
  variant?: string;
  /** Nombre a usar (si no, se toma el guardado en localStorage). */
  player?: string;
}

interface FetchOpts {
  variant?: string;
  limit?: number;
}

/**
 * Envia un puntaje al ranking global. No-op silencioso si no hay credenciales
 * Supabase o si el jugador todavia no eligio un nickname. Devuelve true si se
 * inserto la fila.
 */
export async function submitScore(
  gameId: string,
  score: number,
  opts: SubmitOpts = {},
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  if (!Number.isFinite(score)) return false;

  const player = opts.player ?? getNickname();
  if (!player) return false;

  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    variant: opts.variant ?? "",
    player,
    score,
  });

  if (error) {
    console.warn("[leaderboard] no se pudo enviar el puntaje:", error.message);
    return false;
  }
  return true;
}

/**
 * Trae el Top N del ranking de un juego (y variante). El orden depende de la
 * direccion configurada del juego (menor mejor para reaction-time / sliding).
 * Devuelve [] si no hay credenciales o si falla.
 */
export async function fetchTop(
  gameId: string,
  opts: FetchOpts = {},
): Promise<ScoreRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const ascending = getDirection(gameId, opts.variant) === "lower";
  const limit = opts.limit ?? 10;

  const { data, error } = await supabase
    .from("scores")
    .select("player, score, created_at")
    .eq("game_id", gameId)
    .eq("variant", opts.variant ?? "")
    .order("score", { ascending })
    .limit(limit);

  if (error) {
    console.warn("[leaderboard] no se pudo leer el ranking:", error.message);
    return [];
  }
  return (data as ScoreRow[]) ?? [];
}
