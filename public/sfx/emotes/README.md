# Sonidos de las reacciones

Samples de las cinco reacciones de **Bomba Palabra** y **Cadena de Palabras** (los dos
juegos comparten el set de emotes y cada uno tiene su copia de `EmoteAudio.ts`, por la
regla de decoupling del repo).

Es la **unica excepcion** del repo a la regla de sintetizar todo con Web Audio (ver el
`CLAUDE.md` de sliding-puzzle): una risa humana no la hace un oscilador.

## Archivos esperados

Exactamente estos cinco nombres, en esta carpeta:

| Archivo        | Reaccion  | Tecla |
| -------------- | --------- | ----- |
| `risa.mp3`     | Risa      | 1     |
| `sorpresa.mp3` | Sorpresa  | 2     |
| `enojo.mp3`    | Enojo     | 3     |
| `burla.mp3`    | Burla     | 4     |
| `llanto.mp3`   | Llanto    | 5     |

## Requisitos

- **Duracion <= 1 segundo.** El server tiene un cooldown de 1s por jugador
  (`EMOTE_COOLDOWN_MS`): un sample mas largo se solapa con la reaccion siguiente y, con
  8 jugadores en la mesa, tapa la partida.
- **Livianos** (idealmente < 30 KB): se bajan los cinco al entrar al juego. Mono y
  ~96 kbps alcanza y sobra para un efecto corto.
- **Sin silencio al principio.** La reaccion tiene que sonar en el mismo frame en que
  salta el personaje; medio segundo de silencio inicial la desincroniza.
- **Normalizados y sin clipping.** El volumen se ajusta en `SAMPLE_GAIN` (0.45), pero si
  el mp3 viene saturado no hay gain que lo arregle.
- **Licencia libre para uso comercial** (el sitio tiene AdSense). Sirven CC0 /
  dominio publico: freesound.org (filtrando por CC0), Pixabay o Mixkit.

## Como suenan hoy

Faltando el mp3, cada reaccion suena con su version **sintetizada** (`SoundEffects.playEmote`).
No hay que borrar nada: `EmoteAudio.play()` devuelve `false` y el sintetizado toma el
lugar. Agregar un solo archivo (por ejemplo `risa.mp3`) ya lo hace sonar a el y deja las
otras cuatro sintetizadas.

## Ajustar el volumen

`SAMPLE_GAIN` esta duplicado en los dos juegos:

- `src/games/word-bomb/game/EmoteAudio.ts`
- `src/games/word-chain/game/EmoteAudio.ts`
