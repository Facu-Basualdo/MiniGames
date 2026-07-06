/**
 * Simbolos de las cartas: figuras geometricas SVG inline (sin emojis, regla
 * del repo). Cada id de par tiene una forma unica y un color neon del ciclo,
 * asi los 18 pares posibles (tablero maximo 6x6) se distinguen a simple vista.
 */

const SHAPES: string[] = [
  '<circle cx="12" cy="12" r="7"/>',
  '<rect x="5.5" y="5.5" width="13" height="13" rx="2"/>',
  '<polygon points="12,4.5 20,19.5 4,19.5"/>',
  '<polygon points="12,3.5 20.5,12 12,20.5 3.5,12"/>',
  '<polygon points="12,3 14.7,9 21,9.6 16.2,13.8 17.7,20 12,16.6 6.3,20 7.8,13.8 3,9.6 9.3,9"/>',
  '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
  '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"/>',
  '<polygon points="13.5,3 5.5,13.5 11,13.5 10.5,21 18.5,10.5 13,10.5"/>',
  '<polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"/>',
  '<path d="M12 20.5S4 15 4 9.6C4 6.8 6.2 5 8.5 5c1.5 0 2.8.8 3.5 2 .7-1.2 2-2 3.5-2C17.8 5 20 6.8 20 9.6c0 5.4-8 10.9-8 10.9z"/>',
  '<path d="M14 3a9 9 0 1 0 7 14.5A9 9 0 0 1 14 3z"/>',
  '<polygon points="12,3.5 20,12.5 15,12.5 15,20.5 9,20.5 9,12.5 4,12.5"/>',
  '<path d="M6.2 4 12 9.8 17.8 4 20 6.2 14.2 12 20 17.8 17.8 20 12 14.2 6.2 20 4 17.8 9.8 12 4 6.2z"/>',
  '<path d="M4 6h16v3.5H4zM4 14.5h16V18H4z"/>',
  '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="8" cy="16" r="3"/><circle cx="16" cy="16" r="3"/>',
  '<path d="M4 14a8 8 0 0 1 16 0v2H4z"/>',
  '<polygon points="12,3 20.5,9.5 17.3,19.5 6.7,19.5 3.5,9.5"/>',
  '<path d="M6 4h12v3l-4.5 5L18 17v3H6v-3l4.5-5L6 7z"/>',
];

const SYMBOL_COLORS = ["#ffd24a", "#0ff8ff", "#ff3f81", "#39ff14", "#c084fc", "#ff8a3d"];

/** SVG completo del simbolo del par `pairId`, coloreado via currentColor. */
export function symbolSvg(pairId: number): string {
  const shape = SHAPES[pairId % SHAPES.length];
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${shape}</svg>`;
}

/** Color del simbolo del par `pairId`. */
export function symbolColor(pairId: number): string {
  return SYMBOL_COLORS[pairId % SYMBOL_COLORS.length];
}

/** Colores para identificar a cada jugador (borde de sus pares y marcador). */
export const PLAYER_COLORS = [
  "#ffd24a",
  "#0ff8ff",
  "#ff3f81",
  "#39ff14",
  "#c084fc",
  "#ff8a3d",
  "#4ec0e6",
  "#5ce1a6",
];
