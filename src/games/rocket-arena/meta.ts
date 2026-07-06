import type { GameEntry } from "../../games";
import type { GameScoring } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "rocket-arena",
  title: "Rocket SpaceX",
  description: "Fútbol de autos en 3D estilo Rocket League: 2v2 con bots, o en salas con los autos de todos en vivo.",
  path: "/games/rocket-arena/",
  accent: "#3ba7ff",
  category: "Carreras",
  order: 170,
  // Oculto temporalmente por errores: no aparece en la landing ni en las salas.
  hidden: true,
};

export const scoring: GameScoring = {
  direction: "higher",
  format: (n) => `${n} ${n === 1 ? "gol" : "goles"}`,
};
