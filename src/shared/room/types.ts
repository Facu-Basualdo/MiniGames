/** Estado de una sala a lo largo de su vida. */
export type RoomStatus =
  | "lobby"
  | "playing"
  | "results"
  | "voting"
  | "time_voting"
  | "finished";

/** Ajustes elegidos por el host al crear la sala. */
export interface RoomSettings {
  /** Cantidad total de rondas (si hay playlist, es playlist.length). */
  totalRounds: number;
  /** Lista explicita de juegos en orden, o null para votar despues de cada ronda. */
  playlist: string[] | null;
  /** Tope de tiempo por ronda, en segundos. Cuando timeVote es true queda como
   * valor por defecto sin usar (el tope de cada ronda sale de una votacion). */
  roundTimeLimitSec: number;
  /** Si true, antes de cada juego se vota el tope de tiempo entre las opciones
   * de TIME_VOTE_OPTIONS. Opcional para compatibilidad con salas viejas. */
  timeVote?: boolean;
}

/** Fila de public.rooms tal como la devuelve Supabase. */
export interface RoomRow {
  code: string;
  host: string;
  status: RoomStatus;
  settings: RoomSettings;
  current_round: number;
  current_game: string | null;
  vote_options: string[] | null;
  /** timestamptz ISO del fin aproximado de la ronda o votacion en curso. */
  deadline: string | null;
  created_at: string;
}

/** Fila de public.room_rounds: que juego salio en cada ronda. */
export interface RoundRow {
  round_no: number;
  game_id: string;
}

/** Fila de public.room_round_scores. */
export interface RoundScoreRow {
  round_no: number;
  player: string;
  score: number;
  /** false = parcial reportado al vencer el tope de tiempo. */
  finished: boolean;
}

/** Fila de public.room_votes. */
export interface VoteRow {
  round_no: number;
  player: string;
  game_id: string;
}

/** Snapshot completo del estado durable de una sala. */
export interface RoomState {
  room: RoomRow;
  /** Nicknames registrados en la sala (room_players). */
  players: string[];
  rounds: RoundRow[];
  scores: RoundScoreRow[];
  votes: VoteRow[];
}

/** Valor de roundTimeLimitSec que significa "sin tope de tiempo por juego". */
export const NO_TIME_LIMIT = 0;
export const ROUND_TIME_LIMIT_OPTIONS = [60, 120, 180, NO_TIME_LIMIT] as const;
export const DEFAULT_ROUND_TIME_LIMIT = 120;

/** Opciones entre las que se vota el tope de tiempo cuando el anfitrion habilita
 * la votacion de tiempo (1 a 5 minutos y sin limite). */
export const TIME_VOTE_OPTIONS = [60, 120, 180, 240, 300, NO_TIME_LIMIT] as const;

/** Etiqueta legible del tope de tiempo por juego (o "Sin límite" si es 0). */
export function formatRoundTimeLimit(sec: number): string {
  return sec === NO_TIME_LIMIT ? "Sin límite" : `${sec / 60} min`;
}
export const DEFAULT_TOTAL_ROUNDS = 5;
export const TOTAL_ROUNDS_OPTIONS = [3, 5, 7] as const;
