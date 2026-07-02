import * as THREE from "three";
import {
  BALL_LINGER,
  BALL_RADIUS,
  CADENCE_END_S,
  DOUBLE_DELAY_AFTER_HIGH,
  DOUBLE_MAX_SPREAD,
  CADENCE_FLIGHT_END,
  CADENCE_FLIGHT_START,
  CADENCE_HIGH_CHANCE,
  CADENCE_INTERVAL_END,
  CADENCE_INTERVAL_START,
  CURVE_MAX_AMOUNT,
  CURVE_MIN_AMOUNT,
  DOUBLE_DELAY,
  FIRST_KICK_DELAY,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  INFERNO_BLEND_S,
  INFERNO_CURVE_CHANCE,
  INFERNO_CURVED_FLIGHT,
  INFERNO_DOUBLE_CHANCE,
  INFERNO_HIGH_CHANCE,
  INFERNO_INTERVAL,
  INFERNO_START_S,
  INFERNO_STRAIGHT_FLIGHT,
  KEEPER_Z,
  MIX_CURVE_CHANCE_END,
  MIX_CURVE_CHANCE_START,
  MIX_CURVED_FLIGHT_END,
  MIX_CURVED_FLIGHT_START,
  MIX_DOUBLE_CHANCE,
  MIX_HIGH_END,
  MIX_HIGH_START,
  MIX_INTERVAL_END,
  MIX_INTERVAL_START,
  MIX_STRAIGHT_FLIGHT_END,
  MIX_STRAIGHT_FLIGHT_START,
  PENALTY_SPOT_Z,
  RUNUP_TIME,
  STANDING_REACH,
  TARGET_MARGIN,
  WARMUP_FLIGHT,
  WARMUP_INTERVAL,
  WARMUP_KICKS,
} from "./constants";
import type { Kicker } from "./Kicker";
import { buildBallTexture } from "./sprites";

export interface Shot {
  mesh: THREE.Mesh;
  /** Target on the keeper plane, where the shot is judged. */
  tx: number;
  ty: number;
  /** Peak sideways bend of a curved shot (0 = straight), m. */
  curve: number;
  /** 0 → 1 flight progress; judged when it reaches 1. */
  progress: number;
  flightTime: number;
  /** Arc peak above the straight line, m. */
  arc: number;
  resolved: "save" | "goal" | null;
  /** Seconds since resolution; drives the deflection / fly-past + fade. */
  fade: number;
  /** World velocity at resolution, m/s. */
  exitVelocity: THREE.Vector3;
}

/** Per-kick difficulty values, resolved by phase (see constants.ts). */
interface KickParams {
  interval: number;
  straightFlight: number;
  curvedFlight: number;
  highChance: number;
  curveChance: number;
  doubleChance: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Schedules kicks (driving the Kicker's telegraph animation), flies balls
 *  to their goal-plane target and reports arrivals for the Game to judge.
 *  Difficulty runs through four hand-tuned phases: warmup kicks, cadence
 *  climb, the curved/fast mix, and the inferno. */
export class ShotField {
  readonly object = new THREE.Group();
  readonly shots: Shot[] = [];

  private kickCount = 0;
  private nextKickAt = FIRST_KICK_DELAY;
  private runupCued = false;
  /** Pending second ball of a double kick (absolute time), or -1. */
  private doubleKickAt = -1;
  /** Where the first ball of the pending double went, to cap the spread. */
  private doubleAnchorTx = 0;

  private readonly kicker: Kicker;
  private readonly onKick: () => void;
  private readonly ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 10, 8);
  private readonly ballMaterial: THREE.MeshStandardMaterial;

  constructor(kicker: Kicker, onKick: () => void) {
    this.kicker = kicker;
    this.onKick = onKick;
    this.ballMaterial = new THREE.MeshStandardMaterial({
      map: buildBallTexture(),
      roughness: 0.55,
      // A touch of self-light so the ball pops at night without glowing.
      emissive: 0xffffff,
      emissiveIntensity: 0.07,
    });
  }

  reset(): void {
    for (const shot of this.shots) this.object.remove(shot.mesh);
    this.shots.length = 0;
    this.kickCount = 0;
    this.nextKickAt = FIRST_KICK_DELAY;
    this.runupCued = false;
    this.doubleKickAt = -1;
  }

  /** Difficulty for the next kick. Phases (see constants.ts):
   *  A) the first WARMUP_KICKS shots are gifts; B) until CADENCE_END_S only
   *  the kick rate climbs; C) until INFERNO_START_S curved balls and fast
   *  straight ones ramp in together; D) inferno, blended in over a few
   *  seconds so there's no cliff. */
  private paramsAt(elapsed: number): KickParams {
    if (this.kickCount < WARMUP_KICKS) {
      return {
        interval: WARMUP_INTERVAL,
        straightFlight: WARMUP_FLIGHT,
        curvedFlight: WARMUP_FLIGHT,
        highChance: 0,
        curveChance: 0,
        doubleChance: 0,
      };
    }

    if (elapsed < CADENCE_END_S) {
      const p = elapsed / CADENCE_END_S;
      return {
        interval: lerp(CADENCE_INTERVAL_START, CADENCE_INTERVAL_END, p),
        straightFlight: lerp(CADENCE_FLIGHT_START, CADENCE_FLIGHT_END, p),
        curvedFlight: lerp(CADENCE_FLIGHT_START, CADENCE_FLIGHT_END, p),
        highChance: CADENCE_HIGH_CHANCE,
        curveChance: 0,
        doubleChance: 0,
      };
    }

    if (elapsed < INFERNO_START_S) {
      const p = (elapsed - CADENCE_END_S) / (INFERNO_START_S - CADENCE_END_S);
      return {
        interval: lerp(MIX_INTERVAL_START, MIX_INTERVAL_END, p),
        straightFlight: lerp(MIX_STRAIGHT_FLIGHT_START, MIX_STRAIGHT_FLIGHT_END, p),
        curvedFlight: lerp(MIX_CURVED_FLIGHT_START, MIX_CURVED_FLIGHT_END, p),
        highChance: lerp(MIX_HIGH_START, MIX_HIGH_END, p),
        curveChance: lerp(MIX_CURVE_CHANCE_START, MIX_CURVE_CHANCE_END, p),
        doubleChance: p > 0.5 ? MIX_DOUBLE_CHANCE : 0,
      };
    }

    // Inferno, eased in from phase C's end values.
    const p = Math.min((elapsed - INFERNO_START_S) / INFERNO_BLEND_S, 1);
    return {
      interval: lerp(MIX_INTERVAL_END, INFERNO_INTERVAL, p),
      straightFlight: lerp(MIX_STRAIGHT_FLIGHT_END, INFERNO_STRAIGHT_FLIGHT, p),
      curvedFlight: lerp(MIX_CURVED_FLIGHT_END, INFERNO_CURVED_FLIGHT, p),
      highChance: lerp(MIX_HIGH_END, INFERNO_HIGH_CHANCE, p),
      curveChance: lerp(MIX_CURVE_CHANCE_END, INFERNO_CURVE_CHANCE, p),
      doubleChance: lerp(MIX_DOUBLE_CHANCE, INFERNO_DOUBLE_CHANCE, p),
    };
  }

  /** Advances the kick schedule and every ball. Returns shots that reached
   *  the keeper plane this frame. */
  update(dt: number, elapsed: number): Shot[] {
    // Cue the run-up so the swing lands exactly on the kick moment.
    if (!this.runupCued && elapsed >= this.nextKickAt - RUNUP_TIME) {
      this.kicker.beginRunup(Math.min(RUNUP_TIME, this.nextKickAt - elapsed));
      this.runupCued = true;
    }

    if (elapsed >= this.nextKickAt) {
      const params = this.paramsAt(elapsed);
      const first = this.kick(params);
      if (Math.random() < params.doubleChance) {
        // A high first ball forces a jump; give the landing a beat before
        // the second arrives so the double stays saveable.
        this.doubleKickAt = elapsed + (first.high ? DOUBLE_DELAY_AFTER_HIGH : DOUBLE_DELAY);
        this.doubleAnchorTx = first.tx;
      }
      this.nextKickAt = elapsed + params.interval;
      this.runupCued = false;
    }

    if (this.doubleKickAt >= 0 && elapsed >= this.doubleKickAt) {
      this.doubleKickAt = -1;
      this.kick(this.paramsAt(elapsed), this.doubleAnchorTx);
    }

    const arrived: Shot[] = [];
    for (const shot of this.shots) {
      if (shot.resolved) {
        shot.fade += dt;
        shot.mesh.position.addScaledVector(shot.exitVelocity, dt);
        // Saves drop back to the turf; conceded balls fly on past the camera.
        if (shot.resolved === "save") shot.exitVelocity.y -= 9 * dt;
        const alpha = Math.max(0, 1 - shot.fade / BALL_LINGER);
        (shot.mesh.material as THREE.MeshStandardMaterial).opacity = alpha;
        continue;
      }
      shot.progress += dt / shot.flightTime;
      this.positionShot(shot);
      if (shot.progress >= 1) arrived.push(shot);
    }

    for (let i = this.shots.length - 1; i >= 0; i--) {
      if (this.shots[i].fade > BALL_LINGER) {
        this.object.remove(this.shots[i].mesh);
        this.shots.splice(i, 1);
      }
    }

    return arrived;
  }

  /** The unresolved ball closest to arriving (for the tracking light). */
  nearestShot(): Shot | null {
    let best: Shot | null = null;
    for (const shot of this.shots) {
      if (shot.resolved) continue;
      if (!best || shot.progress > best.progress) best = shot;
    }
    return best;
  }

  /** Launches a ball and fires the kick pose + sound. The second ball of a
   *  double (`anchorTx` set) is constrained to stay fair: it lands within
   *  DOUBLE_MAX_SPREAD of the first ball, low and straight — the challenge
   *  is the cadence, not an impossible cross-goal split. */
  private kick(params: KickParams, anchorTx?: number): { tx: number; high: boolean } {
    this.kicker.strike();
    this.onKick();
    this.kickCount += 1;

    const maxTx = GOAL_HALF_WIDTH - TARGET_MARGIN;
    let tx = (Math.random() * 2 - 1) * maxTx;
    if (anchorTx !== undefined) {
      tx = anchorTx + (Math.random() * 2 - 1) * DOUBLE_MAX_SPREAD;
      tx = Math.min(maxTx, Math.max(-maxTx, tx));
    }

    const high = anchorTx === undefined && Math.random() < params.highChance;
    const ty = high
      ? STANDING_REACH + 0.08 + Math.random() * (GOAL_HEIGHT - TARGET_MARGIN - STANDING_REACH - 0.08)
      : 0.12 + Math.random() * (STANDING_REACH - 0.35);

    // Curved balls fly slower but bend; straight ones are the fast threat.
    // The second ball of a double never curves (its path must be readable).
    const curved = anchorTx === undefined && Math.random() < params.curveChance;
    let curve = 0;
    if (curved) {
      const amount = CURVE_MIN_AMOUNT + Math.random() * (CURVE_MAX_AMOUNT - CURVE_MIN_AMOUNT);
      curve = Math.random() < 0.5 ? -amount : amount;
    }

    const material = this.ballMaterial.clone();
    material.transparent = true;
    const mesh = new THREE.Mesh(this.ballGeometry, material);
    mesh.castShadow = true;
    mesh.position.set(0, BALL_RADIUS, PENALTY_SPOT_Z);
    this.object.add(mesh);

    this.shots.push({
      mesh,
      tx,
      ty,
      curve,
      progress: 0,
      flightTime: curved ? params.curvedFlight : params.straightFlight,
      arc: high ? 0.25 : 0.45 + Math.random() * 0.5,
      resolved: null,
      fade: 0,
      exitVelocity: new THREE.Vector3(),
    });

    return { tx, high };
  }

  /** Parametric flight: spot → target with an arc and an optional bend. */
  private positionShot(shot: Shot): void {
    const p = Math.min(shot.progress, 1);
    const bend = Math.sin(Math.PI * p) * shot.curve;
    const x = shot.tx * p + bend;
    const y = lerp(BALL_RADIUS, shot.ty, p) + Math.sin(Math.PI * p) * shot.arc;
    const z = lerp(PENALTY_SPOT_Z, KEEPER_Z, p);
    shot.mesh.position.set(x, y, z);
    shot.mesh.rotation.x -= (12 / shot.flightTime) * 0.016;
  }

  /** World velocity of a shot right as it arrives (for deflections). */
  arrivalVelocity(shot: Shot, out: THREE.Vector3): THREE.Vector3 {
    const speed = (PENALTY_SPOT_Z - KEEPER_Z) / shot.flightTime;
    return out.set(shot.tx / shot.flightTime, (shot.ty - BALL_RADIUS) / shot.flightTime, -speed);
  }
}
