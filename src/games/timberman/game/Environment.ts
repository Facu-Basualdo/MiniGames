import * as THREE from "three";
import { toon, outlined, flatGeo } from "./materials";
import { LEAF_COLORS } from "./constants";

const leafGeo = flatGeo(new THREE.IcosahedronGeometry(1, 0));
const rockGeo = flatGeo(new THREE.IcosahedronGeometry(0.4, 0));
const cloudGeo = flatGeo(new THREE.IcosahedronGeometry(1, 1));

/** Decorative backdrop: rolling hills, drifting clouds, bushes and stray rocks. */
export class Environment {
  readonly group = new THREE.Group();
  private readonly clouds: { mesh: THREE.Object3D; speed: number }[] = [];
  private readonly fireflies: THREE.Mesh[] = [];
  private readonly bgTrees: { group: THREE.Group; baseY: number; phase: number; speed: number }[] = [];

  constructor() {
    this.buildHills();
    this.buildClouds();
    this.buildBushes();
    this.buildRocks();
    this.buildBackgroundTrees();
    this.buildFireflies();
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 22) c.mesh.position.x = -22;
    }

    const time = performance.now() * 0.001;
    this.fireflies.forEach((f, idx) => {
      f.position.y += (0.15 + (idx % 5) * 0.05) * dt;
      if (f.position.y > 8.0) {
        f.position.y = 0;
      }
      f.position.x += Math.sin(time + idx) * 0.25 * dt;
      f.position.z += Math.cos(time + idx * 1.5) * 0.25 * dt;
    });

    this.bgTrees.forEach((t) => {
      t.group.position.y = t.baseY + Math.sin(time * t.speed + t.phase) * 0.25;
      t.group.rotation.z = Math.sin(time * t.speed * 0.5 + t.phase) * 0.04;
      t.group.rotation.x = Math.cos(time * t.speed * 0.5 + t.phase) * 0.02;
    });
  }

  private buildHills(): void {
    const tones = ["#2b1029", "#3c163b", "#4e1b4d"];
    const specs = [
      { x: -10, z: -16, s: 11, t: 0 },
      { x: 12, z: -18, s: 13, t: 0 },
      { x: 2, z: -22, s: 16, t: 1 },
      { x: -16, z: -13, s: 8, t: 2 },
    ];
    for (const h of specs) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(h.s, 24, 16),
        toon(tones[h.t]),
      );
      hill.position.set(h.x, -h.s + 1.2, h.z);
      hill.scale.y = 0.55;
      hill.receiveShadow = true;
      this.group.add(hill);
    }
  }

  private buildClouds(): void {
    const white = toon("#f3caef");
    const specs = [
      { x: -8, y: 9, z: -12, s: 1.5 },
      { x: 6, y: 11, z: -14, s: 1.9 },
      { x: 14, y: 8, z: -10, s: 1.3 },
      { x: -15, y: 12, z: -16, s: 1.7 },
    ];
    for (const c of specs) {
      const cloud = new THREE.Group();
      const offs = [
        [0, 0, 0, 1],
        [-1.1, -0.2, 0.2, 0.75],
        [1.1, -0.1, -0.2, 0.8],
        [0.3, 0.5, 0.1, 0.65],
      ];
      for (const o of offs) {
        const puff = new THREE.Mesh(cloudGeo, white);
        puff.position.set(o[0] * c.s, o[1] * c.s, o[2] * c.s);
        puff.scale.setScalar(o[3] * c.s);
        cloud.add(puff);
      }
      cloud.position.set(c.x, c.y, c.z);
      this.group.add(cloud);
      this.clouds.push({ mesh: cloud, speed: 0.25 + Math.random() * 0.3 });
    }
  }

  private buildBushes(): void {
    const specs = [
      { x: -3.6, z: 1.8, s: 0.9 },
      { x: 3.9, z: 1.2, s: 1.1 },
      { x: -2.4, z: -2.6, s: 0.8 },
      { x: 3.2, z: -2.4, s: 0.75 },
    ];
    for (const b of specs) {
      const bush = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blob = outlined(leafGeo, toon(LEAF_COLORS[i % LEAF_COLORS.length]), 1.06);
        blob.scale.setScalar((0.5 + Math.random() * 0.2) * b.s);
        blob.position.set((Math.random() - 0.5) * b.s, 0.1 * b.s, (Math.random() - 0.5) * b.s);
        bush.add(blob);
      }
      bush.position.set(b.x, 0.1, b.z);
      this.group.add(bush);
    }
  }

  private buildRocks(): void {
    const rock = toon("#382b3d");
    const specs = [
      { x: -4.5, z: 0.2, s: 0.7 },
      { x: 4.4, z: -0.6, s: 0.55 },
      { x: 2.6, z: 2.8, s: 0.5 },
      { x: -3.1, z: 3.0, s: 0.6 },
    ];
    for (const r of specs) {
      const mesh = outlined(rockGeo, rock, 1.08);
      mesh.scale.setScalar(r.s);
      mesh.position.set(r.x, r.s * 0.25, r.z);
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      this.group.add(mesh);
    }
  }

  private buildBackgroundTrees(): void {
    const trunkMat = toon("#331e17");
    const rockMat = toon("#382b3d");
    const specs = [
      { x: -8, z: -6, s: 1.2 },
      { x: 8.5, z: -7, s: 1.4 },
      { x: -12, z: -9, s: 1.0 },
    ];
    for (const t of specs) {
      const tree = new THREE.Group();
      const trunk = outlined(new THREE.CylinderGeometry(0.4, 0.5, 3, 10), trunkMat);
      trunk.position.y = 1.5;

      const crown = outlined(leafGeo, toon(LEAF_COLORS[1]), 1.05);
      crown.scale.setScalar(1.8);
      crown.position.y = 3.8;

      // Floating island rock base
      const islandBase = outlined(new THREE.ConeGeometry(0.9, 1.2, 5), rockMat);
      islandBase.rotation.x = Math.PI; // point down
      islandBase.position.y = -0.6;

      tree.add(trunk, crown, islandBase);

      const baseY = 1.2 + Math.random() * 0.8;
      tree.position.set(t.x, baseY, t.z);
      tree.scale.setScalar(t.s);

      this.group.add(tree);
      this.bgTrees.push({
        group: tree,
        baseY,
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.5
      });
    }
  }

  private buildFireflies(): void {
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff68f });
    for (let i = 0; i < 35; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 5.0;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.random() * 8.0,
        Math.sin(angle) * radius
      );
      this.group.add(mesh);
      this.fireflies.push(mesh);
    }
  }
}
