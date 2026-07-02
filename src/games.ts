export interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  /** Accent color used to theme the game's card on the landing page. */
  accent?: string;
  /** Categoria para los filtros de la landing. */
  category: string;
}

/** Portada del juego generada por IA; si falta, la card muestra un fallback. */
export function coverUrl(gameId: string): string {
  return `/covers/${gameId}.jpg`;
}

export const games: GameEntry[] = [
  {
    id: "neon-cylinder",
    title: "Neon Vortex",
    description: "Esquiva las porciones que giran alrededor del cilindro neón y sobrevive el mayor tiempo posible.",
    path: "/games/neon-cylinder/",
    accent: "#ff00e6",
    category: "Arcade",
  },
  {
    id: "flappy-bird",
    title: "Flappy Bird",
    description: "Aletea para mantener al pájaro en el aire y cruza la mayor cantidad de tubos sin chocar.",
    path: "/games/flappy-bird/",
    accent: "#4ec0e6",
    category: "Arcade",
  },
  {
    id: "stack-tower",
    title: "Torre Infinita",
    description: "Suelta cada bloque en el momento justo para apilar la torre más alta sin que se te escape.",
    path: "/games/stack-tower/",
    accent: "#5ce1a6",
    category: "Precisión",
  },
  {
    id: "rhythm-tap",
    title: "Beat Fever",
    description: "Toca las notas de colores justo al cruzar la línea, encadena combos y sobrevive sin quedarte sin vida.",
    path: "/games/rhythm-tap/",
    accent: "#ff3f81",
    category: "Ritmo",
  },
  {
    id: "jump-ball",
    title: "Bounce Rush",
    description: "Corre hacia el horizonte saltando solo entre plataformas y cambia de carril a tiempo para no caer al vacío.",
    path: "/games/jump-ball/",
    accent: "#ff8a3d",
    category: "Arcade",
  },
  {
    id: "reaction-time",
    title: "Reflex",
    description: "Pon a prueba tus reflejos en este juego de 5 rondas. El puntaje final es tu tiempo de reacción promedio.",
    path: "/games/reaction-time/",
    accent: "#39ff14",
    category: "Reflejos",
  },
  {
    id: "city-bloxx",
    title: "Skyline",
    description: "Suelta cada piso desde la grúa en el momento justo y levanta el rascacielos más alto sin que el edificio pierda el equilibrio.",
    path: "/games/city-bloxx/",
    accent: "#d9843f",
    category: "Precisión",
  },
  {
    id: "sliding-puzzle",
    title: "Numerix",
    description: "Ordena los numeros deslizando filas o columnas completas hacia el espacio vacio.",
    path: "/games/sliding-puzzle/",
    accent: "#0ff8ff",
    category: "Puzzle",
  },
  {
    id: "asteroids",
    title: "Asteroides",
    description: "Navega con inercia, rota y dispara a rocas que se parten en este clásico juego de disparos espacial.",
    path: "/games/asteroids/",
    accent: "#ff3f81",
    category: "Arcade",
  },
  {
    id: "mini-frogger",
    title: "Cruce Mortal",
    description: "Cruza calles transitadas y ríos saltando sobre troncos flotantes en el momento justo.",
    path: "/games/mini-frogger/",
    accent: "#39ff14",
    category: "Arcade",
  },
  {
    id: "odd-one-out",
    title: "Odd One Out",
    description: "Encuentra la ficha con el tono distinto antes de que se acabe el tiempo: la grilla crece y la diferencia se achica.",
    path: "/games/odd-one-out/",
    accent: "#c084fc",
    category: "Reflejos",
  },
  {
    id: "kunai-throw",
    title: "Kunai Strike",
    description: "Arroja kunais y clávalos en el tronco que gira sin que un kunai golpee a otro.",
    path: "/games/kunai-throw/",
    accent: "#f5a623",
    category: "Precisión",
  },
  {
    id: "penalty-keeper",
    title: "Keepers!",
    description: "Sos el arquero en una tanda infinita de penales: movete y saltá para atajar. Tres goles y se termina.",
    path: "/games/penalty-keeper/",
    accent: "#38e07b",
    category: "Reflejos",
  },
];

