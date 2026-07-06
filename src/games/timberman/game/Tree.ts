import * as THREE from "three";
import { toon, outlined, flatGeo } from "./materials";
import {
  BRANCH_CHANCE,
  BRANCH_COLOR,
  BRANCH_LENGTH,
  DROP_ANIM_TIME,
  LEAF_COLORS,
  MAX_SAME_SIDE_RUN,
  SAFE_START_SEGMENTS,
  SEG_HEIGHT,
  TRUNK_COLOR_A,
  TRUNK_COLOR_B,
  TRUNK_RADIUS,
  TRUNK_RING_COLOR,
  VISIBLE_SEGMENTS,
} from "./constants";

export type Side = "left" | "right";
export type Branch = "none" | Side;

interface Segment {
  branch: Branch;
  group: THREE.Group;
  branchHolder: THREE.Group;
  trunkMesh: THREE.Mesh;
  /** Which trunk shade this segment uses (kept stable as it shifts down). */
  shade: number;
}

interface FlyingLog {
  group: THREE.Group;
  vel: THREE.Vector3;
  spin: number;
  life: number;
}

interface FlyingLeaf {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
}

const TRUNK_SHADES = [toon(TRUNK_COLOR_A), toon(TRUNK_COLOR_B)];
const RING_MAT = toon(TRUNK_RING_COLOR);
const BRANCH_MAT = toon(BRANCH_COLOR);
const LEAF_MATS = LEAF_COLORS.map((c) => toon(c));

const trunkGeo = new THREE.CylinderGeometry(TRUNK_RADIUS, TRUNK_RADIUS * 1.02, SEG_HEIGHT, 18);
const ringGeo = new THREE.CylinderGeometry(TRUNK_RADIUS * 1.03, TRUNK_RADIUS * 1.03, SEG_HEIGHT * 0.1, 18);
const branchGeo = new THREE.CylinderGeometry(0.14, 0.19, BRANCH_LENGTH, 8);
const leafGeo = flatGeo(new THREE.IcosahedronGeometry(0.5, 0));

/** The stacked trunk: manages segment shifting, branch generation and chop juice. */
export class Tree {
  readonly group = new THREE.Group();
  private segments: Segment[] = [];
  private dropOffset = 0;
  private readonly flying: FlyingLog[] = [];
  private readonly flyingLeaves: FlyingLeaf[] = [];
  /** Branch of the last segment generated (the one directly below the next). */
  private lastBranch: Branch = "none";
  /** Length of the current same-side branch run, to force periodic gaps. */
  private sameSideRun = 0;

  constructor() {
    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
      const seg = this.buildSegment(i % 2);
      this.segments.push(seg);
      this.group.add(seg.group);
    }
    this.layout();
  }

  reset(): void {
    this.lastBranch = "none";
    this.sameSideRun = 0;
    this.dropOffset = 0;
    this.segments.forEach((seg, i) => {
      const branch = i < SAFE_START_SEGMENTS ? "none" : this.rollBranch();
      this.applySegment(seg, branch, Math.random() < 0.5 ? 0 : 1);
    });
    for (const log of this.flying) this.group.remove(log.group);
    this.flying.length = 0;
    for (const leaf of this.flyingLeaves) this.group.remove(leaf.mesh);
    this.flyingLeaves.length = 0;
    this.layout();
  }

  /** The branch sitting at the lumberjack's height (the log he chops into). */
  get bottomBranch(): Branch {
    return this.segments[0].branch;
  }

  /**
   * Chop from `side`: the bottom log flies off, the trunk drops one, and a fresh
   * segment spawns on top. Call after the death check against `bottomBranch`.
   */
  chop(side: Side): void {
    const bottom = this.segments.shift()!;
    this.spawnFlyingLog(bottom, side);
    this.spawnLeafBurst(side, bottom.group.position.y);
    // Recycle the bottom segment as the new top one.
    const branch = this.rollBranch();
    this.applySegment(bottom, branch, Math.random() < 0.5 ? 0 : 1);
    this.segments.push(bottom);
    this.dropOffset = SEG_HEIGHT;
    this.layout();
  }

  update(dt: number): void {
    if (this.dropOffset > 0) {
      this.dropOffset = Math.max(0, this.dropOffset - (SEG_HEIGHT / DROP_ANIM_TIME) * dt);
      this.group.position.y = this.dropOffset;
    } else {
      this.group.position.y = 0;
    }

    for (let i = this.flying.length - 1; i >= 0; i--) {
      const log = this.flying[i];
      log.vel.y -= 22 * dt;
      log.group.position.addScaledVector(log.vel, dt);
      log.group.rotation.z += log.spin * dt;
      log.life -= dt;
      if (log.life <= 0) {
        this.group.remove(log.group);
        this.flying.splice(i, 1);
      }
    }

    for (let i = this.flyingLeaves.length - 1; i >= 0; i--) {
      const leaf = this.flyingLeaves[i];
      leaf.vel.y -= 9.8 * dt; // Gravity
      leaf.vel.x *= 1 - 1.5 * dt; // Damping
      leaf.vel.z *= 1 - 1.5 * dt;
      leaf.mesh.position.addScaledVector(leaf.vel, dt);
      leaf.mesh.rotation.x += leaf.rotSpeed.x * dt;
      leaf.mesh.rotation.y += leaf.rotSpeed.y * dt;
      leaf.mesh.rotation.z += leaf.rotSpeed.z * dt;
      leaf.life -= dt;

      const scaleFrac = Math.max(0, leaf.life / leaf.maxLife);
      leaf.mesh.scale.setScalar(scaleFrac * leaf.startScale);

      if (leaf.life <= 0) {
        this.group.remove(leaf.mesh);
        this.flyingLeaves.splice(i, 1);
      }
    }
  }

  private layout(): void {
    this.segments.forEach((seg, i) => {
      seg.group.position.y = SEG_HEIGHT / 2 + i * SEG_HEIGHT;
    });
  }

  private rollBranch(): Branch {
    // Force a branch-free log once a same-side run gets long: it gives the player a
    // spot to switch sides and keeps same-side walls from feeling unfair.
    if (this.sameSideRun >= MAX_SAME_SIDE_RUN || Math.random() >= BRANCH_CHANCE) {
      this.lastBranch = "none";
      this.sameSideRun = 0;
      return "none";
    }
    // Never place a branch on the opposite side of the log directly below. To change
    // sides the player needs a branch-free gap, so a switch always lands on a clear
    // spot instead of chopping straight into a branch. If the log below has a branch,
    // stay on its side; otherwise pick freely.
    const side: Side = this.lastBranch !== "none" ? this.lastBranch : Math.random() < 0.5 ? "left" : "right";
    this.sameSideRun = this.lastBranch === side ? this.sameSideRun + 1 : 1;
    this.lastBranch = side;
    return side;
  }

  private buildSegment(shade: number): Segment {
    const group = new THREE.Group();
    const trunk = outlined(trunkGeo, TRUNK_SHADES[shade]);
    group.add(trunk);
    const ring = new THREE.Mesh(ringGeo, RING_MAT);
    ring.position.y = SEG_HEIGHT / 2 - SEG_HEIGHT * 0.05;
    group.add(ring);
    const branchHolder = new THREE.Group();
    group.add(branchHolder);
    const seg: Segment = {
      branch: "none",
      group,
      branchHolder,
      trunkMesh: trunk.children[0] as THREE.Mesh,
      shade,
    };
    this.applySegment(seg, "none", shade);
    return seg;
  }

  private applySegment(seg: Segment, branch: Branch, shade: number): void {
    seg.branch = branch;
    seg.shade = shade;
    seg.trunkMesh.material = TRUNK_SHADES[shade];
    seg.branchHolder.clear();
    if (branch === "none") return;
    const dir = branch === "left" ? -1 : 1;
    const branchMesh = outlined(branchGeo, BRANCH_MAT, 1.14);
    branchMesh.rotation.z = Math.PI / 2;
    branchMesh.position.set(dir * (TRUNK_RADIUS + BRANCH_LENGTH / 2), 0.02, 0);
    seg.branchHolder.add(branchMesh, makeFoliage(dir * (TRUNK_RADIUS + BRANCH_LENGTH)));
  }

  private spawnFlyingLog(seg: Segment, chopSide: Side): void {
    const group = new THREE.Group();
    const log = outlined(trunkGeo, TRUNK_SHADES[seg.shade]);
    group.add(log);
    group.position.set(0, seg.group.position.y, 0);
    group.rotation.z = Math.PI / 2;
    // Flies away from the side the lumberjack chopped from.
    const away = chopSide === "left" ? 1 : -1;
    this.group.add(group);
    this.flying.push({
      group,
      vel: new THREE.Vector3(away * (6 + Math.random() * 2), 5 + Math.random() * 2, 3),
      spin: away * (6 + Math.random() * 4),
      life: 1.4,
    });
  }

  private spawnLeafBurst(chopSide: Side, yPos: number): void {
    const leafCount = 8 + Math.floor(Math.random() * 5);
    const away = chopSide === "left" ? 1 : -1;

    for (let i = 0; i < leafCount; i++) {
      const mat = LEAF_MATS[Math.floor(Math.random() * LEAF_MATS.length)];
      const leafGroup = outlined(leafGeo, mat, 1.1).clone();
      const startScale = 0.12 + Math.random() * 0.16;
      leafGroup.scale.setScalar(startScale);

      // Spawn near the bottom segment trunk surface
      leafGroup.position.set(
        (Math.random() - 0.5) * 0.9,
        yPos + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.9
      );

      this.group.add(leafGroup);

      const vel = new THREE.Vector3(
        away * (2.5 + Math.random() * 4.5),
        2.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 3.5
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0
      );

      this.flyingLeaves.push({
        mesh: leafGroup,
        vel,
        rotSpeed,
        life: 0.9 + Math.random() * 0.5,
        maxLife: 0.9 + Math.random() * 0.5,
        startScale,
      });
    }
  }
}

/** A rounded leafy blob made of a few overlapping toon icosahedrons. */
function makeFoliage(x: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0.05, 0);
  const blobs = [
    { s: 1.35, p: [0, 0.1, 0] },
    { s: 0.95, p: [-0.35, 0.35, 0.2] },
    { s: 0.95, p: [0.35, 0.3, -0.15] },
    { s: 0.85, p: [0.1, -0.25, 0.3] },
  ];
  blobs.forEach((b, i) => {
    const blob = outlined(leafGeo, LEAF_MATS[i % LEAF_MATS.length], 1.08);
    blob.scale.setScalar(b.s);
    blob.position.set(b.p[0], b.p[1], b.p[2]);
    g.add(blob);
  });
  return g;
}
