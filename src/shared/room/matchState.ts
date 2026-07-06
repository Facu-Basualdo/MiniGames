import { getSupabase } from "../supabase";

/**
 * Estado de partida compartido (public.room_match_state): una fila jsonb por
 * (sala, ronda) para juegos donde todos ven el mismo tablero (p.ej. Memoria).
 * Mismo patron que api.ts: no-op / null sin credenciales, errores logueados.
 *
 * Concurrencia optimista: cada escritura pasa la version que leyo; el UPDATE
 * lleva eq("version", esperada) e incrementa. Si otro escribio antes, el
 * update no matchea filas y el caller debe refetchear y reintentar (o
 * descartar su movimiento). Por convencion escribe solo el jugador de turno,
 * mas el host para destrabar turnos AFK.
 */

export interface MatchStateRow<S> {
  state: S;
  version: number;
}

function warn(action: string, message: string): void {
  console.warn(`[rooms] ${action}: ${message}`);
}

/** Lee el estado de la partida de una ronda, o null si (aun) no existe. */
export async function fetchMatchState<S>(
  code: string,
  roundNo: number,
): Promise<MatchStateRow<S> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("room_match_state")
    .select("state, version")
    .eq("code", code)
    .eq("round_no", roundNo)
    .maybeSingle();
  if (error) {
    warn("fetchMatchState", error.message);
    return null;
  }
  return data ? { state: data.state as S, version: data.version as number } : null;
}

/**
 * Crea el estado inicial de la ronda (lo hace el host al cargar). Ante la
 * carrera host-viejo vs host-nuevo gana el primer insert: el conflicto de PK
 * no es un error, devuelve false y el caller refetchea.
 */
export async function createMatchState<S>(
  code: string,
  roundNo: number,
  state: S,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("room_match_state")
    .insert({ code, round_no: roundNo, state });
  if (error) {
    // 23505 = unique_violation: otro cliente ya creo el tablero.
    if (error.code !== "23505") warn("createMatchState", error.message);
    return false;
  }
  return true;
}

/**
 * Escribe el estado si nadie escribio desde que se leyo expectedVersion.
 * Devuelve false ante conflicto (0 filas afectadas) o error: refetchear.
 */
export async function updateMatchState<S>(
  code: string,
  roundNo: number,
  state: S,
  expectedVersion: number,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("room_match_state")
    .update({ state, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq("code", code)
    .eq("round_no", roundNo)
    .eq("version", expectedVersion)
    .select("version");
  if (error) {
    warn("updateMatchState", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
