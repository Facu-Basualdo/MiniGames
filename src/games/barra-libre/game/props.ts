import * as THREE from "three";

/** Small 3D props that slide along the counters: beer mugs and tip coins.
 *  Real meshes (not sprites) so the lamps glint on them; the beer and the
 *  coin are slightly emissive so they pop against the dark wood and catch
 *  the bloom. */

export const MUG_HEIGHT = 0.24;
export const MUG_RADIUS = 0.09;

export interface MugMesh {
  group: THREE.Group;
  /** Inner liquid cylinder, scaled by the fill level. */
  liquid: THREE.Mesh;
  foam: THREE.Mesh;
}

/** A glass mug with a handle. `setMugFill` drives the liquid level.
 *  `emptyRim` traces the glass in a thin, faint red glow so the empties
 *  sliding back read apart from the amber full beers. */
export function makeMug(emptyRim = false): MugMesh {
  const group = new THREE.Group();

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xcfd8e0,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
    metalness: 0.05,
  });
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(MUG_RADIUS, MUG_RADIUS * 0.92, MUG_HEIGHT, 10, 1, true),
    glassMat,
  );
  glass.position.y = MUG_HEIGHT / 2;
  group.add(glass);

  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(MUG_RADIUS * 0.92, MUG_RADIUS * 0.92, 0.02, 10),
    glassMat,
  );
  bottom.position.y = 0.01;
  group.add(bottom);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(MUG_RADIUS * 0.8, MUG_RADIUS * 0.76, MUG_HEIGHT * 0.82, 10),
    new THREE.MeshStandardMaterial({
      color: 0xf2a52e,
      emissive: 0xd98a1e,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    }),
  );
  group.add(liquid);

  const foam = new THREE.Mesh(
    new THREE.CylinderGeometry(MUG_RADIUS * 0.86, MUG_RADIUS * 0.8, 0.05, 10),
    new THREE.MeshStandardMaterial({
      color: 0xf4efe2,
      emissive: 0xf4efe2,
      emissiveIntensity: 0.3,
      roughness: 0.7,
    }),
  );
  group.add(foam);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(MUG_HEIGHT * 0.3, 0.018, 6, 10, Math.PI),
    glassMat,
  );
  handle.position.set(0, MUG_HEIGHT / 2, MUG_RADIUS + 0.01);
  handle.rotation.set(0, Math.PI / 2, Math.PI / 2);
  group.add(handle);

  if (emptyRim) {
    // Two hairline rings (top + base) outline the glass in soft red.
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x330a0c,
      emissive: 0xff2a3a,
      emissiveIntensity: 1.4,
      roughness: 0.5,
    });
    for (const y of [0.025, MUG_HEIGHT - 0.015]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(MUG_RADIUS * 1.03, 0.006, 5, 18),
        rimMat,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    }
  }

  const mug: MugMesh = { group, liquid, foam };
  setMugFill(mug, 0);
  return mug;
}

export function setMugFill(mug: MugMesh, level: number, isSliding: boolean = false): void {
  const h = MUG_HEIGHT * 0.82;
  const l = Math.max(0.001, level);
  mug.liquid.scale.y = l;
  mug.liquid.position.y = 0.03 + (h * l) / 2;
  mug.liquid.visible = level > 0.02;
  mug.foam.visible = level >= 0.98;
  mug.foam.position.y = 0.03 + h + 0.02;

  // Make it glow brightly only when full (destello) and not sliding
  const isFull = level >= 0.98 && !isSliding;
  const intensity = isFull ? 1.5 : 0.1;
  (mug.liquid.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
  (mug.foam.material as THREE.MeshStandardMaterial).emissiveIntensity = isFull ? 0.8 : 0.1;
}

export function disposeMug(mug: MugMesh): void {
  mug.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}

/** A fat gold coin standing on its edge so it rolls down the bar. Bright
 *  emissive: the tip is the one prop that must scream "grab me". */
export function makeTipCoin(): THREE.Mesh {
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.035, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffd94a,
      emissive: 0xffc42e,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.6,
    }),
  );
  // Standing on the edge, flat faces looking down the bar (Z).
  coin.rotation.x = Math.PI / 2;
  return coin;
}

export function disposeTipCoin(coin: THREE.Mesh): void {
  coin.geometry.dispose();
  (coin.material as THREE.Material).dispose();
}
