import {
  BASE_NOTE_SPEED,
  BASE_SPAWN_INTERVAL,
  FIGURES,
  GOOD_WINDOW,
  HIT_LINE_Y,
  LANE_COUNT,
  MAX_NOTE_SPEED,
  MIN_SPAWN_INTERVAL,
  MISS_WINDOW,
  NOTE_HALF_HEIGHT,
  PERFECT_WINDOW,
  SPAWN_DECAY_PER_POINT,
  SPEED_PER_POINT,
} from "./constants";

export interface Note {
  lane: number;
  /** Figure index into `FIGURES`: the shape drawn on the piece and the key the
   *  player must press to clear it. Chosen at random, independent of `lane`. */
  figure: number;
  /** Center Y in view units. Grows as the note falls. */
  y: number;
  /** True once judged (hit or auto-missed); kept briefly for a fade animation. */
  done: boolean;
  /** Seconds since the note was judged, used for the pop/fade effect. */
  fade: number;
  /** Fixed random hue (degrees) picked at spawn; the note keeps this color as
   *  it falls. Color is decorative — the arrow shape carries the identity. */
  hue: number;
}

export type Judgment = "perfect" | "good" | "miss";

/** Spawns, moves and recycles falling notes, and resolves lane taps into
 *  judgments. Difficulty (speed + spawn rate) ramps with the score. */
export class NoteField {
  readonly notes: Note[] = [];
  private spawnTimer = 0;
  /** Lane of the previous spawn, to avoid long same-lane streaks. */
  private lastLane = -1;
  /** Column of the note cleared by the last successful judge; -1 if none.
   *  Lets the caller flash the right column even for a figure (key) press. */
  lastHitLane = -1;

  reset(): void {
    this.notes.length = 0;
    this.spawnTimer = 0;
    this.lastLane = -1;
    this.lastHitLane = -1;
  }

  private speed(score: number): number {
    return Math.min(BASE_NOTE_SPEED + score * SPEED_PER_POINT, MAX_NOTE_SPEED);
  }

  private spawnInterval(score: number): number {
    return Math.max(BASE_SPAWN_INTERVAL - score * SPAWN_DECAY_PER_POINT, MIN_SPAWN_INTERVAL);
  }

  /** Advances notes. Returns how many notes auto-missed this frame (fell past
   *  the hit line without being tapped) so the caller can break the combo. */
  update(dt: number, score: number): number {
    const speed = this.speed(score);
    let autoMissed = 0;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer += this.spawnInterval(score);
    }

    for (const note of this.notes) {
      if (note.done) {
        note.fade += dt;
        continue;
      }
      note.y += speed * dt;
      if (note.y - HIT_LINE_Y > MISS_WINDOW) {
        note.done = true;
        note.fade = 0;
        autoMissed += 1;
      }
    }

    // Drop fully faded notes and anything that ran off the bottom.
    for (let i = this.notes.length - 1; i >= 0; i--) {
      if (this.notes[i].fade > 0.25) this.notes.splice(i, 1);
    }

    return autoMissed;
  }

  private spawn(): void {
    let lane = Math.floor(Math.random() * LANE_COUNT);
    // Avoid three identical lanes in a row so patterns feel less repetitive.
    if (lane === this.lastLane && Math.random() < 0.7) {
      lane = (lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT;
    }
    this.lastLane = lane;

    // Figure is independent of the lane: any shape can fall in any column.
    const figure = Math.floor(Math.random() * FIGURES.length);
    this.notes.push({ lane, figure, y: -NOTE_HALF_HEIGHT, done: false, fade: 0, hue: Math.random() * 360 });
  }

  /** Judges a figure-key press against the nearest un-judged note of that
   *  figure, regardless of which column it's in. Returns null when no matching
   *  note is close enough (an empty press). */
  tapFigure(figure: number): Judgment | null {
    return this.judge((note) => note.figure === figure);
  }

  /** Judges a touch/click on a column against the nearest un-judged note in
   *  that column. Returns null when there's no note close enough. */
  tapLane(lane: number): Judgment | null {
    return this.judge((note) => note.lane === lane);
  }

  private judge(matches: (note: Note) => boolean): Judgment | null {
    let best: Note | null = null;
    let bestDist = Infinity;
    for (const note of this.notes) {
      if (note.done || !matches(note)) continue;
      const dist = Math.abs(note.y - HIT_LINE_Y);
      if (dist < bestDist) {
        bestDist = dist;
        best = note;
      }
    }

    if (!best || bestDist > GOOD_WINDOW) {
      this.lastHitLane = -1;
      return null;
    }

    best.done = true;
    best.fade = 0;
    this.lastHitLane = best.lane;
    return bestDist <= PERFECT_WINDOW ? "perfect" : "good";
  }
}
