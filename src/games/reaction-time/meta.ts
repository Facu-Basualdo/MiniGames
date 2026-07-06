import type { GameEntry } from "../../games";
import type { GameScoring } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "reaction-time",
  title: "Reflex",
  description: "Pon a prueba tus reflejos en este juego de 5 rondas. El puntaje final es tu tiempo de reacción promedio.",
  path: "/games/reaction-time/",
  accent: "#39ff14",
  category: "Reflejos",
  order: 60,
};

export const scoring: GameScoring = {
  direction: "lower",
  format: (n) => `${Math.round(n)} ms`,
};
