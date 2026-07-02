# MiniGames

Monorepo of small browser minigames (Neon Cylinder, Flappy Bird, Stack Tower, Rhythm Tap, Jump Ball, Reaction Time, City Bloxx, Sliding Puzzle, Asteroids, Mini Frogger, Kunai Throw, and Keepers!), each independently playable, plus a landing page to pick one. Stack: Vite + TypeScript, no framework. Deployed as a static site (Vercel).

## Conventions (must follow)

- **Never use emojis** anywhere — not in code, UI, comments, commit messages, or docs.
- **Keep `CLAUDE.md` files up to date with every change.** When structure, commands, conventions, or the game roster change, update the relevant `CLAUDE.md` (this root file and/or the per-game one) in the same change.
- **Never add yourself (Claude) as a co-author on commits.** Do not append `Co-Authored-By` trailers or any AI attribution to commit messages.
- **Use the installed `threejs-*` skills when building 3D games.** For any game using Three.js (scenes, cameras, geometry, materials, lighting, textures, animation, model loaders, shaders, postprocessing, raycasting/interaction), consult the matching `threejs-*` skill for accurate APIs and patterns instead of relying on memory.
- **Every game must have the Enter-to-start 3 / 2 / 1 / YA countdown.** No game may jump straight from the start / game-over screen into play — it must go through the shared countdown described below. New games are required to implement it.

## Structure

- `index.html`, `src/main.ts`, `src/style.css` — the landing page. Renders a card per game from `src/games.ts`.
- `src/games.ts` — registry (`GameEntry[]`: `id`, `title`, `description`, `path`, optional `accent` color) the landing page reads. **Every game needs an entry here.**
- `games/<id>/index.html` — one Vite HTML entry point per game (root-level `games/`, not under `src/`), giving each game a clean URL `/games/<id>/`.
- `src/games/<id>/` — that game's source (`main.ts`, `style.css`, plus its own submodules, e.g. `game/`).
- `src/shared/` — cross-cutting leaderboard infra shared by every game and the landing page (see "Global rankings" below). This is the **one** sanctioned shared module; it is not game-engine code.
- `vite.config.ts` — auto-discovers every `games/*/index.html` via `node:fs` at config-load time and feeds them into `build.rollupOptions.input`. New games are picked up automatically; **no edit needed here** when adding a game.
- `public/` — static assets shared across all games (favicon, icons).
- Each game folder under `src/games/<id>/` has its own `CLAUDE.md` with game-specific context (mechanics, gotchas, tuning knobs).

## Commands

- `npm run dev` — Vite dev server (each game reachable at `/games/<id>/`, landing page at `/`).
- `npm run build` — `tsc` type-check then `vite build`; verify by checking the output for a `dist/games/<id>/index.html` line per game.
- `npm run preview` — serve the production build locally.

## Adding a new minigame

1. Create `src/games/<id>/` with `main.ts`, `style.css`, and any submodules.
2. Create `games/<id>/index.html` mirroring `games/neon-cylinder/index.html` (script `src="/src/games/<id>/main.ts"`; optional `.back-link` anchor to `/` to return to the landing page).
3. Add an entry to `src/games.ts`.
4. Add a `CLAUDE.md` inside `src/games/<id>/` documenting that game's mechanics and any non-obvious decisions.
5. Implement the mandatory Enter-to-start 3 / 2 / 1 / YA countdown (see "Shared UX pattern" below).
6. Wire the global ranking (see "Global rankings" below): declare the game in `GAME_SCORING` and call `hud.showRanking(...)` on game over.
7. Run `npm run build` to confirm the new entry is discovered.

Games are intentionally decoupled — no shared game-engine code between them. Don't introduce a shared abstraction across games unless a second game actually needs it. The lone exception is `src/shared/` (global rankings), which is deliberately cross-cutting infra, not gameplay logic.

## Global rankings

Every game reports its final score to a shared global leaderboard backed by **Supabase** (Postgres + client SDK called straight from the browser with the anon key and Row Level Security — no server code). Lives in `src/shared/`:

- `supabase.ts` — lazy client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `getSupabase()` returns `null` when unset. `isLeaderboardEnabled()` gates optional UI.
- `scoring.ts` — `GAME_SCORING[gameId]`: per-game `direction` (`"higher"` = bigger is better, default; `"lower"` for reaction-time and sliding-puzzle), optional `format`, and optional `variants` (independent boards, e.g. sliding-puzzle sizes). **Every game that submits must have an entry here.**
- `nickname.ts` — anonymous player name in `localStorage` (`mg:nickname`, 1-12 chars).
- `leaderboard.ts` — `submitScore(gameId, score, { variant })` and `fetchTop(gameId, { variant, limit })`.
- `LeaderboardPanel.ts` — self-contained DOM component (injects its own CSS once). Prompts for a nickname on the first submit, then shows the Top 10 and highlights the player's row. Reused by each game's game-over overlay and by the landing modal.

Config & degradation:
- Credentials go in `.env` (gitignored; see `.env.example`) and in Vercel's env vars. The DB schema is `supabase/schema.sql`.
- **Degrades gracefully:** with no credentials the games play normally, local bests still persist, and the ranking UI just doesn't appear. Never make gameplay depend on the leaderboard.
- Security note: scores are inserted client-side with the anon key, so they are spoofable — acceptable for minijuegos; move the insert behind a serverless function if it ever matters.

Per-game wiring: each `Game.ts` calls `this.hud.showRanking(<id>, score[, size])` right after saving the local best in its game-over handler; each `Hud` mounts a `LeaderboardPanel` in its overlay, exposes `showRanking(...)`, and calls `leaderboard.clear()` in `showStart`. Landing (`src/main.ts`) adds a per-card "Ranking" button that opens a read-only modal (with a variant selector for games that declare `variants`).

## Shared UX pattern: Enter-to-start countdown

Every game starts the same way: from the start / game-over screen, Enter (or a tap) enters a `countdown` state that shows 3 / 2 / 1 / YA before play begins, then the run starts. The pattern is duplicated per game (not shared code, per the decoupling rule): each `Game.ts` has a `countdown` state plus `COUNTDOWN_LABELS` / `COUNTDOWN_STEP` constants and a `beginCountdown()`; each `Hud` has `showCountdown(text | null)`; each `style.css` has the `.countdown` label styling and `countdown-pop` keyframes. This is mandatory — every game must implement this pattern (see the Conventions rule above); new games are not complete without it.
