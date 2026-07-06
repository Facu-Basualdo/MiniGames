import { defineConfig, type Plugin, type HtmlTagDescriptor } from "vite";
import { resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { ADSENSE_CLIENT } from "./src/shared/ads/client";

const root = __dirname;
const gamesDir = resolve(root, "games");

// Publicidad (Google AdSense). Este plugin inyecta en el HTML de cada pagina:
//  1. El loader de AdSense en el <head> de TODAS las paginas, solo en build. Es lo
//     que AdSense pide para verificar el sitio y correr Auto ads. Se omite en dev
//     para no pegarle a Google desde localhost.
//  2. El montador de anuncios (adMount.ts) en TODAS las paginas; placements.ts
//     define que colocar segun la pagina (rieles/banners por juego + landing) sin
//     editar cada juego. Solo aparecen una vez que se pegan los data-ad-slot en
//     AD_SLOTS (src/shared/ads/ads.ts).
//  3. El selector visual de anuncios (adPicker.ts) solo en dev, para marcar
//     ubicaciones con ?adpick=1.
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
        const isDev = Boolean(ctx.server);

        // Loader de AdSense en el <head> de cada pagina (solo en build).
        if (!isDev && ADSENSE_CLIENT) {
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

        // Montador de anuncios en todas las paginas (landing, juegos, salas);
        // placements.ts decide que colocar segun la pagina. Script inline que
        // importa el modulo (no un src externo): Vite reescribe el import al chunk
        // con hash y deja un <script> inline que si se ejecuta (un src externo
        // extra terminaba como modulepreload y no llegaba a correr).
        tags.push({
          tag: "script",
          attrs: { type: "module" },
          children: `import "/src/shared/ads/adMount.ts";`,
          injectTo: "body",
        });

        // Selector visual de anuncios: SOLO en dev, en todas las paginas. Se
        // activa con ?adpick=1 (el propio modulo lo chequea). Nunca en produccion.
        if (isDev) {
          tags.push({
            tag: "script",
            attrs: { type: "module" },
            children: `import "/src/shared/ads/adPicker.ts";`,
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
