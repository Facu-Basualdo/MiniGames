import * as THREE from "three";
import {
  CATCH_X,
  CRASH_X,
  DRINK_TIME,
  END_X,
  FIRST_SPAWN_DELAY,
  GROUP_GAP,
  INFERNO_BLEND_S,
  INFERNO_GROUP,
  INFERNO_INTERVAL,
  INFERNO_PUNK,
  INFERNO_SPEED,
  INFERNO_START_S,
  LANE_COUNT,
  MIX_GROUP_END,
  MIX_GROUP_START,
  MIX_INTERVAL_END,
  MIX_INTERVAL_START,
  MIX_PUNK_END,
  MIX_PUNK_START,
  MIX_SPEED_END,
  MIX_SPEED_START,
  MUG_EMPTY_SPEED,
  MUG_FULL_SPEED,
  MUG_HIT_MARGIN,
  PUNK_SPEED_FACTOR,
  PUSHBACK_DIST,
  PUSHBACK_TIME,
  RITMO_END_S,
  RITMO_GROUP_END,
  RITMO_INTERVAL_END,
  RITMO_INTERVAL_START,
  RITMO_PUNK_END,
  RITMO_SPEED_END,
  RITMO_SPEED_START,
  SPAWN_CLEARANCE,
  SPAWN_X,
  TAP_X,
  TIP_CHANCE,
  TIP_SPEED,
  WALK_STRIDE,
  WARMUP_END_S,
  WARMUP_INTERVAL,
  WARMUP_SPEED,
} from "./constants";
import { laneCounterTopY, laneFloorY, lanePeopleZ, laneZ } from "./layout";
import {
  buildPatronFrames,
  makeSpritePlane,
  patronVariantCount,
  setSpriteFrame,
  PATRON_H,
  PATRON_W,
  type PatronFrames,
  type PatronKind,
} from "./sprites";
import { disposeMug, disposeTipCoin, makeMug, makeTipCoin, setMugFill, type MugMesh } from "./props";

const PATRON_HEIGHT_M = 1.62;
const PATRON_WIDTH_M = (PATRON_W / PATRON_H) * PATRON_HEIGHT_M;
/** How far past the catch window an incoming mug/tip survives before it
 *  falls off the bartender's end. */
const FALL_MARGIN = 0.4;

interface Customer {
  lane: number;
  x: number;
  speed: number;
  kind: PatronKind;
  /** Frame set of the visual variant this customer was born with. */
  frames: PatronFrames;
  state: "walking" | "drinking";
  /** Meters walked, drives the two-frame walk cycle. */
  walkDist: number;
  drinkTimer: number;
  pushFrom: number;
  pushTo: number;
  pushT: number;
  /** Satisfied: sliding off the far end, leaves for good. */
  exiting: boolean;
  mesh: THREE.Mesh;
}

type SliderKind = "beer" | "empty" | "tip";

interface Slider {
  lane: number;
  x: number;
  kind: SliderKind;
  obj: THREE.Object3D;
  mug: MugMesh | null;
}

export type LaneEvent =
  | { type: "served"; kind: PatronKind; satisfied: boolean }
  | { type: "escaped"; lane: number }
  | { type: "crashed"; lane: number }
  | { type: "mugFell"; lane: number }
  | { type: "caught"; what: "empty" | "tip" };

interface SpawnParams {
  interval: number;
  speed: number;
  punkChance: number;
  groupChance: number;
  lanes: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Difficulty phases, resolved per spawn from the elapsed play time. All
 *  four bars are open throughout (spawns spread across them, see pickLane);
 *  difficulty ramps via cadence, speed, punks and groups. A warmup, B ritmo
 *  (cadence climbs), C mezcla (punks and groups ramp in), D inferno (capped
 *  chaos, blended in smoothly). */
export function paramsAt(elapsed: number): SpawnParams {
  if (elapsed < WARMUP_END_S) {
    return {
      interval: WARMUP_INTERVAL,
      speed: WARMUP_SPEED,
      punkChance: 0,
      groupChance: 0,
      lanes: LANE_COUNT,
    };
  }
  if (elapsed < RITMO_END_S) {
    const t = (elapsed - WARMUP_END_S) / (RITMO_END_S - WARMUP_END_S);
    return {
      interval: lerp(RITMO_INTERVAL_START, RITMO_INTERVAL_END, t),
      speed: lerp(RITMO_SPEED_START, RITMO_SPEED_END, t),
      punkChance: lerp(0, RITMO_PUNK_END, t),
      groupChance: lerp(0, RITMO_GROUP_END, t),
      lanes: LANE_COUNT,
    };
  }
  if (elapsed < INFERNO_START_S) {
    const t = (elapsed - RITMO_END_S) / (INFERNO_START_S - RITMO_END_S);
    return {
      interval: lerp(MIX_INTERVAL_START, MIX_INTERVAL_END, t),
      speed: lerp(MIX_SPEED_START, MIX_SPEED_END, t),
      punkChance: lerp(MIX_PUNK_START, MIX_PUNK_END, t),
      groupChance: lerp(MIX_GROUP_START, MIX_GROUP_END, t),
      lanes: LANE_COUNT,
    };
  }
  // Blend from the end of phase C into the inferno so there is no cliff.
  const t = Math.min(1, (elapsed - INFERNO_START_S) / INFERNO_BLEND_S);
  return {
    interval: lerp(MIX_INTERVAL_END, INFERNO_INTERVAL, t),
    speed: lerp(MIX_SPEED_END, INFERNO_SPEED, t),
    punkChance: lerp(MIX_PUNK_END, INFERNO_PUNK, t),
    groupChance: lerp(MIX_GROUP_END, INFERNO_GROUP, t),
    lanes: LANE_COUNT,
  };
}

/** Simulation of the four bars: customer spawning and advance, beers
 *  sliding out, empties and tips sliding back, and every win/fail event.
 *  Owns the meshes (patron sprite planes, mug/coin props). */
export class Lanes {
  readonly object = new THREE.Group();

  private customers: Customer[] = [];
  private sliders: Slider[] = [];
  private spawnTimer = FIRST_SPAWN_DELAY;
  /** Frame sets per kind, one per visual variant, built once. */
  private readonly frames: Record<PatronKind, PatronFrames[]> = {
    regular: Array.from({ length: patronVariantCount("regular") }, (_, i) =>
      buildPatronFrames("regular", i),
    ),
    punk: [buildPatronFrames("punk")],
  };

  /** The frontmost sliding beer, for the Game's tracking glint. */
  frontBeer(): THREE.Object3D | null {
    let best: Slider | null = null;
    for (const s of this.sliders) {
      if (s.kind === "beer" && (!best || s.x < best.x)) best = s;
    }
    return best ? best.obj : null;
  }

  reset(): void {
    for (const c of this.customers) this.removeCustomerMesh(c);
    for (const s of this.sliders) this.removeSliderMesh(s);
    this.customers = [];
    this.sliders = [];
    this.spawnTimer = FIRST_SPAWN_DELAY;
  }

  /** A full mug leaves the tap and slides down the lane. */
  serve(lane: number): void {
    const mug = makeMug();
    setMugFill(mug, 1, true);
    this.placeSlider(mug.group, lane, TAP_X - 0.25);
    this.object.add(mug.group);
    this.sliders.push({ lane, x: TAP_X - 0.25, kind: "beer", obj: mug.group, mug });
  }

  /** Advances the whole bar one tick. `slowFactor` (tip show) only slows
   *  the customers — mugs keep their physics. Returns everything that
   *  happened so the Game can score, strike and light it. */
  update(dt: number, elapsed: number, slowFactor: number, bartenderLane: number): LaneEvent[] {
    const events: LaneEvent[] = [];

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) this.spawn(elapsed);

    // --- Customers ---
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.state === "walking") {
        c.x += c.speed * slowFactor * dt;
        c.walkDist += c.speed * slowFactor * dt;
        if (c.x >= END_X) {
          events.push({ type: "escaped", lane: c.lane });
          this.removeCustomer(i);
          continue;
        }
      } else {
        // Drinking: eased pushback slide, then the drink timer.
        if (c.pushT < 1) {
          c.pushT = Math.min(1, c.pushT + dt / PUSHBACK_TIME);
          const t = 1 - (1 - c.pushT) * (1 - c.pushT);
          c.x = lerp(c.pushFrom, c.pushTo, t);
        }
        c.drinkTimer -= dt;
        if (c.drinkTimer <= 0) {
          // The empty mug comes sliding back, always.
          this.spawnSlider("empty", c.lane, Math.max(c.x, SPAWN_X + 0.05));
          if (c.exiting) {
            if (Math.random() < TIP_CHANCE) {
              this.spawnSlider("tip", c.lane, SPAWN_X - 0.3);
            }
            this.removeCustomer(i);
            continue;
          }
          c.state = "walking";
        }
      }
      this.syncCustomer(c);
    }

    // --- Sliding props ---
    for (let i = this.sliders.length - 1; i >= 0; i--) {
      const s = this.sliders[i];
      if (s.kind === "beer") {
        s.x -= MUG_FULL_SPEED * dt;
        const catcher = this.frontWalker(s.lane, s.x);
        if (catcher) {
          this.startDrinking(catcher, events);
          this.removeSlider(i);
          continue;
        }
        if (s.x <= CRASH_X) {
          events.push({ type: "crashed", lane: s.lane });
          this.removeSlider(i);
          continue;
        }
      } else {
        s.x += (s.kind === "empty" ? MUG_EMPTY_SPEED : TIP_SPEED) * dt;
        if (s.x >= CATCH_X && bartenderLane === s.lane) {
          events.push({ type: "caught", what: s.kind === "empty" ? "empty" : "tip" });
          this.removeSlider(i);
          continue;
        }
        if (s.x >= CATCH_X + FALL_MARGIN) {
          if (s.kind === "empty") events.push({ type: "mugFell", lane: s.lane });
          this.removeSlider(i);
          continue;
        }
        // Tips tumble as they slide so the gold glints.
        if (s.kind === "tip") s.obj.rotateX(dt * 8);
      }
      this.placeSlider(s.obj, s.lane, s.x);
    }

    return events;
  }

  // ----------------------------------------------------------- internals --

  private spawn(elapsed: number): void {
    const params = paramsAt(elapsed);
    const lane = this.pickLane(params.lanes);
    if (lane === undefined) {
      this.spawnTimer = 0.4; // every open bar crowded at the entrance: retry soon
      return;
    }
    this.spawnCustomer(lane, SPAWN_X, params);
    if (Math.random() < params.groupChance) {
      this.spawnCustomer(lane, SPAWN_X - GROUP_GAP, params);
    }
    this.spawnTimer = params.interval * (0.85 + Math.random() * 0.3);
  }

  /** Send the next customer to the emptiest open bar that still has entrance
   *  room, random among ties — so they spread out instead of piling on one. */
  private pickLane(openLanes: number): number | undefined {
    const n = Math.min(openLanes, LANE_COUNT);
    let best: number[] = [];
    let bestLoad = Infinity;
    for (let lane = 0; lane < n; lane++) {
      if (!this.laneHasRoom(lane)) continue;
      const load = this.laneLoad(lane);
      if (load < bestLoad) {
        bestLoad = load;
        best = [lane];
      } else if (load === bestLoad) {
        best.push(lane);
      }
    }
    if (best.length === 0) return undefined;
    return best[Math.floor(Math.random() * best.length)];
  }

  /** How many customers (walking or drinking) currently occupy a bar. */
  private laneLoad(lane: number): number {
    let count = 0;
    for (const c of this.customers) if (c.lane === lane) count++;
    return count;
  }

  private laneHasRoom(lane: number): boolean {
    return !this.customers.some((c) => c.lane === lane && c.x < SPAWN_X + SPAWN_CLEARANCE);
  }

  private spawnCustomer(lane: number, x: number, params: SpawnParams): void {
    const kind: PatronKind = Math.random() < params.punkChance ? "punk" : "regular";
    const speed =
      params.speed * (kind === "punk" ? PUNK_SPEED_FACTOR : 1) * (0.92 + Math.random() * 0.16);
    const variants = this.frames[kind];
    const frames = variants[Math.floor(Math.random() * variants.length)];
    const mesh = makeSpritePlane(frames.walk[0], PATRON_WIDTH_M, PATRON_HEIGHT_M);
    this.object.add(mesh);
    const customer: Customer = {
      lane,
      x,
      speed,
      kind,
      frames,
      state: "walking",
      walkDist: Math.random(),
      drinkTimer: 0,
      pushFrom: 0,
      pushTo: 0,
      pushT: 0,
      exiting: false,
      mesh,
    };
    this.syncCustomer(customer);
    this.customers.push(customer);
  }

  /** The frontmost walking customer the sliding beer has reached. */
  private frontWalker(lane: number, mugX: number): Customer | null {
    let best: Customer | null = null;
    for (const c of this.customers) {
      if (c.lane !== lane || c.state !== "walking") continue;
      if (c.x + MUG_HIT_MARGIN >= mugX && (!best || c.x > best.x)) best = c;
    }
    return best;
  }

  private startDrinking(c: Customer, events: LaneEvent[]): void {
    const target = c.x - PUSHBACK_DIST;
    c.exiting = target <= SPAWN_X + 0.05;
    c.pushFrom = c.x;
    c.pushTo = c.exiting ? SPAWN_X - 0.4 : target;
    c.pushT = 0;
    c.drinkTimer = c.exiting ? PUSHBACK_TIME + 0.5 : DRINK_TIME;
    c.state = "drinking";
    events.push({ type: "served", kind: c.kind, satisfied: c.exiting });
  }

  private spawnSlider(kind: SliderKind, lane: number, x: number): void {
    if (kind === "tip") {
      const coin = makeTipCoin();
      this.placeSlider(coin, lane, x);
      this.object.add(coin);
      this.sliders.push({ lane, x, kind, obj: coin, mug: null });
      return;
    }
    const mug = makeMug(true);
    setMugFill(mug, 0, true);
    this.placeSlider(mug.group, lane, x);
    this.object.add(mug.group);
    this.sliders.push({ lane, x, kind, obj: mug.group, mug });
  }

  /** Mugs (groups, origin at their base) sit on the counter top; the coin
   *  (a mesh, origin at its center) floats one radius above the wood. */
  private placeSlider(obj: THREE.Object3D, lane: number, x: number): void {
    const isCoin = !(obj instanceof THREE.Group);
    obj.position.set(x, laneCounterTopY(lane) + (isCoin ? 0.09 : 0), laneZ(lane));
  }

  private syncCustomer(c: Customer): void {
    c.mesh.position.set(c.x, laneFloorY(c.lane) + PATRON_HEIGHT_M / 2, lanePeopleZ(c.lane));
    if (c.state === "drinking") {
      setSpriteFrame(c.mesh, c.frames.drink);
    } else {
      setSpriteFrame(c.mesh, c.frames.walk[Math.floor(c.walkDist / WALK_STRIDE) % 2]);
    }
  }

  private removeCustomer(index: number): void {
    this.removeCustomerMesh(this.customers[index]);
    this.customers.splice(index, 1);
  }

  private removeCustomerMesh(c: Customer): void {
    this.object.remove(c.mesh);
    c.mesh.geometry.dispose();
    (c.mesh.material as THREE.Material).dispose();
    (c.mesh.customDepthMaterial as THREE.Material | undefined)?.dispose();
  }

  private removeSlider(index: number): void {
    this.removeSliderMesh(this.sliders[index]);
    this.sliders.splice(index, 1);
  }

  private removeSliderMesh(s: Slider): void {
    this.object.remove(s.obj);
    if (s.mug) disposeMug(s.mug);
    else disposeTipCoin(s.obj as THREE.Mesh);
  }
}
