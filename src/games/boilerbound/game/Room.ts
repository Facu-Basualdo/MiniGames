import * as THREE from "three";
import type { ModelSet } from "./Models";
import { toonify } from "./toon";
import {
  BRONZE_COLOR,
  CEILING_Y,
  FLOOR_Y,
  LAMP_COLOR,
  METAL_COLOR,
  METAL_DARK,
  ROOM_HALF_WIDTH,
} from "./constants";

const WIDTH = ROOM_HALF_WIDTH * 2;

/** Fallback cog (used only if gear.glb fails to load): a low-poly toothed disc. */
function makeGear(radius: number, teeth: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.3, teeth), mat);
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, radius * 0.12, 8, teeth), mat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.36, 12), mat);
  hub.rotation.x = Math.PI / 2;
  g.add(disc, rim, hub);
  return g;
}

/**
 * The boiler room seen head-on. In the cartoon look (the default, when the
 * painted `backdrop` loaded) the **painting carries the scenery** — arches,
 * gears, pipes, lanterns, crystals are all in the image — so the live geometry
 * is just the toon-shaded **floor** in front of the backdrop plane. The live
 * spinning gears / pipe props only appear as a fallback if the backdrop image
 * is missing (the old flat-panel room). Everything is cel-shaded via `toonify`.
 */
export class Room {
  readonly group = new THREE.Group();
  private readonly gears: { mesh: THREE.Object3D; speed: number }[] = [];

  constructor(models: ModelSet, gradientMap?: THREE.Texture) {
    const cartoon = !!models.backdrop;
    const metal = new THREE.MeshStandardMaterial({ color: METAL_COLOR, metalness: 0.85, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: METAL_DARK, metalness: 0.8, roughness: 0.6 });

    // Floor (always): the ground the player and vents sit on.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 2, 0.5, 4), metal);
    floor.position.set(0, FLOOR_Y - 0.25, 0);
    this.group.add(floor);

    if (cartoon) {
      // Painted cavern fills the whole background; the play area sits in front.
      const geo = new THREE.PlaneGeometry(34, 19);
      const mat = new THREE.MeshBasicMaterial({ map: models.backdrop, toneMapped: false });
      const plane = new THREE.Mesh(geo, mat);
      plane.position.set(0, CEILING_Y / 2 - 0.3, -3.0);
      this.group.add(plane);
    } else {
      this.buildFallbackRoom(models, dark);
    }

    // Cel-shade every lit prop (floor, and the fallback room). The backdrop plane
    // is MeshBasic and the steam/sparks are points, so toonify leaves them alone.
    if (gradientMap) toonify(this.group, gradientMap);
  }

  /** The original flat-panel room, kept for when the painted backdrop is missing. */
  private buildFallbackRoom(models: ModelSet, dark: THREE.MeshStandardMaterial): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a4436, metalness: 0.8, roughness: 0.5 });
    const bronze = new THREE.MeshStandardMaterial({
      color: BRONZE_COLOR,
      metalness: 0.95,
      roughness: 0.35,
      emissive: 0x2a1c08,
      emissiveIntensity: 0.6,
    });

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 2, 0.4, 4), dark);
    ceiling.position.set(0, CEILING_Y + 0.2, 0);
    this.group.add(ceiling);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, CEILING_Y + 0.8, 3), wallMat);
      wall.position.set(side * (ROOM_HALF_WIDTH + 0.25), CEILING_Y / 2, -0.2);
      this.group.add(wall);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 2, CEILING_Y + 1, 0.4), dark);
    back.position.set(0, CEILING_Y / 2, -2);
    this.group.add(back);
    this.buildRivets(bronze);

    const gearDefs: [number, number, number, number, number][] = [
      [-5.2, 6.6, 1.6, 16, 0.25],
      [-3.4, 5.4, 1.0, 12, -0.4],
      [4.8, 6.9, 2.0, 20, -0.18],
      [6.4, 4.6, 1.1, 12, 0.35],
      [0.2, 7.7, 0.9, 10, 0.5],
    ];
    for (const [gx, gy, r, teeth, speed] of gearDefs) {
      const mesh = models.gear ? models.gear.clone(true) : makeGear(r, teeth, bronze);
      if (models.gear) mesh.scale.setScalar(r);
      mesh.position.set(gx, gy, -1.62);
      this.group.add(mesh);
      this.gears.push({ mesh, speed });
    }
    if (models.pipes) {
      const spots: [number, number, number, boolean][] = [
        [-6.6, 0.3, 1.15, false],
        [6.4, 0.2, 1.3, true],
        [-1.8, 0.5, 0.85, true],
        [2.6, 3.4, 0.8, false],
      ];
      for (const [x, y, s, flip] of spots) {
        const p = models.pipes.clone(true);
        p.position.set(x, y, -1.55);
        p.scale.set(flip ? -s : s, s, s);
        this.group.add(p);
      }
    }
    const lampMat = new THREE.MeshStandardMaterial({
      color: LAMP_COLOR,
      emissive: LAMP_COLOR,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lampMat);
      lamp.position.set(side * (ROOM_HALF_WIDTH - 0.6), CEILING_Y - 1.4, 0.4);
      this.group.add(lamp);
    }
  }

  private buildRivets(mat: THREE.Material): void {
    const cols = 14;
    const rows = 7;
    const rivetGeo = new THREE.SphereGeometry(0.09, 8, 6);
    const rivets = new THREE.InstancedMesh(rivetGeo, mat, cols * rows);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -ROOM_HALF_WIDTH + 0.6 + (c / (cols - 1)) * (WIDTH - 1.2);
        const y = 0.5 + (r / (rows - 1)) * (CEILING_Y - 1);
        m.setPosition(x, y, -1.78);
        rivets.setMatrixAt(n++, m);
      }
    }
    rivets.instanceMatrix.needsUpdate = true;
    this.group.add(rivets);
  }

  update(dt: number): void {
    for (const g of this.gears) g.mesh.rotation.z += g.speed * dt;
  }
}
