export interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  /** Accent color used to theme the game's card on the landing page. */
  accent?: string;
  /** Categoria para los filtros de la landing. */
  category: string;
  /** Orden en la landing (menor primero). Sin valor va al final, alfabetico por titulo. */
  order?: number;
  /** Ocultar del roster sin borrar la entrada (landing y salas). El juego sigue en el repo. */
  hidden?: boolean;
}

/** Portada del juego generada por IA; si falta, la card muestra un fallback. */
export function coverUrl(gameId: string): string {
  return `/covers/${gameId}.jpg`;
}

// Registro auto-descubierto: cada juego declara su propia metadata en
// src/games/<id>/meta.ts y este glob la junta. Agregar un juego no requiere
// tocar este archivo (principio Open/Closed), lo que evita conflictos de merge.
const modules = import.meta.glob<{ meta: GameEntry }>("./games/*/meta.ts", {
  eager: true,
});

export const games: GameEntry[] = Object.values(modules)
  .map((m) => m.meta)
  .filter((g) => !g.hidden)
  .sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title),
  );
