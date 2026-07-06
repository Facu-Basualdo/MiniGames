import { getSupabase } from "./supabase";

/**
 * Popularidad de los juegos: un contador de partidas por juego en Supabase que
 * ordena las cards de la landing (mas jugados primero). Degrada con gracia: sin
 * credenciales `recordPlay` es no-op y `fetchPlayCounts` devuelve {} (la landing
 * cae al orden manual por `order`).
 */

const CACHE_KEY = "mg:play-counts";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Suma una partida al contador de popularidad del juego. Fire-and-forget: usa
 * `fetch` con `keepalive` para que el POST sobreviva a la navegacion a la pagina
 * del juego (la card es un <a> que navega en el mismo gesto). No-op sin
 * credenciales Supabase.
 */
export function recordPlay(gameId: string): void {
  if (!url || !anonKey) return;
  try {
    void fetch(`${url}/rest/v1/rpc/increment_game_plays`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_game_id: gameId }),
      keepalive: true,
    });
  } catch {
    // Solo es telemetria de popularidad; nunca debe romper la navegacion.
  }
}

/**
 * Trae el conteo de partidas por juego ({ [gameId]: plays }). Cachea el
 * resultado en localStorage para que la proxima carga ordene sin parpadeo.
 * Devuelve {} si no hay credenciales o si falla.
 */
export async function fetchPlayCounts(): Promise<Record<string, number>> {
  const supabase = getSupabase();
  if (!supabase) return {};

  const { data, error } = await supabase.from("game_plays").select("game_id, plays");
  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data as { game_id: string; plays: number }[]) {
    counts[row.game_id] = Number(row.plays) || 0;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(counts));
  } catch {
    // localStorage lleno o bloqueado: seguimos sin cache.
  }
  return counts;
}

/** Ultimo conteo conocido (localStorage) para ordenar sincronicamente al cargar. */
export function cachedPlayCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}
