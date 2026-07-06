import type { GameEntry } from "../../games";
import { type GameScoring, formatTimeMoves } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "sliding-puzzle",
  title: "Numerix",
  description: "Ordena los numeros deslizando filas o columnas completas hacia el espacio vacio.",
  path: "/games/sliding-puzzle/",
  accent: "#0ff8ff",
  category: "Puzzle",
  order: 80,
};

export const scoring: GameScoring = {
  // El ranking se ordena por tiempo (menor mejor). Cada puntaje codifica el
  // tiempo y los movimientos en un solo numero (ver encodeTimeMoves): el
  // tiempo manda el orden y los movimientos desempatan / se muestran al lado.
  direction: "lower",
  variants: ["3", "4", "5"],
  variantLabel: (v) => `${v}x${v}`,
  format: formatTimeMoves,
};
