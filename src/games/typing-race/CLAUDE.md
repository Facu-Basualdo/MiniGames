# Mecano (typing-race)

A 30-second typing sprint. Words stream in from a pool of common Spanish words (no diacritics, so any keyboard layout can type them); the player types them one by one and the run is scored by **PPM** (palabras por minuto / WPM). Higher is better.

## Module layout

- `main.ts` — entry point, mounts the `Game` instance to `#app`.
- `game/Game.ts` — state machine, keyboard handling, the 30s delta-time timer, live stats, WPM/accuracy scoring, and best-score persistence in localStorage.
- `game/Hud.ts` — DOM manager: HUD stat bar (time / PPM / precision), the word stream with per-character feedback and a blinking caret, the start/game-over overlays, the countdown, and the leaderboard panel.
- `game/SoundEffects.ts` — synthesized Web Audio effects (no assets): countdown tick, a soft click per correct keystroke, a bright blip on a completed word, a low buzz on a mistyped character, and a rising flourish on finish.
- `game/constants.ts` — tuning: sprint duration (30s), storage key, how many words to render ahead (`VISIBLE_WORDS`), countdown steps, and the `WORD_POOL`.
- `style.css` — dark glassmorphic styling; monospace word stream (JetBrains Mono) with correct/incorrect/extra character colors and an animated caret.

## How it works

1. **Countdown**: Enter starts the mandatory 3 / 2 / 1 / YA countdown, then play begins.
2. **Typing**: The stream renders the current word (with live per-character feedback) plus upcoming context. Letters append to the current buffer; `Backspace` deletes; `Space` submits the word and advances. The word list grows on the fly (`ensureWordsAhead`) so it never runs out.
3. **Scoring**: On each submitted word, matched characters are counted. Net WPM = correct characters / 5 / minutes (a completed word contributes its space too); accuracy = correct characters / total keystrokes. When the 30s expire the final WPM is computed, compared with the personal best, stored, and submitted to the global ranking.

## State machine (`Game.ts`)

- `ready`: start screen, Enter begins the countdown.
- `countdown`: 3 / 2 / 1 / YA.
- `playing`: keystrokes drive typing; the frame loop decrements `timeLeft` and refreshes the HUD.
- `gameOver`: results overlay (PPM, precision, correct words) + retry with Enter.

## Non-obvious decisions

- **Word pool has no accents or ñ** so the game is fair across keyboard layouts; typing an accented character would otherwise be impossible on some layouts.
- **Space is the only word delimiter** — a word is not auto-submitted when it matches, so the player controls the rhythm. A space with an empty buffer is ignored (no skipping).
- **Only single-character keys type** (`e.key.length === 1`); modifier combos (Ctrl/Meta/Alt) are ignored so shortcuts still work.
- **Live WPM needs ~1s of elapsed time** before it reads non-zero (avoids a divide-by-zero / absurd spike at the very start).
- **Default scoring (`direction: "higher"`)**, so `meta.ts` omits `export const scoring` per the root convention. `endGame()` submits the WPM via `hud.showRanking("typing-race", wpm)`.

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("typing-race", { getScore: () => this.liveWpm(), onStart: () => this.beginCountdown() })`. With `?room=` in the URL, `endGame()` reports the WPM to the room instead of the global ranking, the game-over Enter-to-restart is blocked (one run per round), and every player's run auto-starts together via `onStart`. The timeout partial is the live WPM of what has been typed so far.
