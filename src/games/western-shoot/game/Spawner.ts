import { Target } from "./Target";
import { Civilian } from "./Civilian";
import { Enemy } from "./Enemy";
import {
  DIFFICULTY_INTERVAL,
  SPEED_MULT_PER_LEVEL,
  MAX_TARGETS_BY_LEVEL,
  TARGET_SPAWN_INTERVAL_BASE,
  TARGET_SPAWN_INTERVAL_MIN,
  CIVILIAN_SPAWN_INTERVAL_BASE,
  CIVILIAN_SPAWN_INTERVAL_MIN,
  ENEMY_SPAWN_INTERVAL_BASE,
  ENEMY_SPAWN_INTERVAL_MIN,
  ENEMY_START_LEVEL,
  CIVILIAN_START_LEVEL,
  type TargetSize,
} from "./constants";

export class Spawner {
  level = 0;
  private elapsedTotal = 0;
  private targetTimer = 0;
  private civilianTimer = 0;
  private enemyTimer = 0;

  readonly targets: Target[] = [];
  readonly civilians: Civilian[] = [];
  readonly enemies: Enemy[] = [];

  get speedMult(): number {
    return this.level * SPEED_MULT_PER_LEVEL;
  }

  private get maxTargets(): number {
    const idx = Math.min(this.level, MAX_TARGETS_BY_LEVEL.length - 1);
    return MAX_TARGETS_BY_LEVEL[idx];
  }

  private get targetInterval(): number {
    return Math.max(
      TARGET_SPAWN_INTERVAL_MIN,
      TARGET_SPAWN_INTERVAL_BASE - this.level * 0.15,
    );
  }

  private get civilianInterval(): number {
    return Math.max(
      CIVILIAN_SPAWN_INTERVAL_MIN,
      CIVILIAN_SPAWN_INTERVAL_BASE - this.level * 0.6,
    );
  }

  private get enemyInterval(): number {
    return Math.max(
      ENEMY_SPAWN_INTERVAL_MIN,
      ENEMY_SPAWN_INTERVAL_BASE - this.level * 0.8,
    );
  }

  reset(): void {
    this.level = 0;
    this.elapsedTotal = 0;
    this.targetTimer = 0;
    this.civilianTimer = 0;
    this.enemyTimer = 0;
    this.targets.length = 0;
    this.civilians.length = 0;
    this.enemies.length = 0;
  }

  update(dt: number): void {
    this.elapsedTotal += dt;

    // ── Level up ────────────────────────────────────────────────────
    const newLevel = Math.floor(this.elapsedTotal / DIFFICULTY_INTERVAL);
    if (newLevel > this.level) {
      this.level = newLevel;
    }

    // ── Spawn targets ───────────────────────────────────────────────
    this.targetTimer += dt;
    if (this.targetTimer >= this.targetInterval) {
      this.targetTimer = 0;
      // Count active (non-destroying) targets
      const active = this.targets.filter(t => !t.destroying).length;
      if (active < this.maxTargets) {
        this.targets.push(new Target(this.pickTargetSize(), this.speedMult));
      }
    }

    // ── Spawn civilians ─────────────────────────────────────────────
    if (this.level >= CIVILIAN_START_LEVEL) {
      this.civilianTimer += dt;
      if (this.civilianTimer >= this.civilianInterval) {
        this.civilianTimer = 0;
        this.civilians.push(new Civilian(this.speedMult));
      }
    }

    // ── Spawn enemies ───────────────────────────────────────────────
    if (this.level >= ENEMY_START_LEVEL) {
      this.enemyTimer += dt;
      if (this.enemyTimer >= this.enemyInterval) {
        this.enemyTimer = 0;
        this.enemies.push(new Enemy(this.level));
      }
    }

    // ── Update entities ─────────────────────────────────────────────
    for (const t of this.targets) t.update(dt);
    for (const c of this.civilians) c.update(dt);
    for (const e of this.enemies) e.update(dt);

    // ── Remove dead / off-screen ────────────────────────────────────
    this.removeIf(this.targets, t => !t.alive || t.offScreen);
    this.removeIf(this.civilians, c => !c.alive || c.offScreen);
    this.removeIf(this.enemies, e => !e.alive);
  }

  private pickTargetSize(): TargetSize {
    const r = Math.random();
    // At higher levels, smaller targets become more frequent
    const smallChance = 0.15 + this.level * 0.04;
    const mediumChance = 0.35 + this.level * 0.02;
    if (r < smallChance) return "small";
    if (r < smallChance + mediumChance) return "medium";
    return "large";
  }

  private removeIf<T>(arr: T[], predicate: (item: T) => boolean): void {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (predicate(arr[i])) arr.splice(i, 1);
    }
  }
}
