/**
 * Estado y resolucion del game server (server/, socket.io en Railway).
 *
 * Hay dos URLs posibles: la principal (`VITE_GAME_SERVER_URL`) y una de respaldo
 * (`VITE_GAME_SERVER_FALLBACK_URL`, opcional). Se prueban **en orden** contra el
 * health check HTTP (`/health`, ver `server/src/index.ts`, que responde
 * `{ ok: true }` y manda las cabeceras CORS) y gana la primera que contesta.
 *
 * Lo usan dos lados:
 *  - la landing (`src/main.ts`), para el indicador de la barra con el ping;
 *  - los juegos que necesitan el server (word-bomb, word-chain, basta, impostor,
 *    pong), via `resolveGameServerUrl()` antes de abrir el socket. Si el resolver
 *    viviera solo en la landing el respaldo seria decorativo: el chip diria "en
 *    linea" y los juegos seguirian pegandole al server muerto.
 *
 * Sin ninguna URL configurada el estado es "unknown" y no se pinta nada (misma
 * degradacion que el resto: la landing anda igual, y los juegos server-side ya
 * muestran su cartel de "no disponible").
 */

export type ServerStatus = "unknown" | "online" | "offline";

export interface ServerCheck {
  status: ServerStatus;
  /** URL que respondio, o undefined si ninguna. */
  url?: string;
  /** Round-trip del /health en ms (entero), solo si status === "online". */
  pingMs?: number;
  /** true si respondio la de respaldo porque la principal esta caida. */
  fallback: boolean;
}

const PRIMARY = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
const FALLBACK = import.meta.env.VITE_GAME_SERVER_FALLBACK_URL as string | undefined;

/** Timeout del ping: Railway duerme los servicios free y tarda en despertar. */
const PING_TIMEOUT_MS = 8000;

/**
 * Cache de la URL viva. Es de sesion (no localStorage) a proposito: una URL que
 * se cayo hace una semana no deberia decidir a que server se conecta el juego de
 * hoy, y cada pestana resuelve la suya.
 */
const CACHE_KEY = "mg:game-server-url";

/**
 * Normaliza lo que venga en la env: saca espacios y la barra final, y **completa
 * el esquema** si falta (`game.juegachos.com` -> `https://game.juegachos.com`).
 * Sin esto un host pelado se toma como URL **relativa** y el fetch termina en
 * `<origen>/game.juegachos.com/health`: el server se ve caido estando vivo.
 */
function normalize(url: string): string {
  const clean = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

/** Las URLs configuradas, principal primero, sin duplicados ni vacias. */
function serverUrls(): string[] {
  const urls = [PRIMARY, FALLBACK]
    .filter((u): u is string => Boolean(u && u.trim()))
    .map(normalize);
  return [...new Set(urls)];
}

export function isGameServerConfigured(): boolean {
  return serverUrls().length > 0;
}

/** Pega al /health de una URL. Devuelve el ping en ms, o null si no responde. */
async function probe(url: string): Promise<number | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean };
    if (!body?.ok) return null;
    return Math.round(performance.now() - startedAt);
  } catch {
    // Red caida, CORS, timeout: para el jugador es lo mismo, no hay server.
    return null;
  }
}

/**
 * Prueba las URLs en orden y devuelve la primera viva (con su ping). Cachea la
 * ganadora para `resolveGameServerUrl`.
 */
export async function checkGameServer(): Promise<ServerCheck> {
  const urls = serverUrls();
  if (urls.length === 0) return { status: "unknown", fallback: false };

  for (const [i, url] of urls.entries()) {
    const pingMs = await probe(url);
    if (pingMs !== null) {
      cacheUrl(url);
      return { status: "online", url, pingMs, fallback: i > 0 };
    }
  }
  clearCachedUrl();
  return { status: "offline", fallback: false };
}

function cacheUrl(url: string): void {
  try {
    sessionStorage.setItem(CACHE_KEY, url);
  } catch {
    // ignore
  }
}

function cachedUrl(): string | null {
  try {
    const url = sessionStorage.getItem(CACHE_KEY);
    // Solo vale si sigue siendo una de las configuradas (la env pudo cambiar).
    return url && serverUrls().includes(url) ? url : null;
  } catch {
    return null;
  }
}

function clearCachedUrl(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * La URL del game server a la que conectarse: la principal si esta viva, si no la
 * de respaldo. `undefined` si no hay ninguna configurada o ninguna responde.
 *
 * Con una sola URL configurada (el caso normal) **no chequea nada**: devuelve esa
 * y que el socket falle como fallaba antes. El health check extra solo se paga
 * cuando hay respaldo, que es cuando la respuesta cambia algo.
 *
 * OJO: la sala entera tiene que terminar en el **mismo** server o los jugadores
 * quedan en partidas distintas sin verse. Con la principal caida para todos, todos
 * caen al respaldo y coinciden; el riesgo es el desacuerdo transitorio (a uno le
 * falla el chequeo y a otro no). Por eso el resultado se cachea por sesion: una vez
 * elegido, el jugador no salta de server a mitad de partido.
 */
export async function resolveGameServerUrl(): Promise<string | undefined> {
  const urls = serverUrls();
  if (urls.length === 0) return undefined;
  if (urls.length === 1) return urls[0];

  const cached = cachedUrl();
  if (cached) return cached;

  const { url } = await checkGameServer();
  // Ninguna respondio: se devuelve la principal igual, asi el error que ve el
  // jugador es el del socket (con su reintento) y no un silencio.
  return url ?? urls[0];
}
