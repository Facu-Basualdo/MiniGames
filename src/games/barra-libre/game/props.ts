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

/** A glass mug with a handle. `setMugFill` drives the liquid level. */
export function makeMug(): MugMesh {
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

  const mug: MugMesh = { group, liquid, foam };
  setMugFill(mug, 0);
  return mug;
}

/** Fill level 0..1: the liquid column rises, foam appears when full. */
export function setMugFill(mug: MugMesh, level: number): void {
  const h = MUG_HEIGHT * 0.82;
  const l = Math.max(0.001, level);
  mug.liquid.scale.y = l;
  mug.liquid.position.y = 0.03 + (h * l) / 2;
  mug.liquid.visible = level > 0.02;
  mug.foam.visible = level >= 0.98;
  mug.foam.position.y = 0.03 + h + 0.02;
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
