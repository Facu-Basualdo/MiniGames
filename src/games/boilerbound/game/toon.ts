import * as THREE from "three";

/** A material that carries emissive controls (pulsed by the game). */
export type EmissiveMaterial = THREE.MeshStandardMaterial | THREE.MeshToonMaterial;

/**
 * Cel-shading toolkit. The cartoon look is a *shading* technique, not a
 * modelling one: we keep the Blender geometry and swap its PBR materials for
 * `MeshToonMaterial` (flat banded light/shadow via a stepped gradient map). Ink
 * outlines are added separately by `OutlineEffect` in Game. This is what turns
 * the props into the hand-painted style of the Krea background.
 */

/** A hard N-step ramp texture that gives toon shading its flat bands. */
export function makeToonGradient(steps = 4): THREE.DataTexture {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    // Bias the ramp brighter so mid-tones read as lit (fewer muddy shadows).
    const t = i / (steps - 1);
    data[i] = Math.round(Math.pow(t, 0.7) * 255);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function toToon(src: THREE.MeshStandardMaterial, grad: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: src.color.clone(),
    map: src.map ?? null,
    gradientMap: grad,
    emissive: src.emissive.clone(),
    emissiveIntensity: src.emissiveIntensity,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
  });
}

/**
 * Replaces every `MeshStandardMaterial` under `root` with an equivalent toon
 * material (leaving `MeshBasicMaterial`/points alone — backdrop, steam, sparks).
 * Because it builds fresh materials it also de-dupes shared GLB materials, so
 * per-instance emissive tinting is safe afterwards. Pass `collect` to grab the
 * emissive ones for runtime pulsing.
 */
export function toonify(
  root: THREE.Object3D,
  grad: THREE.Texture,
  collect?: (mat: THREE.MeshToonMaterial) => void,
): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material;
    if (Array.isArray(src) || !(src as THREE.Material).type.startsWith("MeshStandard")) return;
    const toon = toToon(src as THREE.MeshStandardMaterial, grad);
    mesh.material = toon;
    if (collect && toon.emissiveIntensity > 0.01) collect(toon);
  });
}
