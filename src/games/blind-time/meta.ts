import type { GameEntry } from "../../games";
import type { GameScoring } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "blind-time",
  title: "Crono Ciego",
  description: "Detén el cronómetro a ciegas lo más cerca posible del tiempo objetivo asignado.",
  path: "/games/blind-time/",
  accent: "#ffdd53",
  category: "Precisión",
  order: 200,
};

export const scoring: GameScoring = {
  direction: "lower",
  format: (n) => `${Math.round(n)} ms`,
};
