export interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  /** Accent color used to theme the game's card on the landing page. */
  accent?: string;
}

export const games: GameEntry[] = [
  {
    id: "neon-cylinder",
    title: "Neon Cylinder Runner",
    description: "Esquiva las porciones que giran alrededor del cilindro neón y sobrevive el mayor tiempo posible.",
    path: "/games/neon-cylinder/",
    accent: "#ff00e6",
  },
  {
    id: "flappy-bird",
    title: "Flappy Bird",
    description: "Aletea para mantener al pájaro en el aire y cruza la mayor cantidad de tubos sin chocar.",
    path: "/games/flappy-bird/",
    accent: "#4ec0e6",
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    description: "Suelta cada bloque en el momento justo para apilar la torre más alta sin que se te escape.",
    path: "/games/stack-tower/",
    accent: "#5ce1a6",
  },
  {
    id: "rhythm-tap",
    title: "Rhythm Tap",
    description: "Toca las notas de colores justo al cruzar la línea, encadena combos y sobrevive sin quedarte sin vida.",
    path: "/games/rhythm-tap/",
    accent: "#ff3f81",
  },
  {
    id: "jump-ball",
    title: "Jump Ball",
    description: "Corre hacia el horizonte saltando solo entre plataformas y cambia de carril a tiempo para no caer al vacío.",
    path: "/games/jump-ball/",
    accent: "#ff8a3d",
  },
  {
    id: "reaction-time",
    title: "Reaction Time",
    description: "Pon a prueba tus reflejos en este juego de 5 rondas. El puntaje final es tu tiempo de reacción promedio.",
    path: "/games/reaction-time/",
    accent: "#39ff14",
  },
  {
    id: "city-bloxx",
    title: "City Bloxx",
    description: "Suelta cada piso desde la grúa en el momento justo y levanta el rascacielos más alto sin que el edificio pierda el equilibrio.",
    path: "/games/city-bloxx/",
    accent: "#d9843f",
  },
  {
    id: "sliding-puzzle",
    title: "Sliding Puzzle",
    description: "Ordena los numeros deslizando filas o columnas completas hacia el espacio vacio.",
    path: "/games/sliding-puzzle/",
    accent: "#0ff8ff",
  },
  {
    id: "asteroids",
    title: "Asteroids",
    description: "Navega con inercia, rota y dispara a rocas que se parten en este clásico juego de disparos espacial.",
    path: "/games/asteroids/",
    accent: "#ff3f81",
  },
  {
    id: "mini-frogger",
    title: "Mini Frogger",
    description: "Cruza calles transitadas y ríos saltando sobre troncos flotantes en el momento justo.",
    path: "/games/mini-frogger/",
    accent: "#39ff14",
  },
  {
    id: "odd-one-out",
    title: "Odd One Out",
    description: "Encuentra la ficha con el tono distinto antes de que se acabe el tiempo: la grilla crece y la diferencia se achica.",
    path: "/games/odd-one-out/",
    accent: "#c084fc",
  },
  {
    id: "kunai-throw",
    title: "Kunai Throw",
    description: "Arroja kunais y clávalos en el tronco que gira sin que un kunai golpee a otro.",
    path: "/games/kunai-throw/",
    accent: "#f5a623",
  },
];

