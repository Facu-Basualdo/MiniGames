import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** The Blender-authored GLB props, once loaded. Any field is undefined if its
 *  asset failed to load — callers fall back to primitives so gameplay is never
 *  blocked (same graceful-degradation contract as the leaderboard). */
export interface ModelSet {
  gear?: THREE.Group;
  diver?: THREE.Group;
  pipes?: THREE.Group;
  vent?: THREE.Group;
  /** The rendered deep-cavern background image (mapped onto a back plane). */
  backdrop?: THREE.Texture;
}

const BASE = "/models/boilerbound/";

function load(loader: GLTFLoader, file: string): Promise<THREE.Group | undefined> {
  return new Promise((resolve) => {
    loader.load(
      BASE + file,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => {
        console.warn(`[boilerbound] no se pudo cargar ${file}, se usa la geometría de respaldo`, err);
        resolve(undefined);
      },
    );
  });
}

function loadTexture(file: string): Promise<THREE.Texture | undefined> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      BASE + file,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      () => resolve(undefined),
    );
  });
}

/** Preloads every asset in parallel; never rejects (missing assets → undefined). */
export async function loadModels(): Promise<ModelSet> {
  const loader = new GLTFLoader();
  const [gear, diver, pipes, vent, backdrop] = await Promise.all([
    load(loader, "gear.glb"),
    load(loader, "diver.glb"),
    load(loader, "pipes.glb"),
    load(loader, "vent.glb"),
    loadTexture("backdrop.jpg"),
  ]);
  return { gear, diver, pipes, vent, backdrop };
}
