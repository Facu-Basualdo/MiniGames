// Monta los anuncios configurados para la pagina actual (landing o juego). Modulo
// de side-effect: lo inyecta el plugin de Vite injectGameAds en cada pagina. Sin
// publicidad configurada o sin ubicaciones para la pagina, es un no-op.

import { mountPlacements } from "./placements";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPlacements);
} else {
  mountPlacements();
}
