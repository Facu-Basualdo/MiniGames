import * as THREE from "three";
import {
  COLLISION_TOLERANCE,
  DEBRIS_CELL,
  DEBRIS_COLOR,
  DEBRIS_KEEP_CHANCE,
  DEBRIS_OBJ_MAX_RADIUS,
  DEBRIS_OBJ_MIN_RADIUS,
  FIELD_HALF_HEIGHT,
  FIELD_HALF_WIDTH,
  HAZARD_COLOR,
  ICE_COLOR,
  PLAYER_HALF_HEIGHT,
  PLAYER_HALF_WIDTH,
  ROCK_COLOR,
} from "./constants";

export type ObstacleKind = "meteor" | "ice" | "debris";

export interface ObstacleConfig {
  kind: ObstacleKind;
  z: number;
  /** Center of the guaranteed clear lane (also used for reachability chaining). */
  centerX: number;
  centerY: number;
  laneHalfWidth: number;
  laneHalfHeight: number;
}

// Shared low-poly geometries (never disposed — reused for the whole session).
const ROCK_GEOM = new THREE.IcosahedronGeometry(1, 0);
const ICE_GEOM = new THREE.OctahedronGeometry(1, 0);
const BOX_GEOM = new THREE.BoxGeometry(1, 1, 1);
const CYL_GEOM = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 8);

interface Spinner {
  obj: THREE.Object3D;
  sx: number;
  sy: number;
  sz: number;
}

/**
 * A dense wall of drifting space objects packed across the whole cross-section
 * with a single clear lane cut out at its center — you can only get through via
 * that safe zone. Three visual kinds: `meteor` (rock), `ice` (crystal shards)
 * and `debris` (metal wreckage). The lane is framed by amber markers.
 */
export class Obstacle {
  readonly group: THREE.Group;
  readonly kind: ObstacleKind;
  readonly centerX: number;
  readonly centerY: number;
  resolved = false;

  private readonly laneHalfWidth: number;
  private readonly laneHalfHeight: number;
  private readonly disposables: Array<THREE.Material | THREE.BufferGeometry> = [];
  private readonly spinners: Spinner[] = [];

  constructor(cfg: ObstacleConfig) {
    this.kind = cfg.kind;
    this.centerX = cfg.centerX;
    this.centerY = cfg.centerY;
    this.laneHalfWidth = cfg.laneHalfWidth;
    this.laneHalfHeight = cfg.laneHalfHeight;
    this.group = new THREE.Group();
    this.group.position.z = cfg.z;

    this.buildField(cfg);
    this.buildLaneMarkers(cfg);
  }

  update(dt: number, dz: number): void {
    this.group.position.z += dz;
    for (const s of this.spinners) {
      s.obj.rotation.x += s.sx * dt;
      s.obj.rotation.y += s.sy * dt;
      s.obj.rotation.z += s.sz * dt;
    }
  }

  get z(): number {
    return this.group.position.z;
  }

  /** Safe only when the whole ship footprint sits inside the clear lane. */
  isSafe(px: number, py: number): boolean {
    return (
      Math.abs(px - this.centerX) + PLAYER_HALF_WIDTH <= this.laneHalfWidth + COLLISION_TOLERANCE &&
      Math.abs(py - this.centerY) + PLAYER_HALF_HEIGHT <= this.laneHalfHeight + COLLISION_TOLERANCE
    );
  }

  dispose(): void {
    for (const m of this.disposables) m.dispose();
    this.disposables.length = 0;
  }

  // --- Builders ---

  private material(kind: ObstacleKind): THREE.MeshStandardMaterial {
    if (kind === "ice") {
      return new THREE.MeshStandardMaterial({
        color: ICE_COLOR,
        metalness: 0.1,
        roughness: 0.15,
        emissive: ICE_COLOR,
        emissiveIntensity: 0.35,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
      });
    }
    if (kind === "debris") {
      return new THREE.MeshStandardMaterial({
        color: DEBRIS_COLOR,
        metalness: 0.9,
        roughness: 0.45,
        flatShading: true,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: ROCK_COLOR,
      metalness: 0.2,
      roughness: 0.95,
      flatShading: true,
    });
  }

  private buildField(cfg: ObstacleConfig): void {
    const mat = this.material(cfg.kind);
    this.disposables.push(mat);

    const laneHW = cfg.laneHalfWidth;
    const laneHH = cfg.laneHalfHeight;
    // Scatter debris across the whole cross-section (a touch past the edges) as a
    // sparse telegraph of the barrier — the real block is the invisible lane test.
    const edgeX = FIELD_HALF_WIDTH + DEBRIS_CELL * 0.5;
    const edgeY = FIELD_HALF_HEIGHT + DEBRIS_CELL * 0.5;

    // Jittered grid; skip the rectangular hole that is the clear lane.
    for (let gx = -edgeX; gx <= edgeX + 0.001; gx += DEBRIS_CELL) {
      for (let gy = -edgeY; gy <= edgeY + 0.001; gy += DEBRIS_CELL) {
        const jx = gx + (Math.random() * 2 - 1) * DEBRIS_CELL * 0.32;
        const jy = gy + (Math.random() * 2 - 1) * DEBRIS_CELL * 0.32;
        const r = DEBRIS_OBJ_MIN_RADIUS + Math.random() * (DEBRIS_OBJ_MAX_RADIUS - DEBRIS_OBJ_MIN_RADIUS);
        // Keep the lane hole clear (widened by the object radius so nothing pokes in).
        if (Math.abs(jx - cfg.centerX) < laneHW + r && Math.abs(jy - cfg.centerY) < laneHH + r) {
          continue;
        }
        // Random thinning for fine density control (the grid steps are coarse).
        if (Math.random() > DEBRIS_KEEP_CHANCE) continue;
        const mesh = this.makeObjectMesh(cfg.kind, mat, r);
        mesh.position.set(jx, jy, (Math.random() * 2 - 1) * 0.9);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.group.add(mesh);
        this.spinners.push({
          obj: mesh,
          sx: (Math.random() * 2 - 1) * 0.5,
          sy: (Math.random() * 2 - 1) * 0.5,
          sz: (Math.random() * 2 - 1) * 0.5,
        });
      }
    }
  }

  private makeObjectMesh(kind: ObstacleKind, mat: THREE.Material, r: number): THREE.Mesh {
    if (kind === "ice") {
      const mesh = new THREE.Mesh(ICE_GEOM, mat);
      // Elongated crystal shards.
      mesh.scale.set(r * 0.7, r * 1.5, r * 0.7);
      return mesh;
    }
    if (kind === "debris") {
      if (Math.random() < 0.5) {
        const mesh = new THREE.Mesh(BOX_GEOM, mat);
        mesh.scale.set(r * (0.7 + Math.random()), r * (0.7 + Math.random()), r * (0.7 + Math.random()));
        return mesh;
      }
      const mesh = new THREE.Mesh(CYL_GEOM, mat);
      mesh.scale.set(r * 0.8, r, r * 0.8);
      return mesh;
    }
    // Meteorite: lumpy rock.
    const mesh = new THREE.Mesh(ROCK_GEOM, mat);
    mesh.scale.set(r * (0.8 + Math.random() * 0.4), r * (0.8 + Math.random() * 0.4), r * (0.8 + Math.random() * 0.4));
    return mesh;
  }

  /** Glowing amber frame so the safe lane reads clearly. */
  private buildLaneMarkers(cfg: ObstacleConfig): void {
    const cx = cfg.centerX;
    const cy = cfg.centerY;
    const hw = cfg.laneHalfWidth;
    const hh = cfg.laneHalfHeight;


    // Glowing amber frame joining the four corners so the safe zone is obvious.
    const frameGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx - hw, cy - hh, 0),
      new THREE.Vector3(cx + hw, cy - hh, 0),
      new THREE.Vector3(cx + hw, cy + hh, 0),
      new THREE.Vector3(cx - hw, cy + hh, 0),
    ]);
    this.disposables.push(frameGeom);
    const frameMat = new THREE.LineBasicMaterial({
      color: HAZARD_COLOR,
      transparent: true,
      opacity: 0.85,
      depthWrite: false, // Prevents Z-fighting and clipping of transparent components (canopy/trail) when close
    });
    this.disposables.push(frameMat);
    this.group.add(new THREE.LineLoop(frameGeom, frameMat));
  }
}
