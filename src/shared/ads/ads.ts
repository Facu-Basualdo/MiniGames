// Publicidad (Google AdSense) para el landing y los juegos.
//
// Infra cross-cutting, del mismo tipo que src/shared/ (ranking) y src/shared/room/.
// Se controla por variables de entorno y DEGRADA A NADA: sin credenciales el sitio
// se comporta exactamente igual que sin este modulo (createAdSlot devuelve null y no
// se carga ningun script externo).
//
// - VITE_ADSENSE_CLIENT: sobreescribe el publisher id (por defecto ADSENSE_CLIENT,
//   ver client.ts). Normalmente no hace falta setearla.
// - VITE_ADS_PLACEHOLDER: "1" para previsualizar los espacios con un placeholder
//   visible en desarrollo.
//
// El loader de AdSense se inyecta en el <head> de cada pagina en build (plugin
// injectGameAds en vite.config.ts), que es lo que AdSense pide para verificar el
// sitio y correr Auto ads. Para los anuncios manuales (banner del landing y rieles)
// hace falta pegar los data-ad-slot de cada unidad en AD_SLOTS (abajo); hasta
// entonces esas ubicaciones no renderizan nada (salvo en modo placeholder).

import { ADSENSE_CLIENT } from "./client";

const CLIENT = ((import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? "").trim() || ADSENSE_CLIENT || null;
const PLACEHOLDER = (import.meta.env.VITE_ADS_PLACEHOLDER as string | undefined) === "1";

// data-ad-slot de cada ubicacion. Vacios hasta crear las unidades en AdSense.
// No son secretos (van en el HTML del cliente), por eso son constantes y no env vars.
// Mientras esten vacios, createAdSlot muestra un placeholder en vez de un hueco roto.
export const AD_SLOTS = {
  landingBanner: "", // TODO: pegar el data-ad-slot del banner del landing
  gameRailLeft: "", // TODO: pegar el data-ad-slot del riel izquierdo
  gameRailRight: "", // TODO: pegar el data-ad-slot del riel derecho
} as const;

/** Hay anuncios reales configurados (publisher id presente). */
export function isAdsEnabled(): boolean {
  return Boolean(CLIENT);
}

/** Se debe renderizar algo (anuncio real o placeholder de preview). */
export function adsActive(): boolean {
  return Boolean(CLIENT) || PLACEHOLDER;
}

let cssInjected = false;
function injectCss(): void {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement("style");
  style.dataset.ads = "1";
  style.textContent = `
    .ad-slot { display: block; overflow: hidden; }
    .ad-slot--placeholder {
      display: flex; align-items: center; justify-content: center;
      border: 1px dashed rgba(128, 128, 128, 0.55);
      border-radius: 12px;
      color: rgba(128, 128, 128, 0.75);
      background: rgba(128, 128, 128, 0.06);
      font: 600 11px/1.2 "Archivo", system-ui, sans-serif;
      letter-spacing: 2px; text-transform: uppercase;
      min-height: 60px; text-align: center; padding: 8px;
    }
    .ad-rail {
      position: fixed; top: 50%; transform: translateY(-50%);
      width: 160px; height: 600px; z-index: 5;
    }
    .ad-rail--left { left: 12px; }
    .ad-rail--right { right: 12px; }
    .ad-rail.ad-slot--placeholder { flex-direction: column; }
    @media (max-width: 1300px) {
      .ad-rail { display: none; }
    }
  `;
  document.head.append(style);
}

interface AdSlotOptions {
  /** data-ad-slot de la unidad de AdSense. Sin esto se muestra un placeholder. */
  slot?: string;
  /** data-ad-format (auto / vertical / horizontal / rectangle). */
  format?: "auto" | "vertical" | "horizontal" | "rectangle";
  /** data-full-width-responsive. */
  responsive?: boolean;
  /** Clase(s) extra para el contenedor. */
  className?: string;
  /** Texto del placeholder. */
  label?: string;
}

/**
 * Crea un contenedor de anuncio, o null si la publicidad esta apagada.
 * El caller decide donde insertarlo (si es null, simplemente no lo inserta).
 */
export function createAdSlot(opts: AdSlotOptions = {}): HTMLElement | null {
  if (!adsActive()) return null;
  injectCss();

  const box = document.createElement("div");
  box.className = "ad-slot" + (opts.className ? " " + opts.className : "");

  // Unidad real: hace falta el publisher id (siempre presente) y el data-ad-slot.
  if (CLIENT && opts.slot) {
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.height = "100%";
    ins.setAttribute("data-ad-client", CLIENT);
    ins.setAttribute("data-ad-slot", opts.slot);
    if (opts.format) ins.setAttribute("data-ad-format", opts.format);
    if (opts.responsive) ins.setAttribute("data-full-width-responsive", "true");
    box.append(ins);
    try {
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ??= []).push({});
    } catch {
      // ignore
    }
    return box;
  }

  // Sin data-ad-slot todavia: en modo preview mostramos un placeholder; en
  // produccion no renderizamos nada (evita huecos vacios hasta crear la unidad).
  if (PLACEHOLDER) {
    box.classList.add("ad-slot--placeholder");
    box.textContent = opts.label ?? "Publicidad";
    return box;
  }

  return null;
}
