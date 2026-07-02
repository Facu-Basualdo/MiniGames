# Sliding Puzzle

A premium neon-themed sliding block puzzle game. The player must sort numbers from 1 to N-1 (leaving the bottom-right cell blank) in a grid. The game allows sliding entire rows or columns towards the empty space with a single tap or click.

## Module Layout

- `main.ts` - Entry point, mounts the `Game` instance to `#app`.
- `game/Game.ts` - Implements the puzzle board logic, solvable random-walk scramble, keyboard controls (WASD / Arrows), slide animations, score logic, and state transitions.
- `game/Hud.ts` - DOM manager. Handles starts screen overlays, grid size options (3x3, 4x4, 5x5), countdown sequences, active statistics (moves, timer), tile positioning, correct-state styling updates, and victory overlays.
- `game/constants.ts` - Game configurations (grid sizes, local storage keys, countdown configurations).
- `game/SoundEffects.ts` - Synthesizes audio effects programmatically using the Web Audio API.
- `style.css` - Custom styles for absolute tile placement using CSS 3D transforms, neon borders, and glowing interactive elements.

## How it works

**Multi-Tile Row/Column Slide**
Unlike basic versions where players can only slide one block adjacent to the empty cell, this version supports shifting entire rows or columns:
- Clicking a tile in the same row as the empty cell:
  - If to the left, all intermediate tiles shift right by one slot.
  - If to the right, all intermediate tiles shift left by one slot.
- Clicking a tile in the same column as the empty cell:
  - If above, all intermediate tiles shift down by one slot.
  - If below, all intermediate tiles shift up by one slot.
- Shifting a row or column segment is treated as a single move.

**Solvability Scrambling**
Simply randomizing the tiles can generate unsolvable board configurations. To ensure the puzzle is always solvable, we scramble the board starting from the solved state and making consecutive random valid adjacent shifts (e.g., 120 shifts for 3x3, 240 for 4x4, 400 for 5x5).

## State Machine

The game moves through the following states:
- `ready` - Start screen. Shows the game description, best record for the selected board size, and grid size selectors.
- `countdown` - Shared 3 / 2 / 1 / YA countdown.
- `playing` - Active gameplay state. Scrambles board, starts the timer, and enables interaction.
- `victory` - Finished state. Renders statistics, checks and saves personal best score, evaluates performance, and provides a retry prompt.

## Non-Obvious Decisions

**GPU-Accelerated Slide Animations**
Instead of destroying and rebuilding the board DOM on each move (which breaks transition animations), we instantiate the DOM elements once and position them absolutely. We use custom CSS variables `--x` and `--y` with 3D translations (`transform: translate3d(calc(var(--x) * 100%), calc(var(--y) * 100%), 0)`) and smooth ease-out curves. This triggers hardware-accelerated rendering and guarantees smooth sliding animations.

**Correct Position Indication**
When a tile is at its solved grid coordinate, it receives an `is-correct` class, which changes its border and text color to a neon cyan glow. This guides the player during complex runs.

**Synthesized Audio Context**
To prevent loading slow or heavy `.mp3` assets, sound effects (mechanical click on slide, musical arpeggio on victory) are synthesized on-the-fly using the Web Audio API, which complies with browser autoplay guidelines.

**Global ranking (per size, fewer moves wins)**
Registered in `GAME_SCORING` (see root `CLAUDE.md`) with `direction: "lower"` and `variants: ["3", "4", "5"]`, so each board size has its own independent leaderboard. `handleVictory()` submits the move count via `hud.showRanking("sliding-puzzle", moves, size)` (variant = board size). Only **moves** are ranked globally in v1; the best **time** stays a local-only secondary metric (still tracked per size in localStorage).
