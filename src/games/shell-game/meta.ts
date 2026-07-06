import type { GameEntry } from "../../games";
import type { GameScoring } from "../../shared/scoring-core";

export const meta: GameEntry = {
  id: "shell-game",
  title: "El Trile",
  description: "Sigue con la mirada el vaso que oculta la moneda. !Cada nivel mezcla mas rapido, hace mas pases y agrega mas vasos!",
  path: "/games/shell-game/",
  accent: "#ffdd53",
  category: "Reflejos",
  order: 210,
};

export const scoring: GameScoring = {
  direction: "higher",
  format: (n) => `Nivel ${n}`,
};
