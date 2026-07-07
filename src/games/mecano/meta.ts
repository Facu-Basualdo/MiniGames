import type { GameEntry } from "../../games";

export const meta: GameEntry = {
  id: "mecano",
  title: "Mecano",
  description:
    "Juego de mecanografia: escribi la mayor cantidad de palabras en 30 segundos. El puntaje es tu velocidad en palabras por minuto.",
  path: "/games/mecano/",
  controls: "Escribí las palabras con el teclado. Espacio confirma cada palabra.",
  accent: "#a5b4fc",
  category: "Reflejos",
  order: 275,
};

// Scoring is the default { direction: "higher" } (more PPM is better), so no
// `export const scoring` is needed here.
