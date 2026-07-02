# Reaction Time

A premium, glassmorphic reaction speed testing game. The game consists of 5 rounds where the player must click or tap as soon as the screen transitions from the warning state (breathing amber) to the trigger state (neon green). The final score is the mathematical average of the 5 reaction times in milliseconds.

## Module layout

- `main.ts` — entry point, mounts the `Game` instance to `#app`.
- `game/Game.ts` — controls the state machine, delta-time timers, user inputs (mouse clicks, touch events, and keyboard keys), and high-score persistence in localStorage.
- `game/Hud.ts` — DOM overlay manager. Renders start screens, countdowns, top stats HUD (round counter, progress dots, average), state-specific screens (wait, trigger, early, result), and the game-over screen with a detailed summary table.
- `game/constants.ts` — configuration tuning parameters: number of rounds, random delay range (2.0 to 5.0 seconds), storage key, and countdown steps.
- `style.css` — modern stylesheet implementing CSS variables for card states, radial gradients for visual depth, backdrop-blur for overlays, and pop micro-animations.

## How it works

**Rounds & Delay Loop**
1. **Countdown**: Before starting, the game executes the mandatory 3 / 2 / 1 / YA countdown.
2. **Waiting**: The screen turns amber-orange with a breathing animation. A random delay timer is calculated between `MIN_DELAY` (2.0s) and `MAX_DELAY` (5.0s).
3. **Trigger**: When the delay timer expires, the state changes to `triggerActive` and the screen instantly turns neon green. The start timestamp is captured using `performance.now()`.
4. **Action**: The player clicks/taps as fast as possible. The elapsed time in milliseconds is recorded for that round.
5. **Round Progress**: The top bar displays 5 status dots:
   - Green (success) for successful reactions.
   - Red (foul) if the player clicks before the green screen (early click).
6. **Final Result**: After 5 rounds, the arithmetic mean of the recorded times is computed, evaluated to assign a rating badge, compared with the personal best, and stored in localStorage.

## State Machine

The game moves through the following states in `Game.ts`:
- `ready`: Game start screen, waiting for user to click or press Enter.
- `countdown`: Displaying the 3-2-1-YA countdown sequence.
- `waitingForTrigger`: Decrementing the random delay. Clicks here trigger a foul.
- `triggerActive`: Precise timer active, waiting for player click.
- `earlyClick`: Clicked too soon. Suspends progress, clicking restarts the current round.
- `roundFinished`: Displays current round response time. Click/Enter advances to the next round (or to `gameOver`).
- `gameOver`: End screen showing the average time, individual rounds table, rating, and retry option.

## Non-obvious decisions

**Early Click Penalty**: Clicking early does not fail the entire run. Instead, it flags the current round as a foul, displays a red warning screen, and prompts the user to retry that specific round. This keeps the game playable and frustratingly addictive without being overly punitive.

**Keyboard & Mouse Integration**: Both space/left-click and the Enter key can be used to advance states. Enter is used for transitional screens (start, round result, game over) to prevent accidental double-clicks from skipping the waiting screen of the next round.

**Performance.now() Precision**: We use `performance.now()` for recording milliseconds, which provides sub-millisecond precision, free from local system clock adjustments.

**Global ranking (lower is better)**: unlike most games, the score is the average reaction time in ms, so this game is registered in `GAME_SCORING` (see root `CLAUDE.md`) with `direction: "lower"` and a `format` that appends `ms`. `endGame()` submits the average via `hud.showRanking("reaction-time", average)`.
