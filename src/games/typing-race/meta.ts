import type { GameEntry } from "../../games";

export const meta: GameEntry = {
  id: "typing-race",
  title: "Mecano",
  description:
    "Juego de mecanografia: escribi la mayor cantidad de palabras en 30 segundos. El puntaje es tu velocidad en palabras por minuto.",
  path: "/games/typing-race/",
  accent: "#a5b4fc",
  category: "Reflejos",
  order: 270,
};

// Scoring is the default { direction: "higher" } (more PPM is better), so no
// `export const scoring` is needed here.
