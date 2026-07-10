import { getAudioContext, resumeAudio } from "./audioContext";
import { EMOTES, type EmoteId } from "./constants";

/**
 * Samples reales (mp3) de las cinco reacciones. Es la UNICA excepcion del repo a la
 * regla de sintetizar todo con Web Audio: una risa humana no la hace un oscilador, y
 * las reacciones son la voz del jugador en la mesa.
 *
 * Los archivos viven en `public/sfx/emotes/<id>.mp3` (ver su README) y se sirven
 * estaticos, sin pasar por el bundle. Se precargan una sola vez por pagina: se bajan,
 * se decodifican a `AudioBuffer` y quedan en memoria, asi la reaccion suena en el acto
 * (no en el momento del click, que llegaria tarde).
 *
 * **Degrada**: si un mp3 no esta, no baja o no decodifica, `play()` devuelve `false` y
 * `SoundEffects.playEmote` cae al sonido sintetizado de siempre. La reaccion nunca
 * queda muda, y el juego funciona igual con la carpeta `sfx/` vacia.
 */

/** Servidos desde `public/`, asi que la URL es absoluta desde la raiz del sitio. */
const BASE_URL = "/sfx/emotes/";
/**
 * Los samples son mucho mas fuertes que los osciladores (pico <= 0.09). Este gain los
 * baja para que una risa no tape el reloj ni el quiebre del eslabon: la reaccion es un
 * gesto, no un evento de la partida.
 */
const SAMPLE_GAIN = 0.45;

const buffers = new Map<EmoteId, AudioBuffer>();
let preloaded = false;

async function load(id: EmoteId): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const res = await fetch(`${BASE_URL}${id}.mp3`);
    if (!res.ok) return; // 404 en prod: no hay sample, va el sintetizado
    buffers.set(id, await ctx.decodeAudioData(await res.arrayBuffer()));
  } catch {
    // Silencioso a proposito: el fallback sintetizado ya cubre el caso. Cae aca la red
    // caida, un mp3 corrupto, y tambien el archivo faltante en `npm run dev`, donde Vite
    // responde 200 con el index.html en vez de 404 y es el decode el que termina fallando.
  }
}

export class EmoteAudio {
  /**
   * Dispara la descarga de los cinco samples en paralelo. Idempotente: llamarla de
   * nuevo no vuelve a bajar nada. Conviene llamarla apenas se sabe que se va a jugar
   * (no al primer emote), para que el sample ya este decodificado cuando haga falta.
   */
  static preload(): void {
    if (preloaded) return;
    preloaded = true;
    for (const { id } of EMOTES) void load(id);
  }

  /** Reproduce el sample. Devuelve `false` si no esta listo, y el llamador sintetiza. */
  static play(id: EmoteId): boolean {
    const ctx = getAudioContext();
    const buffer = buffers.get(id);
    if (!ctx || !buffer) return false;
    resumeAudio(ctx);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = SAMPLE_GAIN;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return true;
  }
}
