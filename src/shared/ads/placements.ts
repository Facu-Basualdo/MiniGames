// Ubicaciones de anuncios por pagina, definidas a mano con la herramienta visual
// adPicker (?adpick=1) y volcadas aca. Un montador generico (mountPlacements) las
// coloca como recuadros de posicion fija en cada pagina.
//
// Responsividad: cada ubicacion tiene un `minViewport`. Por debajo de ese ancho el
// anuncio se oculta (los gutters se achican y taparia el juego). Las verticales se
// centran vertical; los banners horizontales se centran horizontal.

import { AD_SLOTS, adsActive, createAdSlot } from "./ads";

type SlotKey = keyof typeof AD_SLOTS;
type Anchor = "left" | "right" | "top" | "bottom";

interface AdPlacement {
  slot: SlotKey;
  format: "vertical" | "horizontal";
  anchor: Anchor;
  gap: number; // px desde el borde anclado
  width: number;
  height: number;
  minViewport: number; // se oculta por debajo de este ancho
}

const RAIL_GAP = 16;

// Rascacielos vertical de 160px de ancho (gutter angosto).
function railN(anchor: "left" | "right", minViewport = 1280): AdPlacement {
  return {
    slot: anchor === "left" ? "railLeft" : "railRight",
    format: "vertical",
    anchor,
    gap: RAIL_GAP,
    width: 160,
    height: 600,
    minViewport,
  };
}

// Rascacielos ancho de 300px (gutter amplio).
function railW(anchor: "left" | "right", minViewport = 1500): AdPlacement {
  return {
    slot: anchor === "left" ? "railLeft" : "railRight",
    format: "vertical",
    anchor,
    gap: RAIL_GAP,
    width: 300,
    height: 600,
    minViewport,
  };
}

// Banner horizontal 728x90 centrado, arriba o abajo.
function banner(anchor: "top" | "bottom"): AdPlacement {
  return {
    slot: anchor === "top" ? "bannerTop" : "bannerBottom",
    format: "horizontal",
    anchor,
    gap: RAIL_GAP,
    width: 728,
    height: 90,
    minViewport: 1024,
  };
}

// Clave "landing" para la home; el resto es el id del juego (carpeta bajo games/).
export const PLACEMENTS: Record<string, AdPlacement[]> = {
  // El landing tiene contenido de 1180px centrado: los rieles de 160 solo entran
  // en pantallas anchas, por eso el minViewport mas alto.
  landing: [railN("left", 1520), railN("right", 1520)],

  "western-shoot": [railW("left"), railW("right"), banner("top"), banner("bottom")],
  "flappy-bird": [railW("left"), railW("right")],
  "stack-tower": [railW("left"), railW("right")],
  "rhythm-tap": [railW("left"), railW("right")],
  "jump-ball": [railW("left"), railW("right")],
  "helix-jump": [railN("left"), railN("right")],
  "city-bloxx": [railW("left"), railW("right")],
  "sliding-puzzle": [railN("left"), railN("right")],
  "mini-frogger": [railW("left"), railW("right")],
  "odd-one-out": [railW("left"), railW("right")],
  "dunk-shot": [railW("left"), railW("right")],
  "memory-match": [railW("left"), railW("right")],
  "kunai-throw": [railW("left"), railW("right")],
  "shell-game": [railW("left"), railW("right"), banner("bottom")],
  "block-paddle": [railW("left"), railW("right")],
  simon: [railW("left"), railW("right")],
  snake: [railN("left"), railN("right")],
  "whack-a-mole": [railN("left"), railN("right"), banner("bottom")],
  "tic-tac-toe": [railW("left"), railW("right")],
  "connect-four": [railW("left"), railW("right")],
  "typing-race": [railN("left"), railN("right")],
  "neon-sawblades": [railW("left"), railW("right")],
  "tower-of-hanoi": [railW("left"), railW("right")],
  "lights-out": [railW("left"), railW("right")],
};

function pageKey(): string | null {
  const p = location.pathname;
  if (p === "/" || p === "" || p === "/index.html") return "landing";
  const m = p.match(/\/games\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Monta los anuncios configurados para la pagina actual. No-op sin publicidad. */
export function mountPlacements(): void {
  if (!adsActive()) return;
  const key = pageKey();
  if (!key) return;
  const list = PLACEMENTS[key];
  if (!list) return;

  for (const p of list) {
    const el = createAdSlot({ slot: AD_SLOTS[p.slot], format: p.format, className: "ad-place" });
    if (!el) continue;

    el.style.position = "fixed";
    el.style.zIndex = "5";
    el.style.width = `${p.width}px`;
    el.style.height = `${p.height}px`;
    if (p.anchor === "left" || p.anchor === "right") {
      el.style[p.anchor] = `${p.gap}px`;
      el.style.top = "50%";
      el.style.transform = "translateY(-50%)";
    } else {
      el.style[p.anchor] = `${p.gap}px`;
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
    }

    // Ocultar por debajo del ancho minimo para no tapar el juego.
    const mq = window.matchMedia(`(min-width: ${p.minViewport}px)`);
    const apply = (): void => {
      // "" restaura el display del CSS (block real, o flex del placeholder).
      el.style.display = mq.matches ? "" : "none";
    };
    apply();
    mq.addEventListener("change", apply);

    document.body.append(el);
  }
}
