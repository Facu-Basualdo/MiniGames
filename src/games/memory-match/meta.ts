import type { GameEntry } from "../../games";
import { type GameScoring, formatTimeMoves } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "memory-match",
  title: "Memoria",
  description: "Encuentra los pares dando vuelta las cartas: contrarreloj en solitario, y por turnos sobre un tablero compartido en las salas.",
  path: "/games/memory-match/",
  accent: "#ffd24a",
  category: "Puzzle",
  order: 140,
};

export const scoring: GameScoring = {
  // Base "higher" (pares) para el modo sala. El modo solo usa un unico
  // ranking "lower" (variante "solo") que codifica tiempo + movimientos en un
  // numero (encodeTimeMoves): se ordena por tiempo y los movimientos
  // desempatan y se muestran al lado, igual que sliding-puzzle.
  direction: "higher",
  format: (n) => `${n} ${n === 1 ? "par" : "pares"}`,
  variants: ["solo"],
  variantDirection: { solo: "lower" },
  variantFormat: { solo: formatTimeMoves },
};
