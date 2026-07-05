import { defineConfig, type Plugin, type HtmlTagDescriptor } from "vite";
import { resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { ADSENSE_CLIENT } from "./src/shared/ads/client";

const root = __dirname;
const gamesDir = resolve(root, "games");

// Publicidad (Google AdSense). Este plugin hace dos cosas en el HTML de cada pagina:
//  1. Inyecta el loader de AdSense en el <head> de TODAS las paginas (landing,
//     juegos y /rooms/), solo en build. Es lo que AdSense pide para verificar el
//     sitio y correr Auto ads. Se omite en dev para no pegarle a Google desde
//     localhost.
//  2. Inyecta el modulo de rieles solo en las paginas de juego (games/<id>/), sin
//     tocar landing ni rooms. Asi los rieles se suman a todos los juegos (presentes
//     y futuros) sin editar cada uno; gameRails.ts decide si montarlos segun su
//     allowlist. Los anuncios manuales (banner y rieles) solo aparecen una vez que
//     se pegan los data-ad-slot en AD_SLOTS (src/shared/ads/ads.ts).
function injectGameAds(): Plugin {
  return {
    name: "inject-game-ads",
    // `order: "pre"` corre antes de que Vite escanee los entry points del HTML,
    // asi el <script> inyectado entra al bundle y en build su src se reescribe al
    // asset con hash (sin esto quedaria un "/src/..." literal que 404ea en prod).
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const tags: HtmlTagDescriptor[] = [];

        // Loader de AdSense en el <head> de cada pagina (solo en build).
        if (!ctx.server && ADSENSE_CLIENT) {
          tags.push({
            tag: "script",
            attrs: {
              async: true,
              src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
              crossorigin: "anonymous",
            },
            injectTo: "head",
          });
        }

        // Rieles solo en paginas de juego (games/<id>/index.html).
        const file = ctx.filename.replace(/\\/g, "/");
        if (/\/games\/[^/]+\/index\.html$/.test(file)) {
          tags.push({
            // Script inline que importa el modulo (no un src externo): Vite
            // reescribe el import al chunk con hash y deja un <script> inline
            // que si se ejecuta (un src externo extra terminaba como
            // modulepreload y no llegaba a correr).
            tag: "script",
            attrs: { type: "module" },
            children: `import "/src/shared/ads/gameRails.ts";`,
            injectTo: "body",
          });
        }

        return { html, tags };
      },
    },
  };
}

function collectHtmlEntries(): Record<string, string> {
  const entries: Record<string, string> = {
    main: resolve(root, "index.html"),
  };

  // Pagina de salas multijugador (no es un juego, no vive bajo games/).
  const roomsHtml = resolve(root, "rooms/index.html");
  if (existsSync(roomsHtml)) entries.rooms = roomsHtml;

  for (const dirent of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const htmlPath = resolve(gamesDir, dirent.name, "index.html");
    if (existsSync(htmlPath)) entries[dirent.name] = htmlPath;
  }

  return entries;
}

export default defineConfig({
  plugins: [injectGameAds()],
  build: {
    rollupOptions: {
      input: collectHtmlEntries(),
    },
  },
});
