// Rieles verticales de publicidad a los costados del area de juego.
//
// Modulo de side-effect: se auto-monta al cargar (lo inyecta el plugin de Vite
// injectGameAds en cada games/*/index.html, ver vite.config.ts). No hay que
// importarlo desde ningun juego.
//
// Solo se montan en juegos con TABLERO CENTRADO que dejan gutters reales a los
// costados en desktop ancho (allowlist RAIL_GAMES). Los juegos con canvas a
// pantalla completa (3D/arcade y algunos 2D como snake) quedan fuera: los rieles
// taparian el area de juego. El CSS los oculta por debajo de 1300px (mobile /
// pantallas angostas) para no pisar el tablero.

import { createAdSlot, adsActive, AD_SLOTS } from "./ads";

// Juegos de tablero DOM centrado con espacio a los costados. Facil de ampliar:
// agregar el id del juego (el nombre de la carpeta bajo games/).
const RAIL_GAMES = new Set<string>([
  "tic-tac-toe",
  "connect-four",
  "simon",
  "lights-out",
  "memory-match",
  "sliding-puzzle",
  "whack-a-mole",
  "shell-game",
  "tower-of-hanoi",
  "odd-one-out",
]);

function currentGameId(): string | null {
  const m = location.pathname.match(/\/games\/([^/]+)\//);
  return m ? m[1] : null;
}

function mount(): void {
  if (!adsActive()) return;
  const id = currentGameId();
  if (!id || !RAIL_GAMES.has(id)) return;

  const left = createAdSlot({
    slot: AD_SLOTS.gameRailLeft,
    format: "vertical",
    className: "ad-rail ad-rail--left",
  });
  const right = createAdSlot({
    slot: AD_SLOTS.gameRailRight,
    format: "vertical",
    className: "ad-rail ad-rail--right",
  });
  if (left) document.body.append(left);
  if (right) document.body.append(right);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
