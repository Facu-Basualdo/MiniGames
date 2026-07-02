/** Direccion de orden del ranking: mayor puntaje mejor, o menor mejor. */
export type Direction = "higher" | "lower";

export interface GameScoring {
  /** "higher" = mayor puntaje mejor (default de la mayoria de los juegos). */
  direction: Direction;
  /** Formatea el puntaje para mostrarlo (p.ej. reaction-time -> "213 ms"). */
  format?: (score: number) => string;
  /** Variantes independientes de ranking (p.ej. tamanos de sliding-puzzle). */
  variants?: string[];
  /** Etiqueta legible de cada variante para el selector de la landing. */
  variantLabel?: (variant: string) => string;
  /**
   * Direccion por variante, cuando distintas variantes se ordenan distinto que
   * el juego base. Ej: memory-match usa "higher" (pares) en modo sala, pero sus
   * rankings solo de tiempo y movimientos son "lower". Si falta una variante,
   * se usa `direction`.
   */
  variantDirection?: Record<string, Direction>;
  /** Formato por variante (mismo criterio que variantDirection). */
  variantFormat?: Record<string, (score: number) => string>;
}

/**
 * Configuracion de ranking por juego. La clave es el `id` de src/games.ts.
 * Todo juego que envie puntajes debe tener una entrada aca.
 */
export const GAME_SCORING: Record<string, GameScoring> = {
  "neon-cylinder": { direction: "higher" },
  "flappy-bird": { direction: "higher" },
  "stack-tower": { direction: "higher" },
  "rhythm-tap": { direction: "higher" },
  "jump-ball": { direction: "higher" },
  "city-bloxx": { direction: "higher" },
  "asteroids": { direction: "higher" },
  "mini-frogger": { direction: "higher" },
  "kunai-throw": { direction: "higher" },
  "odd-one-out": { direction: "higher" },
  "penalty-keeper": { direction: "higher" },
  "memory-match": {
    // Base "higher" (pares) para el modo sala. El modo solo usa un unico
    // ranking "lower" (variante "solo") que codifica tiempo + movimientos en un
    // numero (encodeTimeMoves): se ordena por tiempo y los movimientos
    // desempatan y se muestran al lado, igual que sliding-puzzle.
    direction: "higher",
    format: (n) => `${n} ${n === 1 ? "par" : "pares"}`,
    variants: ["solo"],
    variantDirection: { solo: "lower" },
    variantFormat: { solo: formatTimeMoves },
  },
  "reaction-time": {
    direction: "lower",
    format: (n) => `${Math.round(n)} ms`,
  },
  "car-race": {
    direction: "lower",
    format: (n) => {
      const m = Math.floor(n / 60000);
      const s = Math.floor((n % 60000) / 1000);
      const cs = Math.floor((n % 1000) / 10);
      return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    },
  },
  "rocket-arena": {
    direction: "higher",
    format: (n) => `${n} ${n === 1 ? "gol" : "goles"}`,
  },
  "sliding-puzzle": {
    // El ranking se ordena por tiempo (menor mejor). Cada puntaje codifica el
    // tiempo y los movimientos en un solo numero (ver encodeTimeMoves): el
    // tiempo manda el orden y los movimientos desempatan / se muestran al lado.
    direction: "lower",
    variants: ["3", "4", "5"],
    variantLabel: (v) => `${v}x${v}`,
    format: formatTimeMoves,
  },
};

/**
 * Codifica tiempo (centisegundos) y movimientos en un unico puntaje para poder
 * ordenar un ranking por tiempo sin cambiar el esquema de la tabla:
 * `centisegundos * BASE + movimientos`. Como el tiempo ocupa la parte alta del
 * numero, ordenar ascendente ("lower") ordena por tiempo y usa los movimientos
 * como desempate. Los movimientos se topean por debajo de BASE. Compartido por
 * sliding-puzzle y memory-match (modo solo).
 */
const TIME_MOVES_BASE = 100000;

export function encodeTimeMoves(seconds: number, moves: number): number {
  const centis = Math.max(0, Math.round(seconds * 100));
  const clampedMoves = Math.min(Math.max(0, Math.round(moves)), TIME_MOVES_BASE - 1);
  return centis * TIME_MOVES_BASE + clampedMoves;
}

export function formatTimeMoves(encoded: number): string {
  const centis = Math.floor(encoded / TIME_MOVES_BASE);
  const moves = encoded % TIME_MOVES_BASE;
  return `${formatClock(centis)} - ${moves} mov`;
}

/** Devuelve la config de un juego, con default seguro si no esta declarado. */
export function getScoring(gameId: string): GameScoring {
  return GAME_SCORING[gameId] ?? { direction: "higher" };
}

/** Direccion de orden de un juego (o de una variante concreta si difiere). */
export function getDirection(gameId: string, variant?: string): Direction {
  const s = getScoring(gameId);
  if (variant && s.variantDirection && variant in s.variantDirection) {
    return s.variantDirection[variant];
  }
  return s.direction;
}

/** Formatea un puntaje segun la config del juego (y variante si aplica). */
export function formatScore(gameId: string, score: number, variant?: string): string {
  const s = getScoring(gameId);
  const fmt = (variant && s.variantFormat?.[variant]) ?? s.format;
  return fmt ? fmt(score) : String(score);
}

/** "1:23.45" a partir de centisegundos (minutos:segundos.centesimas). */
export function formatClock(centiseconds: number): string {
  const cs = Math.max(0, Math.round(centiseconds));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}
