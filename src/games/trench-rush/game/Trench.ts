import * as THREE from "three";
import { getDotTexture } from "./dotTexture";
import {
  CAMERA_Z,
  FIELD_HALF_HEIGHT,
  FIELD_HALF_WIDTH,
  FOG_FAR,
  STAR_COUNT,
  TRENCH_SEGMENT_COUNT,
  TRENCH_SEGMENT_LENGTH,
  TRENCH_WALL_HEIGHT,
  TRENCH_WIDTH,
} from "./constants";

const STAR_DEPTH = FOG_FAR * 0.95;
const STAR_WRAP = STAR_DEPTH + CAMERA_Z + 10;
const TRENCH_SPAN = TRENCH_SEGMENT_COUNT * TRENCH_SEGMENT_LENGTH;

// Shared panel materials
const WALL_COLOR = 0xe0e3eb; // techy matte white/light grey
const FLOOR_COLOR = 0x6e7380; // dark panel grey
const GREEBLE_COLOR = 0xbdc2d1; // mid grey
const PIPE_COLOR = 0x4a4d56; // steel pipe dark grey

function makeTrenchMaterial(color: number, rough = 0.6, metal = 0.25): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: rough,
    metalness: metal,
    flatShading: true,
  });
}

/**
 * A single modular chunk of the trench.
 * Contains floor, left and right walls, plus randomly generated 3D panel details (greebles),
 * pipes, and glowing indicators to give a premium Death Star tech aesthetic.
 */
class TrenchSegment {
  readonly group: THREE.Group;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(z: number, segmentIndex: number) {
    this.group = new THREE.Group();
    this.group.position.z = z;

    this.build(segmentIndex);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private build(segmentIndex: number): void {
    const wallMat = makeTrenchMaterial(WALL_COLOR, 0.75, 0.15);
    const floorMat = makeTrenchMaterial(FLOOR_COLOR, 0.8, 0.2);
    const greebleMat = makeTrenchMaterial(GREEBLE_COLOR, 0.75, 0.15);
    const pipeMat = makeTrenchMaterial(PIPE_COLOR, 0.5, 0.7);
    const redMat = makeTrenchMaterial(0xb81d24, 0.65, 0.25); // warning red arch
    this.disposables.push(wallMat, floorMat, greebleMat, pipeMat, redMat);

    const len = TRENCH_SEGMENT_LENGTH;
    const w = TRENCH_WIDTH;
    const h = TRENCH_WALL_HEIGHT;

    // --- Main Floor Base (Z covers -20 to 20) ---
    const floorGeom = new THREE.BoxGeometry(w, 0.8, len);
    this.disposables.push(floorGeom);
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(0, -6.4, 0); // top surface is at y = -6.0
    this.group.add(floor);

    // --- Main Ceiling Base ---
    const ceilingGeom = new THREE.BoxGeometry(w, 0.8, len);
    this.disposables.push(ceilingGeom);
    const ceiling = new THREE.Mesh(ceilingGeom, floorMat);
    ceiling.position.set(0, 12.4, 0); // bottom surface is at y = 12.0
    this.group.add(ceiling);

    // --- Wall Bases (Left and Right) ---
    const wallLGeom = new THREE.BoxGeometry(0.8, h, len);
    const wallRGeom = new THREE.BoxGeometry(0.8, h, len);
    this.disposables.push(wallLGeom, wallRGeom);
    
    const wallL = new THREE.Mesh(wallLGeom, wallMat);
    wallL.position.set(-w / 2 - 0.4, -6.0 + h / 2, 0); // inner surface is at x = -9.0
    this.group.add(wallL);

    const wallR = new THREE.Mesh(wallRGeom, wallMat);
    wallR.position.set(w / 2 + 0.4, -6.0 + h / 2, 0); // inner surface is at x = 9.0
    this.group.add(wallR);

    // --- Structural Seams & Joists ---
    // 1. Vertical columns at junctions (z = -20, -10, 0, 10, 20)
    for (const jz of [-20, -10, 0, 10, 20]) {
      for (const side of [-1, 1]) {
        const pillarGeom = new THREE.BoxGeometry(0.2, h, 0.4);
        this.disposables.push(pillarGeom);
        const pillar = new THREE.Mesh(pillarGeom, greebleMat);
        pillar.position.set(side * (w / 2 - 0.08), -6.0 + h / 2, jz);
        this.group.add(pillar);
      }
    }

    // 2. Horizontal split beams at y = 3 (separates bottom panels from top panels)
    for (const side of [-1, 1]) {
      const splitGeom = new THREE.BoxGeometry(0.18, 0.35, len);
      this.disposables.push(splitGeom);
      const splitBeam = new THREE.Mesh(splitGeom, greebleMat);
      splitBeam.position.set(side * (w / 2 - 0.08), 3.0, 0);
      this.group.add(splitBeam);
    }

    // --- Modular Structured Greebles for Left and Right Walls ---
    // We split each wall into 4 horizontal sections along Z (each 10 units)
    // and 2 vertical sections along Y (bottom half: -6 to 3, top half: 3 to 12)
    for (const side of [-1, 1]) {
      for (let col = 0; col < 4; col++) {
        const pz = -15 + col * 10; // centers: -15, -5, 5, 15

        for (let row = 0; row < 2; row++) {
          const py = row === 0 ? -1.5 : 7.5; // centers of bottom/top panels
          const panelH = 8.4;
          const panelW = 0.12;
          const panelD = 9.4;

          // Base panel backing box
          const panelGeom = new THREE.BoxGeometry(panelW, panelH, panelD);
          this.disposables.push(panelGeom);
          const panelMesh = new THREE.Mesh(panelGeom, greebleMat);
          panelMesh.position.set(side * (w / 2 - panelW / 2), py, pz);
          this.group.add(panelMesh);

          // Choose a highly structured panel type based on Z (col) and Y (row) index
          const typeIndex = (col + row * 3) % 6;

          switch (typeIndex) {
            case 0: { // Panel Type A: Horizontal Conduits (Pipes)
              const numPipes = 3;
              const pipeLength = 9.4;
              for (let p = 0; p < numPipes; p++) {
                const pipeR = 0.08 + (p % 2) * 0.02;
                const pipeGeom = new THREE.CylinderGeometry(pipeR, pipeR, pipeLength, 8);
                pipeGeom.rotateX(Math.PI / 2);
                this.disposables.push(pipeGeom);

                const pipe = new THREE.Mesh(pipeGeom, pipeMat);
                // Align pipes horizontally
                const dy = -2.2 + p * 2.2;
                pipe.position.set(side * (w / 2 - panelW - pipeR), py + dy, pz);
                this.group.add(pipe);
              }
              break;
            }

            case 1: { // Panel Type B: Circular Stud Grid (replicates details on the right wall)
              const studRadius = 0.18;
              const studLength = 0.15;
              const studGeom = new THREE.CylinderGeometry(studRadius, studRadius, studLength, 8);
              studGeom.rotateZ(Math.PI / 2); // sticks out horizontally
              this.disposables.push(studGeom);

              // 2x2 grid of circular studs
              for (const dy of [-1.8, 1.8]) {
                for (const dz of [-2.0, 2.0]) {
                  const stud = new THREE.Mesh(studGeom, greebleMat);
                  stud.position.set(side * (w / 2 - panelW - studLength / 2), py + dy, pz + dz);
                  this.group.add(stud);
                }
              }
              break;
            }

            case 2: { // Panel Type C: Vent Grate (horizontal slats)
              // Dark background recess
              const recessGeom = new THREE.BoxGeometry(0.06, panelH - 1.6, panelD - 2.0);
              const darkMat = makeTrenchMaterial(0x3a3c42, 0.9, 0.1);
              this.disposables.push(recessGeom, darkMat);
              
              const recess = new THREE.Mesh(recessGeom, darkMat);
              recess.position.set(side * (w / 2 - panelW + 0.04), py, pz);
              this.group.add(recess);

              // Horizontal grill slats on top
              const numSlats = 6;
              const slatH = 0.12;
              const slatD = panelD - 2.4;
              const slatGeom = new THREE.BoxGeometry(0.12, slatH, slatD);
              this.disposables.push(slatGeom);

              for (let s = 0; s < numSlats; s++) {
                const slat = new THREE.Mesh(slatGeom, pipeMat);
                const sy = py - 2.2 + s * 0.88;
                slat.position.set(side * (w / 2 - panelW - 0.02), sy, pz);
                this.group.add(slat);
              }
              break;
            }

            case 3: { // Panel Type D: Layered Slabs
              // Large raised rectangular block
              const slab1Geom = new THREE.BoxGeometry(0.08, panelH * 0.75, panelD * 0.65);
              this.disposables.push(slab1Geom);
              const slab1 = new THREE.Mesh(slab1Geom, greebleMat);
              slab1.position.set(side * (w / 2 - panelW - 0.04), py, pz);
              this.group.add(slab1);

              // Smaller raised block on top
              const slab2Geom = new THREE.BoxGeometry(0.06, panelH * 0.45, panelD * 0.4);
              this.disposables.push(slab2Geom);
              const slab2 = new THREE.Mesh(slab2Geom, greebleMat);
              slab2.position.set(side * (w / 2 - panelW - 0.07), py, pz);
              this.group.add(slab2);
              break;
            }

            case 4: { // Panel Type E: Recessed Inner Frame
              const borderW = 0.08;
              
              // Add raised border lines to simulate an inset frame panel
              // Top/Bottom frames
              const frameH = 0.8;
              const frameHorizGeom = new THREE.BoxGeometry(borderW, frameH, panelD);
              this.disposables.push(frameHorizGeom);
              
              for (const dy of [-py/2 - 2, py/2 + 2]) {
                const frame = new THREE.Mesh(frameHorizGeom, greebleMat);
                frame.position.set(side * (w / 2 - panelW - borderW / 2), py + dy * 0.5, pz);
                this.group.add(frame);
              }

              // Left/Right frames
              const frameVertGeom = new THREE.BoxGeometry(borderW, panelH - 1.6, 1.0);
              this.disposables.push(frameVertGeom);
              for (const dz of [-3.8, 3.8]) {
                const frame = new THREE.Mesh(frameVertGeom, greebleMat);
                frame.position.set(side * (w / 2 - panelW - borderW / 2), py, pz + dz);
                this.group.add(frame);
              }
              break;
            }

            case 5: { // Panel Type F: Vertical Cable Trunk / Detailing
              const trunkW = 0.1;
              const trunkH = panelH;
              const trunkD = 1.6;
              const trunkGeom = new THREE.BoxGeometry(trunkW, trunkH, trunkD);
              this.disposables.push(trunkGeom);

              const trunk = new THREE.Mesh(trunkGeom, greebleMat);
              trunk.position.set(side * (w / 2 - panelW - trunkW / 2), py, pz);
              this.group.add(trunk);

              // Vertical pipe running over it
              const verticalPipeGeom = new THREE.CylinderGeometry(0.06, 0.06, panelH, 6);
              this.disposables.push(verticalPipeGeom);
              const vPipe = new THREE.Mesh(verticalPipeGeom, pipeMat);
              vPipe.position.set(side * (w / 2 - panelW - trunkW - 0.03), py, pz);
              this.group.add(vPipe);
              break;
            }
          }
        }
      }
    }

    // --- Modular Structured Floor & Ceiling Paneling ---
    for (let col = 0; col < 4; col++) {
      const pz = -15 + col * 10;

      // 1. FLOOR PANELING
      // Base floor panel
      const floorPanelGeom = new THREE.BoxGeometry(w - 0.2, 0.15, 9.4);
      this.disposables.push(floorPanelGeom);
      const floorPanel = new THREE.Mesh(floorPanelGeom, floorMat);
      floorPanel.position.set(0, -5.95, pz);
      this.group.add(floorPanel);

      // Elevated side panels (creates the channel corridor boundary)
      const borderW = 2.0;
      const borderH = 0.35;
      const borderGeom = new THREE.BoxGeometry(borderW, borderH, 9.4);
      this.disposables.push(borderGeom);

      for (const side of [-1, 1]) {
        const border = new THREE.Mesh(borderGeom, floorMat);
        border.position.set(side * (w / 2 - borderW / 2 - 0.4), -6.0 + borderH / 2, pz);
        this.group.add(border);
      }

      // Procedural features in the center channel
      if (col === 0 || col === 2) {
        // Floor conduits (group of 3 horizontal pipes running along the center channel)
        const pipeR = 0.11;
        const pipeLen = 10.0;
        const floorPipeGeom = new THREE.CylinderGeometry(pipeR, pipeR, pipeLen, 8);
        floorPipeGeom.rotateX(Math.PI / 2);
        this.disposables.push(floorPipeGeom);

        for (const dx of [-0.65, 0, 0.65]) {
          const pipe = new THREE.Mesh(floorPipeGeom, pipeMat);
          pipe.position.set(dx, -5.95 + pipeR, pz);
          this.group.add(pipe);
        }
      } else if (col === 1) {
        // Raised center panel overlay
        const hatchGeom = new THREE.BoxGeometry(5.0, 0.12, 6.0);
        this.disposables.push(hatchGeom);
        const hatch = new THREE.Mesh(hatchGeom, greebleMat);
        hatch.position.set(0, -5.9, pz);
        this.group.add(hatch);
      }

      // 2. CEILING PANELING
      // Base ceiling panel
      const ceilPanelGeom = new THREE.BoxGeometry(w - 0.2, 0.15, 9.4);
      this.disposables.push(ceilPanelGeom);
      const ceilPanel = new THREE.Mesh(ceilPanelGeom, floorMat);
      ceilPanel.position.set(0, 11.95, pz); // bottom surface is at y = 12.0
      this.group.add(ceilPanel);

      // Elevated side panels for ceiling
      const ceilBorderGeom = new THREE.BoxGeometry(borderW, borderH, 9.4);
      this.disposables.push(ceilBorderGeom);

      for (const side of [-1, 1]) {
        const border = new THREE.Mesh(ceilBorderGeom, floorMat);
        border.position.set(side * (w / 2 - borderW / 2 - 0.4), 12.0 - borderH / 2, pz);
        this.group.add(border);
      }

      // Procedural features in the ceiling center channel
      if (col === 0 || col === 2) {
        // Ceiling conduits (2 horizontal pipes running along the center channel)
        const pipeR = 0.1;
        const pipeLen = 10.0;
        const ceilPipeGeom = new THREE.CylinderGeometry(pipeR, pipeR, pipeLen, 8);
        ceilPipeGeom.rotateX(Math.PI / 2);
        this.disposables.push(ceilPipeGeom);

        for (const dx of [-0.5, 0.5]) {
          const pipe = new THREE.Mesh(ceilPipeGeom, pipeMat);
          pipe.position.set(dx, 12.0 - pipeR, pz);
          this.group.add(pipe);
        }
      } else if (col === 1) {
        // Ceiling hatch overlay
        const hatchGeom = new THREE.BoxGeometry(4.0, 0.12, 5.0);
        this.disposables.push(hatchGeom);
        const hatch = new THREE.Mesh(hatchGeom, greebleMat);
        hatch.position.set(0, 11.9, pz);
        this.group.add(hatch);
      }
    }

    // --- Procedural Warning Gates/Arches (Red structures in the screenshot) ---
    // We spawn a heavy red arch every 3 segments to break monotony and add color depth
    if (segmentIndex % 3 === 0) {
      const archD = 2.2;
      const pillarW = 1.4;
      const beamH = 1.8;

      // Left Pillar
      const pillLGeom = new THREE.BoxGeometry(pillarW, h, archD);
      this.disposables.push(pillLGeom);
      const pillL = new THREE.Mesh(pillLGeom, redMat);
      pillL.position.set(-w / 2 + pillarW / 2 - 0.1, -6.0 + h / 2, 0);
      this.group.add(pillL);

      // Right Pillar
      const pillRGeom = new THREE.BoxGeometry(pillarW, h, archD);
      this.disposables.push(pillRGeom);
      const pillR = new THREE.Mesh(pillRGeom, redMat);
      pillR.position.set(w / 2 - pillarW / 2 + 0.1, -6.0 + h / 2, 0);
      this.group.add(pillR);

      // Top Crossbeam
      const beamGeom = new THREE.BoxGeometry(w - 0.2, beamH, archD);
      this.disposables.push(beamGeom);
      const beam = new THREE.Mesh(beamGeom, redMat);
      beam.position.set(0, 12.0 - beamH / 2, 0);
      this.group.add(beam);

      // White stripe inserts on the pillars (to match the screenshot detail)
      const stripeH = 3.0;
      const stripeGeom = new THREE.BoxGeometry(pillarW + 0.06, stripeH, archD + 0.08);
      this.disposables.push(stripeGeom);

      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(stripeGeom, wallMat);
        stripe.position.set(side * (w / 2 - pillarW / 2 - 0.1 * side), 2.2, 0);
        this.group.add(stripe);
      }
    }

    // --- Glowing lights/warning beacons (neon look) ---
    const numBeacons = 2;
    const beaconColors = [0xff2200, 0xffa200];
    for (let i = 0; i < numBeacons; i++) {
      const bColor = beaconColors[Math.floor(Math.random() * beaconColors.length)];
      const beaconMat = new THREE.MeshBasicMaterial({ color: bColor });
      const beaconGeom = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      this.disposables.push(beaconMat, beaconGeom);

      const beacon = new THREE.Mesh(beaconGeom, beaconMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      const py = -4.0 + Math.random() * (h - 2);
      const pz = -len / 2 + Math.random() * len;
      beacon.position.set(side * (w / 2 - 0.08), py, pz);
      this.group.add(beacon);
    }
  }
}

/**
 * The Trench system: manages scrolling segments, stars, and distant celestial background vista.
 */
export class Trench {
  readonly group: THREE.Group;
  private readonly segments: TrenchSegment[] = [];

  private readonly stars: THREE.Points;
  private readonly starPositions: Float32Array;

  constructor() {
    this.group = new THREE.Group();

    // --- Starfield ---
    this.starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starPositions[i * 3] = (Math.random() * 2 - 1) * FIELD_HALF_WIDTH * 5.0;
      // Stars stay high up in the sky, above the walls (y > 10)
      this.starPositions[i * 3 + 1] = 12 + Math.random() * FIELD_HALF_HEIGHT * 6.0;
      this.starPositions[i * 3 + 2] = CAMERA_Z - Math.random() * STAR_DEPTH;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute("position", new THREE.BufferAttribute(this.starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: getDotTexture(),
      size: 0.38,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      fog: true,
    });
    this.stars = new THREE.Points(starGeom, starMat);
    this.group.add(this.stars);

    // --- Spawn Trench Segments ---
    for (let i = 0; i < TRENCH_SEGMENT_COUNT; i++) {
      const z = CAMERA_Z + 10 - i * TRENCH_SEGMENT_LENGTH;
      const seg = new TrenchSegment(z, i);
      this.segments.push(seg);
      this.group.add(seg.group);
    }

    this.buildVista();
  }

  /** Distant Saturn partly visible in the sky above the walls. */
  private buildVista(): void {
    const saturn = new THREE.Group();
    // Position Saturn high up and to the right/back
    saturn.position.set(120, 90, -180);
    saturn.rotation.set(1.8, -0.2, 0);

    const R = 35;
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0xd2c29d,
      roughness: 0.9,
      metalness: 0.02,
      emissive: 0x050402,
      fog: false,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 32), globeMat);
    saturn.add(globe);

    // Rings
    const inner = R * 1.6;
    const outer = R * 2.8;
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa8997a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const ringGeom = new THREE.RingGeometry(inner, outer, 64);
    const ring = new THREE.Mesh(ringGeom, ringMat);
    saturn.add(ring);

    this.group.add(saturn);
  }

  scroll(distance: number): void {
    // Scroll Stars (Parallax scrolling: half speed)
    const starSpeed = distance * 0.5;
    for (let i = 0; i < STAR_COUNT; i++) {
      let z = this.starPositions[i * 3 + 2] + starSpeed;
      if (z > CAMERA_Z + 5) z -= STAR_WRAP;
      this.starPositions[i * 3 + 2] = z;
    }
    (this.stars.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Scroll Trench Segments
    for (const seg of this.segments) {
      seg.group.position.z += distance;
      
      // When segment gets past camera, wrap it to the far end
      if (seg.group.position.z > CAMERA_Z + TRENCH_SEGMENT_LENGTH) {
        seg.group.position.z -= TRENCH_SPAN;
      }
    }
  }

  reset(): void {
    for (let i = 0; i < this.segments.length; i++) {
      const z = CAMERA_Z + 10 - i * TRENCH_SEGMENT_LENGTH;
      this.segments[i].group.position.z = z;
    }
  }

  dispose(): void {
    for (const seg of this.segments) {
      seg.dispose();
    }
    this.segments.length = 0;
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
  }
}
