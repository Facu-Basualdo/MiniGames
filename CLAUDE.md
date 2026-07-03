# MiniGames

Monorepo of small browser minigames (Neon Cylinder, Flappy Bird, Stack Tower, Rhythm Tap, Jump Ball, Reaction Time, City Bloxx, Sliding Puzzle, Asteroids, Mini Frogger, Neon Drift, Odd One Out, Dunk Shot, Memoria, Kunai Throw, Keepers!, Western Shoot, Crono Ciego, El Trile, PONG, and Block Paddle), each independently playable, plus a landing page to pick one. (Rocket SpaceX / `rocket-arena` still lives in the repo but is temporarily hidden from the roster in `src/games.ts` due to errors.) Stack: Vite + TypeScript, no framework. Deployed as a static site (Vercel).

## Conventions (must follow)

- **Never use emojis** anywhere — not in code, UI, comments, commit messages, or docs.
- **Keep `CLAUDE.md` files up to date with every change.** When structure, commands, conventions, or the game roster change, update the relevant `CLAUDE.md` (this root file and/or the per-game one) in the same change.
- **Never add yourself (Claude) as a co-author on commits.** Do not append `Co-Authored-By` trailers or any AI attribution to commit messages.
- **Use the installed `threejs-*` skills when building 3D games.** For any game using Three.js (scenes, cameras, geometry, materials, lighting, textures, animation, model loaders, shaders, postprocessing, raycasting/interaction), consult the matching `threejs-*` skill for accurate APIs and patterns instead of relying on memory.
- **Every game must have the Enter-to-start 3 / 2 / 1 / YA countdown.** No game may jump straight from the start / game-over screen into play — it must go through the shared countdown described below. New games are required to implement it.

## Structure

- `index.html`, `src/main.ts`, `src/style.css` — the landing page. Renders a card per game from `src/games.ts`, plus a "Jugar con amigos" link to `/rooms/` (only when Supabase credentials exist).
- `src/games.ts` — registry (`GameEntry[]`: `id`, `title`, `description`, `path`, optional `accent` color) the landing page reads. **Every game needs an entry here.**
- `games/<id>/index.html` — one Vite HTML entry point per game (root-level `games/`, not under `src/`), giving each game a clean URL `/games/<id>/`.
- `src/games/<id>/` — that game's source (`main.ts`, `style.css`, plus its own submodules, e.g. `game/`).
- `src/shared/` — cross-cutting leaderboard infra shared by every game and the landing page (see "Global rankings" below), plus `src/shared/room/` (multiplayer rooms, see "Salas" below). This is the **one** sanctioned shared module; it is not game-engine code.
- `rooms/index.html` + `src/rooms/` — the multiplayer rooms page (create / join / lobby) at `/rooms/`. Not a game, so it lives outside `games/`.
- `vite.config.ts` — auto-discovers every `games/*/index.html` via `node:fs` at config-load time and feeds them into `build.rollupOptions.input`. New games are picked up automatically; **no edit needed here** when adding a game. The only hand-registered extra entry is `rooms/index.html`.
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
7. Wire the multiplayer room mode (see "Salas (multiplayer rooms)" below): `initRoomMode(<id>, { getScore })` in the constructor, block the restart input on game over when `this.room` is set, and call `this.room.reportScore(score)` instead of `hud.showRanking(...)`.
8. Run `npm run build` to confirm the new entry is discovered.

Games are intentionally decoupled — no shared game-engine code between them. Don't introduce a shared abstraction across games unless a second game actually needs it. The lone exception is `src/shared/` (global rankings), which is deliberately cross-cutting infra, not gameplay logic.

## Global rankings

Every game reports its final score to a shared global leaderboard backed by **Supabase** (Postgres + client SDK called straight from the browser with the anon key and Row Level Security — no server code). Lives in `src/shared/`:

- `supabase.ts` — lazy client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `getSupabase()` returns `null` when unset. `isLeaderboardEnabled()` gates optional UI.
- `scoring.ts` — `GAME_SCORING[gameId]`: per-game `direction` (`"higher"` = bigger is better, default; `"lower"` for reaction-time and sliding-puzzle), optional `format`, optional `variants` (independent boards, e.g. sliding-puzzle sizes), and optional per-variant overrides `variantDirection` / `variantFormat` (used when one variant sorts/formats differently from the base — e.g. memory-match is `"higher"` for room-mode pairs but its solo `"solo"` board is `"lower"`). `encodeTimeMoves` / `formatTimeMoves` pack completion time + moves into one score (time orders, moves tiebreak) for the sliding-puzzle and memory-match solo boards. **Every game that submits must have an entry here.**
- `nickname.ts` — anonymous player name in `localStorage` (`mg:nickname`, 1-12 chars).
- `leaderboard.ts` — `submitScore(gameId, score, { variant })` and `fetchTop(gameId, { variant, limit })`.
- `LeaderboardPanel.ts` — self-contained DOM component (injects its own CSS once). Prompts for the nickname on every submit, prefilled with the last used name as an editable suggestion; the score is sent only after the player confirms. Then shows the Top 10 and highlights the player's row. Reused by each game's game-over overlay and by the landing modal.

Config & degradation:
- Credentials go in `.env` (gitignored; see `.env.example`) and in Vercel's env vars. The DB schema is `supabase/schema.sql`.
- **Degrades gracefully:** with no credentials the games play normally, local bests still persist, and the ranking UI just doesn't appear. Never make gameplay depend on the leaderboard.
- Security note: scores are inserted client-side with the anon key, so they are spoofable — acceptable for minijuegos; move the insert behind a serverless function if it ever matters.

Per-game wiring: each `Game.ts` calls `this.hud.showRanking(<id>, score[, size])` right after saving the local best in its game-over handler; each `Hud` mounts a `LeaderboardPanel` in its overlay, exposes `showRanking(...)`, and calls `leaderboard.clear()` in `showStart`. Landing (`src/main.ts`) adds a per-card "Ranking" button that opens a read-only modal (with a variant selector for games that declare `variants`).

## Salas (multiplayer rooms)

Party mode: a host creates a room (short shareable code), friends join, and everyone plays the same minigame simultaneously on their own device; each round awards points by placement (1st of N players gets N points, direction-aware via `GAME_SCORING`), with a cumulative scoreboard and a winner at the end. Room settings (host): a number of games (the count caps playlist selection) plus a per-round time limit. The time limit can be set to "Sin límite" (`roundTimeLimitSec = NO_TIME_LIMIT = 0` in `types.ts`): `computeRoundDeadline` returns `null`, so the round has no `deadline` and never auto-cuts by time — it closes when every player finishes their run (or when only absent players remain, guarded by a locally tracked round-start grace in `roomMode.ts` since there is no deadline to derive it from). In the "Crear una sala" screen you can hand-pick up to that many games (an explicit ordered playlist) — you must fill all the slots or leave it empty; a partial list is rejected at create time. Empty means no playlist: after each round players vote the next game among 3 random not-yet-played candidates. **Time voting** is an optional host toggle (`settings.timeVote`): when on, the fixed time selector is hidden and instead the players vote the round's time limit **before every game** (including the first) among `TIME_VOTE_OPTIONS` (1-5 min + Sin límite). It runs as its own phase/status `"time_voting"` (separate from, and after, the game vote when there is no playlist): the room enters `time_voting` with the game already fixed and `vote_options` holding the candidate seconds-as-strings; players vote via `room_votes` (the chosen seconds go in the `game_id` column, `round_no` = the round about to play), the host closes it (majority, ties random) and `finishTimeVote` transitions to `playing` with the voted deadline (`computeRoundDeadline` of the winning seconds, so "Sin límite" yields no deadline). The vote UI is the same `RoomOverlay.showVoting` (parametrized kicker/title/hint) and lives entirely in `roomMode.ts`; the lobby's "Empezar" for the first round just calls `startTimeVote` instead of `startRound` and navigates — the vote itself happens on the target game's page. Requires the DB to allow the `time_voting` status (re-run `supabase/rooms.sql`, which has an idempotent `alter ... status_ok` migration). The `/rooms/` flow is two screens: the home (name + join-by-code + a "Crear sala" button) and a separate "Crear una sala" screen with the settings form (`buildSettingsForm` in `src/rooms/main.ts`). The lobby is a two-column layout for the host (`.lobby__columns`; the page widens via `rooms--wide`): the editable settings form ("Ajustes" panel) on the left, and the room code + player list on the right. The host can re-pick games / rounds / time before starting — every change is saved on the fly via `updateSettings` + `ping`. Non-host players see a single column with only the code and player list (no settings panel or summary). This is what lets the host reconfigure the room after "Volver a la sala" (see below). Playlist completeness is validated again on "Empezar" (fill all slots or leave empty). The room survives the final board: the host's "Volver a la sala" button (`resetRoom`) wipes rounds/scores/votes and puts the room back in the lobby with the same players and settings (which the host can then change in the "Ajustes" panel). Only the host is taken to the lobby immediately; the other players are **not** yanked off the final board when the host resets — they keep viewing the results and get their own "Volver a la sala" button (plus an always-present "Salir" to the landing) to return whenever they want (or they're pulled in automatically once the host actually starts the next round). `RoomOverlay`'s final board is rendered once and the cached totals survive the reset (which empties the DB scores). Registered players can rejoin even a finished room, only brand-new players are rejected until it returns to the lobby. Design doc: `docs/salas-plan.md`.

Architecture (Supabase, no server code):
- **Postgres is the source of truth** — tables `rooms`, `room_players`, `room_rounds`, `room_round_scores`, `room_votes` in `supabase/rooms.sql` (run it in the SQL Editor besides `schema.sql`). Durable state is what makes rejoin and page navigation work: every game is its own HTML entry, so navigating drops the Realtime channel and each page reconnects + refetches.
- **Realtime channel per room** (`room:<CODE>`) with presence (key = nickname) and a single broadcast event `sync` meaning "re-read the DB" (write -> ping -> refetch, plus a 5 s poll fallback). No `postgres_changes`.
- **Host-authoritative**: only the host writes phase transitions (start/close round, open vote, finish); players write only their own rows. Points are computed client-side by the pure functions in `points.ts`. If the host disappears >20 s in a stable phase, anyone can take over.
- Same spoofable trust level as `scores` (anon key + open RLS policies) — accepted and documented in the SQL.

Files in `src/shared/room/`: `types.ts` (types + settings constants), `api.ts` (CRUD, no-op without credentials), `channel.ts` (`RoomChannel`), `points.ts` (`rankRound` / `computeTotals`, pure), `RoomOverlay.ts` (self-contained fixed full-screen DOM overlay: waiting / results / voting / final + top strip; styled to match the landing — cream card, ink borders, pill buttons — with the palette hardcoded since it injects into each game page), `roomMode.ts` (orchestrator + the per-game contract), `matchState.ts` (generic shared-board match state, see below).

**Shared-board games** (all players see and act on the same board, e.g. Memoria): durable per-round game state lives in `room_match_state` (one jsonb row per room+round, `supabase/rooms.sql`), accessed via `matchState.ts` (`fetchMatchState` / `createMatchState` / `updateMatchState` with an optimistic `version` column: writes carry the version they read; on conflict the caller refetches). Same write -> ping -> refetch pattern as everything else — good enough for turn-based games (~200-400 ms per move), not for real-time ones. For these games `RoomMode` exposes extra context (`code`, `me`, `round()`, `players()`, `isHost()`, `ping()`, `onSync()`); the host creates the initial board and unblocks AFK turns, the turn player writes moves (single atomic UPDATE resolving the whole attempt), and page reloads re-attach by refetching. `resetRoom` also wipes `room_match_state`.

Per-game wiring (the only game-side code, ~4 lines in each `Game.ts`, `Hud.ts` untouched):
- `private readonly room = initRoomMode("<id>", { getScore: () => this.score, onStart: () => this.beginCountdown() });` in the constructor. Returns `null` without `?room=` in the URL or without Supabase — zero impact outside room mode.
- In the game-over restart input path: `if (this.room) return;` (one run per round; the overlay covers the game's own game-over screen).
- In the game-over handler: `if (this.room) this.room.reportScore(score); else this.hud.showRanking(...)`. Room scores are **not** sent to the global leaderboard (timeout-cut runs would pollute it).
- `getScore` is the live score for the timeout partial. Special cases: reaction-time reports the average of completed rounds; sliding-puzzle is fixed to 4x4 in room mode (`ROOM_VARIANTS`) and hides its size selector; memory-match swaps its solo time-attack for a shared turn-based board (see its `CLAUDE.md`) and scores "own pairs".
- `onStart` (optional) is fired **once** by `RoomMode` when the round becomes `playing`, so every player's run auto-starts together instead of each one pressing Enter — normally `() => this.beginCountdown()` (mini-frogger, which has no countdown, passes `() => this.start()`). Games that drive their own room start (car-race calls `beginCountdown()` in its `boot()`; rocket-arena is real-time) don't pass it.

Setup note: the rooms schema (including `room_match_state`) is `supabase/rooms.sql`; re-run it in the Supabase SQL Editor after pulling changes that touch it (statements are idempotent).

Degradation matches the leaderboard: without credentials the landing button and `/rooms/` UI don't function and every game behaves exactly as before.

## Shared UX pattern: Enter-to-start countdown

Every game starts the same way: from the start / game-over screen, Enter (or a tap) enters a `countdown` state that shows 3 / 2 / 1 / YA before play begins, then the run starts. The pattern is duplicated per game (not shared code, per the decoupling rule): each `Game.ts` has a `countdown` state plus `COUNTDOWN_LABELS` / `COUNTDOWN_STEP` constants and a `beginCountdown()`; each `Hud` has `showCountdown(text | null)`; each `style.css` has the `.countdown` label styling and `countdown-pop` keyframes. This is mandatory — every game must implement this pattern (see the Conventions rule above); new games are not complete without it.

In room mode there is no per-player Enter: `RoomMode` fires the game's `onStart` hook (see "Salas") the moment the round becomes `playing`, so `beginCountdown()` runs automatically and everyone starts together.

**Countdown sound.** Each of the 3 / 2 / 1 / YA labels plays a short 750 Hz sine blip (`SoundEffects.playCountdownTick()`, first defined in shell-game / El Trile and duplicated into every game's `SoundEffects.ts`). It fires once per label change, guarded by a `lastCountdownIndex` field that's reset to `-1` in `beginCountdown()`. New games should include it.
