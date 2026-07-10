import * as THREE from "three";
import { Mailbox } from "./Mailbox";
import {
  MAILBOX_ACTIVE,
  MAILBOX_SPAWN_Z,
  MAILBOX_DESPAWN_MARGIN,
  MAILBOX_SPACING_START,
  MAILBOX_SPACING_MIN,
  MAILBOX_MISS_Z,
  THROW_RANGE_Z,
  SCOOTER_Z,
} from "./constants";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Spawns roadside customers (mailboxes) ahead and scrolls them toward the camera.
 * Tracks which ones are still pending and reports how many were *missed* this
 * frame (passed the scooter undelivered) so the game can break the combo.
 */
export class MailboxField {
  private readonly scene: THREE.Scene;
  private readonly boxes: Mailbox[] = [];
  private nextSpawnZ = MAILBOX_SPAWN_Z;
  private lastSide: -1 | 1 = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  reset(): void {
    for (const b of this.boxes) this.scene.remove(b.group);
    this.boxes.length = 0;
    this.nextSpawnZ = MAILBOX_SPAWN_Z;
  }

  /** Advances customers; returns the number missed (undelivered) this frame. */
  update(dt: number, dz: number, d: number): number {
    let missed = 0;
    for (const b of this.boxes) {
      b.update(dz, dt);
      if (b.pending && b.z > MAILBOX_MISS_Z) {
        b.markMissed();
        missed++;
      }
    }

    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (b.z > SCOOTER_Z + MAILBOX_DESPAWN_MARGIN) {
        this.scene.remove(b.group);
        this.boxes.splice(i, 1);
      }
    }

    const spacing = lerp(MAILBOX_SPACING_START, MAILBOX_SPACING_MIN, d);
    while (this.boxes.length < MAILBOX_ACTIVE) {
      // Alternate sides most of the time, occasionally repeat, so both verges stay busy.
      const side: -1 | 1 = Math.random() < 0.75 ? (-this.lastSide as -1 | 1) : this.lastSide;
      this.lastSide = side;
      const b = new Mailbox(side, this.nextSpawnZ);
      this.boxes.push(b);
      this.scene.add(b.group);
      this.nextSpawnZ -= spacing;
    }
    return missed;
  }

  /** The best pending customer to auto-aim a thrown pizza at: the closest one
   *  still ahead of the scooter and within throwing range. */
  nearestPendingTarget(): Mailbox | null {
    let best: Mailbox | null = null;
    for (const b of this.boxes) {
      if (!b.pending) continue;
      if (b.z > MAILBOX_MISS_Z || b.z < -THROW_RANGE_Z) continue;
      if (!best || b.z > best.z) best = b; // greatest z = closest / most urgent
    }
    return best;
  }
}
