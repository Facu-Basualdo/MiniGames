import { getSupabase } from "../supabase";
import type {
  RoomRow,
  RoomSettings,
  RoomState,
  RoundRow,
  RoundScoreRow,
  VoteRow,
} from "./types";

/**
 * CRUD fino sobre las tablas de salas. Mismo patron que leaderboard.ts: todo
 * es no-op / null si no hay credenciales Supabase, y los errores se loguean y
 * degradan (el caller decide que mostrar).
 *
 * Convencion de autoridad (no enforzada por la DB): solo el host llama a las
 * mutaciones de fase (startRound / closeRound / openVote / finishRoom); cada
 * jugador escribe solo sus propias filas (su score, su voto).
 */

/** Alfabeto sin caracteres ambiguos (sin O/0, sin I/1). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_PATTERN = /^[A-Z2-9]{6}$/;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Normaliza un codigo tipeado por el usuario (may/min, espacios). */
export function sanitizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

function warn(action: string, message: string): void {
  console.warn(`[rooms] ${action}: ${message}`);
}

/**
 * Crea la sala y registra al host como jugador. Reintenta ante colision de
 * codigo (PK). Devuelve el codigo, o null si fallo / no hay Supabase.
 */
export async function createRoom(host: string, settings: RoomSettings): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("rooms").insert({ code, host, settings });
    if (!error) {
      await supabase.from("room_players").upsert({ code, player: host });
      return code;
    }
    // 23505 = unique_violation (codigo ya usado): probar con otro.
    if (error.code !== "23505") {
      warn("createRoom", error.message);
      return null;
    }
  }
  warn("createRoom", "no se pudo generar un codigo libre");
  return null;
}

export type JoinResult = "ok" | "not-found" | "finished" | "spectator" | "error";

/** Devuelve true si el jugador ya esta registrado (room_players) en la sala. */
async function isRegistered(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  code: string,
  player: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("room_players")
    .select("player")
    .eq("code", code)
    .eq("player", player)
    .maybeSingle();
  return !!data;
}

/**
 * Une (o re-une: upsert sobre la PK) a un jugador a la sala. La validacion de
 * "nick ya conectado" es del lobby via presence, no de aca.
 *
 * Un jugador nuevo (no registrado) solo puede sumarse mientras la sala esta en
 * el lobby: si la partida ya arranco entra como espectador (no se registra en
 * room_players para no frenar el cierre de rondas ni contar en los puntajes),
 * y si ya termino se lo rechaza. Los ya registrados siempre reingresan.
 */
export async function joinRoom(code: string, player: string): Promise<JoinResult> {
  const supabase = getSupabase();
  if (!supabase) return "error";

  const { data, error } = await supabase
    .from("rooms")
    .select("status")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    warn("joinRoom", error.message);
    return "error";
  }
  if (!data) return "not-found";
  if (data.status !== "lobby" && !(await isRegistered(supabase, code, player))) {
    // Sala terminada pero viva ("Jugar otra vez"): los nuevos esperan a que
    // vuelva al lobby. Sala en juego: los nuevos entran como espectadores.
    return data.status === "finished" ? "finished" : "spectator";
  }

  const { error: joinError } = await supabase.from("room_players").upsert({ code, player });
  if (joinError) {
    warn("joinRoom", joinError.message);
    return "error";
  }
  return "ok";
}

/** Snapshot completo del estado durable de la sala (4 selects en paralelo). */
export async function fetchRoomState(code: string): Promise<RoomState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [roomRes, playersRes, roundsRes, scoresRes, votesRes] = await Promise.all([
    supabase.from("rooms").select("*").eq("code", code).maybeSingle(),
    supabase.from("room_players").select("player, joined_at").eq("code", code).order("joined_at"),
    supabase.from("room_rounds").select("round_no, game_id").eq("code", code).order("round_no"),
    supabase.from("room_round_scores").select("round_no, player, score, finished").eq("code", code),
    supabase.from("room_votes").select("round_no, player, game_id").eq("code", code),
  ]);

  const failed = [roomRes, playersRes, roundsRes, scoresRes, votesRes].find((r) => r.error);
  if (failed?.error) {
    warn("fetchRoomState", failed.error.message);
    return null;
  }
  if (!roomRes.data) return null;

  return {
    room: roomRes.data as RoomRow,
    players: ((playersRes.data ?? []) as { player: string }[]).map((r) => r.player),
    rounds: (roundsRes.data ?? []) as RoundRow[],
    scores: (scoresRes.data ?? []) as RoundScoreRow[],
    votes: (votesRes.data ?? []) as VoteRow[],
  };
}

/**
 * Reporta el puntaje del jugador en una ronda. Upsert idempotente: ante la
 * carrera muerte-vs-timeout el primer reporte del cliente gana (el caller
 * guarda un flag local y no vuelve a llamar).
 */
export async function reportScore(
  code: string,
  roundNo: number,
  player: string,
  score: number,
  finished: boolean,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  if (!Number.isFinite(score)) return false;

  const safeScore = Math.max(0, Math.min(score, 1e9 - 1));
  const { error } = await supabase
    .from("room_round_scores")
    .upsert({ code, round_no: roundNo, player, score: safeScore, finished });
  if (error) {
    warn("reportScore", error.message);
    return false;
  }
  return true;
}

/** Voto del jugador para el juego de la ronda roundNo (la proxima a jugar). */
export async function castVote(
  code: string,
  roundNo: number,
  player: string,
  gameId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("room_votes")
    .upsert({ code, round_no: roundNo, player, game_id: gameId });
  if (error) {
    warn("castVote", error.message);
    return false;
  }
  return true;
}

// ---------- Mutaciones de host ----------

/** Arranca la ronda roundNo con el juego dado y su deadline (null = sin tope). */
export async function startRound(
  code: string,
  roundNo: number,
  gameId: string,
  deadline: Date | null,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error: roundError } = await supabase
    .from("room_rounds")
    .upsert({ code, round_no: roundNo, game_id: gameId });
  if (roundError) {
    warn("startRound", roundError.message);
    return false;
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      status: "playing",
      current_round: roundNo,
      current_game: gameId,
      vote_options: null,
      deadline: deadline ? deadline.toISOString() : null,
    })
    .eq("code", code);
  if (error) {
    warn("startRound", error.message);
    return false;
  }
  return true;
}

/**
 * Abre la votacion de tiempo antes de una ronda: fija el juego de la ronda y
 * pasa a 'time_voting' con las opciones de tiempo (en segundos, como strings)
 * de candidatos. Al cerrarse, finishTimeVote arranca a jugar con el ganador.
 */
export async function startTimeVote(
  code: string,
  roundNo: number,
  gameId: string,
  options: string[],
  deadline: Date,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error: roundError } = await supabase
    .from("room_rounds")
    .upsert({ code, round_no: roundNo, game_id: gameId });
  if (roundError) {
    warn("startTimeVote", roundError.message);
    return false;
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      status: "time_voting",
      current_round: roundNo,
      current_game: gameId,
      vote_options: options,
      deadline: deadline.toISOString(),
    })
    .eq("code", code);
  if (error) {
    warn("startTimeVote", error.message);
    return false;
  }
  return true;
}

/** Cierra la votacion de tiempo: arranca a jugar con el tope votado (null = sin tope). */
export async function finishTimeVote(code: string, deadline: Date | null): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("rooms")
    .update({
      status: "playing",
      vote_options: null,
      deadline: deadline ? deadline.toISOString() : null,
    })
    .eq("code", code);
  if (error) {
    warn("finishTimeVote", error.message);
    return false;
  }
  return true;
}

/**
 * Adelanta (o cambia) el deadline de la ronda o votacion en curso. Se usa para
 * comprimir la votacion del proximo juego a pocos segundos cuando ya votaron
 * todos los presentes: no tiene sentido esperar el tope completo.
 */
export async function updateDeadline(code: string, deadline: Date): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("rooms")
    .update({ deadline: deadline.toISOString() })
    .eq("code", code);
  if (error) {
    warn("updateDeadline", error.message);
    return false;
  }
  return true;
}

/** Cierra la ronda en curso: pasa a la fase de resultados. */
export async function closeRound(code: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("rooms")
    .update({ status: "results", deadline: null })
    .eq("code", code);
  if (error) {
    warn("closeRound", error.message);
    return false;
  }
  return true;
}

/** Abre la votacion del proximo juego con los candidatos dados. */
export async function openVote(
  code: string,
  options: string[],
  deadline: Date,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("rooms")
    .update({ status: "voting", vote_options: options, deadline: deadline.toISOString() })
    .eq("code", code);
  if (error) {
    warn("openVote", error.message);
    return false;
  }
  return true;
}

/** Termina la sala: tablero final. */
export async function finishRoom(code: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("rooms")
    .update({ status: "finished", deadline: null, vote_options: null })
    .eq("code", code);
  if (error) {
    warn("finishRoom", error.message);
    return false;
  }
  return true;
}

/**
 * Cambia los ajustes de la sala en el lobby (solo el host, por convencion).
 * Permite elegir otros juegos / rondas / tiempo antes de cada partida,
 * incluida la revancha tras "Jugar otra vez".
 */
export async function updateSettings(code: string, settings: RoomSettings): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("rooms").update({ settings }).eq("code", code);
  if (error) {
    warn("updateSettings", error.message);
    return false;
  }
  return true;
}

/**
 * "Jugar otra vez": vuelve la sala al lobby con los mismos jugadores y ajustes,
 * borrando el historial de rondas/puntajes/votos para que los totales arranquen
 * de cero. Todos los clientes vuelven a /rooms/ al ver status='lobby'.
 */
export async function resetRoom(code: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const deletes = await Promise.all([
    supabase.from("room_rounds").delete().eq("code", code),
    supabase.from("room_round_scores").delete().eq("code", code),
    supabase.from("room_votes").delete().eq("code", code),
    supabase.from("room_match_state").delete().eq("code", code),
  ]);
  const failed = deletes.find((r) => r.error);
  if (failed?.error) {
    warn("resetRoom", failed.error.message);
    return false;
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      status: "lobby",
      current_round: 0,
      current_game: null,
      vote_options: null,
      deadline: null,
    })
    .eq("code", code);
  if (error) {
    warn("resetRoom", error.message);
    return false;
  }
  return true;
}

/**
 * El anfitrion expulsa a un jugador: borra su fila de room_players (y sus
 * puntajes/votos de la partida en curso, para que no cuente en los tableros).
 * El expulsado lo detecta al refrescar (ya no esta en state.players) y sale.
 */
export async function kickPlayer(code: string, player: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const deletes = await Promise.all([
    supabase.from("room_players").delete().eq("code", code).eq("player", player),
    supabase.from("room_round_scores").delete().eq("code", code).eq("player", player),
    supabase.from("room_votes").delete().eq("code", code).eq("player", player),
  ]);
  const failed = deletes.find((r) => r.error);
  if (failed?.error) {
    warn("kickPlayer", failed.error.message);
    return false;
  }
  return true;
}

/** Migracion de host: cualquier jugador toma el control si el host se fue. */
export async function takeOverHost(code: string, player: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("rooms").update({ host: player }).eq("code", code);
  if (error) {
    warn("takeOverHost", error.message);
    return false;
  }
  return true;
}
