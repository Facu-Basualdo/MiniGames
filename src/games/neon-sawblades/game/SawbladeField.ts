import {
  COIN_GRAVITY,
  COIN_LIFETIME,
  COIN_POINTS,
  COIN_POP_VY,
  COIN_RADIUS,
  COIN_TIME_BONUS,
  FLOOR_Y,
  MAX_SAWS,
  MIN_SAWS,
  PLAYER_WIDTH,
  REFILL_INTERVAL,
  RAMP_DURATION,
  SAW_BOUNCE,
  SAW_GRAVITY,
  SAW_MAX_BOUNCE_VY,
  SAW_RADIUS,
  SAW_SETTLE_VY,
  SAW_SPAWN_VX_MAX,
  SAW_SPAWN_VX_MIN,
  SAW_SPAWN_VY_MAX,
  SAW_SPAWN_VY_MIN,
  SAW_SPIN,
  SAW_TIME_BONUS,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_START,
  VIEW_WIDTH,
} from "./constants";
import type { Player } from "./Player";

export interface Sawblade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  /** Sign of (player.x - saw.x) last frame, to detect crossing the centre. */
  prevRelX: number;
  /** Clear-arc state: 0 = not clearing; ±1 = crossed the centre from above and
   *  is heading to that side — the clear confirms once the player descends to
   *  the blade's base on that far side (a real jump *over* it). */
  arc: number;
}

export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/** A one-off particle-burst request emitted by the field for the Game to play. */
export interface Burst {
  x: number;
  y: number;
  kind: "saw" | "coin";
}

/** Result of one field update, applied by Game (score / time / sounds / fx). */
export interface FieldResult {
  died: boolean;
  sawsDestroyed: number;
  coinsCollected: number;
  points: number;
  timeGained: number;
  bursts: Burst[];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const rand = (min: number, max: number): number => min + Math.random() * (max - min);

/** Owns every sawblade and coin: spawning, physics, and the collision rules
 *  (jump *over* a blade to destroy it; touch it any other way and you die). */
export class SawbladeField {
  readonly saws: Sawblade[] = [];
  readonly coins: Coin[] = [];

  private elapsed = 0;
  /** First blade drops shortly after the run starts, not after a full gap. */
  private spawnTimer = 0.3;

  reset(): void {
    this.saws.length = 0;
    this.coins.length = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.3;
  }

  /** Current gap between spawns, easing from START to MIN over the ramp. */
  private spawnInterval(): number {
    const t = Math.min(this.elapsed / RAMP_DURATION, 1);
    return lerp(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, t);
  }

  private spawnSaw(): void {
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.saws.push({
      x: rand(SAW_RADIUS * 2, VIEW_WIDTH - SAW_RADIUS * 2),
      y: -SAW_RADIUS,
      vx: dir * rand(SAW_SPAWN_VX_MIN, SAW_SPAWN_VX_MAX),
      vy: rand(SAW_SPAWN_VY_MIN, SAW_SPAWN_VY_MAX),
      spin: Math.random() * Math.PI * 2,
      prevRelX: 0,
      arc: 0,
    });
  }

  update(dt: number, player: Player): FieldResult {
    this.elapsed += dt;
    const result: FieldResult = {
      died: false,
      sawsDestroyed: 0,
      coinsCollected: 0,
      points: 0,
      timeGained: 0,
      bursts: [],
    };

    // --- Spawn ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.saws.length < MAX_SAWS) this.spawnSaw();
      // Refill fast while under the minimum so the room is never near-empty.
      this.spawnTimer = this.saws.length < MIN_SAWS ? REFILL_INTERVAL : this.spawnInterval();
    }

    // --- Sawblades: physics + collision ---
    const left = player.x - PLAYER_WIDTH / 2;
    const right = player.x + PLAYER_WIDTH / 2;
    const bottom = player.y;

    for (let i = this.saws.length - 1; i >= 0; i--) {
      const saw = this.saws[i];
      saw.spin += SAW_SPIN * dt;
      saw.vy += SAW_GRAVITY * dt;
      saw.x += saw.vx * dt;
      saw.y += saw.vy * dt;

      // Bounce off the side walls.
      if (saw.x - SAW_RADIUS < 0) {
        saw.x = SAW_RADIUS;
        saw.vx = Math.abs(saw.vx);
      } else if (saw.x + SAW_RADIUS > VIEW_WIDTH) {
        saw.x = VIEW_WIDTH - SAW_RADIUS;
        saw.vx = -Math.abs(saw.vx);
      }

      // Bounce off the floor, capped low so blades stay jumpable and settle
      // into a roll rather than rocketing back up the screen.
      if (saw.y + SAW_RADIUS > FLOOR_Y) {
        saw.y = FLOOR_Y - SAW_RADIUS;
        const bounce = Math.min(Math.abs(saw.vy) * SAW_BOUNCE, SAW_MAX_BOUNCE_VY);
        saw.vy = bounce < SAW_SETTLE_VY ? 0 : -bounce;
      }

      // Collision resolution, faithful to the original: any contact with the
      // blade is lethal; you destroy it only by clearing it — jumping *over* it
      // from one side to the other. The clear arms when the player crosses the
      // blade's centre from above, and only confirms once the player descends
      // to the blade's current base on the far side without ever touching it
      // (touching the blade to reach that base is impossible without dying, so
      // this forces the full over-arc).
      const relX = player.x - saw.x;
      const cx = clamp(saw.x, left, right);
      const cy = clamp(saw.y, player.top, bottom);
      const dx = saw.x - cx;
      const dy = saw.y - cy;
      const contact = dx * dx + dy * dy <= SAW_RADIUS * SAW_RADIUS;

      if (contact) {
        result.died = true;
      } else if (saw.arc === 0) {
        // Arm: crossed the centre, airborne, feet above the top edge.
        const crossedCentre = saw.prevRelX * relX < 0;
        if (crossedCentre && !player.onGround && player.y <= saw.y - SAW_RADIUS) {
          saw.arc = Math.sign(relX) || 1;
        }
      } else {
        const side = Math.sign(relX);
        if (side === -saw.arc) {
          // Turned back to the entry side before completing the arc → cancel.
          saw.arc = 0;
        } else if (player.y >= saw.y + SAW_RADIUS) {
          // Descended to the blade's base on the far side → cleared.
          result.bursts.push({ x: saw.x, y: saw.y, kind: "saw" });
          this.saws.splice(i, 1);
          this.spawnCoin(saw.x, saw.y);
          result.sawsDestroyed += 1;
          result.timeGained += SAW_TIME_BONUS;
          continue;
        }
      }
      saw.prevRelX = relX;
    }

    // --- Coins: physics + collection ---
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.vy += COIN_GRAVITY * dt;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      coin.life -= dt;

      if (coin.x - COIN_RADIUS < 0) {
        coin.x = COIN_RADIUS;
        coin.vx = Math.abs(coin.vx);
      } else if (coin.x + COIN_RADIUS > VIEW_WIDTH) {
        coin.x = VIEW_WIDTH - COIN_RADIUS;
        coin.vx = -Math.abs(coin.vx);
      }

      // Settle on the floor with a small damped bounce.
      if (coin.y + COIN_RADIUS > FLOOR_Y) {
        coin.y = FLOOR_Y - COIN_RADIUS;
        coin.vy = Math.abs(coin.vy) > 120 ? -Math.abs(coin.vy) * 0.4 : 0;
        coin.vx *= 0.86;
      }

      if (coin.life <= 0) {
        this.coins.splice(i, 1);
        continue;
      }

      const cx = clamp(coin.x, left, right);
      const cy = clamp(coin.y, player.top, bottom);
      const dx = coin.x - cx;
      const dy = coin.y - cy;
      if (dx * dx + dy * dy <= COIN_RADIUS * COIN_RADIUS) {
        result.bursts.push({ x: coin.x, y: coin.y, kind: "coin" });
        this.coins.splice(i, 1);
        result.coinsCollected += 1;
        result.points += COIN_POINTS;
        result.timeGained += COIN_TIME_BONUS;
      }
    }

    return result;
  }

  private spawnCoin(x: number, y: number): void {
    this.coins.push({
      x,
      y,
      vx: rand(-80, 80),
      vy: -COIN_POP_VY,
      life: COIN_LIFETIME,
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
