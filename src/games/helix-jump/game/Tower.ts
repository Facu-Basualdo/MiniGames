import * as THREE from "three";
import {
  PLATFORM_INNER_RADIUS,
  PLATFORM_OUTER_RADIUS,
  PLATFORM_THICKNESS,
  LEVEL_SPACING,
  SEGMENTS_PER_LEVEL,
  GAP_SIZE_SEGMENTS,
  TOWER_RADIUS,
  TOWER_COLOR,
  PLATFORM_COLORS,
  OBSTACLE_COLOR,
  VISIBLE_LEVELS_AHEAD,
  VISIBLE_LEVELS_BEHIND,
} from "./constants";

interface SegmentPhysics {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
}

interface Level {
  index: number;
  y: number;
  group: THREE.Group;
  segments: Array<"empty" | "normal" | "obstacle">;
  isBroken: boolean;
  breakTimer: number;
  segmentPhysics?: SegmentPhysics[];
}

export class Tower {
  readonly object = new THREE.Group();
  private readonly pillar: THREE.Mesh;
  private readonly segmentGeometry: THREE.ExtrudeGeometry;
  
  // Materials
  private readonly normalMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly obstacleMaterial: THREE.MeshStandardMaterial;

  // Active levels in the scene
  private activeLevels = new Map<number, Level>();
  
  // Rotation
  rotationY = 0;

  constructor() {
    // 1. Central Pillar (Cylinder)
    const pillarHeight = 300;
    const pillarGeom = new THREE.CylinderGeometry(
      TOWER_RADIUS,
      TOWER_RADIUS,
      pillarHeight,
      32,
      1,
      false
    );
    // Align top of pillar near start
    pillarGeom.translate(0, -pillarHeight / 2 + 10, 0); 
    
    const pillarMat = new THREE.MeshStandardMaterial({
      color: TOWER_COLOR,
      roughness: 0.6,
      metalness: 0.8,
    });
    this.pillar = new THREE.Mesh(pillarGeom, pillarMat);
    this.pillar.receiveShadow = true;
    this.object.add(this.pillar);

    // 2. Shareable Platform Segment Geometry
    const shape = new THREE.Shape();
    const startAngle = 0;
    const endAngle = (Math.PI * 2) / SEGMENTS_PER_LEVEL;

    shape.moveTo(PLATFORM_INNER_RADIUS, 0);
    shape.lineTo(PLATFORM_OUTER_RADIUS, 0);
    shape.absarc(0, 0, PLATFORM_OUTER_RADIUS, startAngle, endAngle, false);
    shape.lineTo(
      PLATFORM_INNER_RADIUS * Math.cos(endAngle),
      PLATFORM_INNER_RADIUS * Math.sin(endAngle)
    );
    shape.absarc(0, 0, PLATFORM_INNER_RADIUS, endAngle, startAngle, true);

    this.segmentGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: PLATFORM_THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    // Rotate to lie flat on XZ plane
    this.segmentGeometry.rotateX(-Math.PI / 2);

    // 3. Setup Materials
    for (const color of PLATFORM_COLORS) {
      this.normalMaterials.push(
        new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.2,
          metalness: 0.1,
        })
      );
    }

    this.obstacleMaterial = new THREE.MeshStandardMaterial({
      color: OBSTACLE_COLOR,
      roughness: 0.4,
      metalness: 0.1,
      emissive: OBSTACLE_COLOR,
      emissiveIntensity: 0.4,
    });
  }

  reset(): void {
    // Clear all active levels from scene
    for (const level of this.activeLevels.values()) {
      this.object.remove(level.group);
    }
    this.activeLevels.clear();

    this.rotationY = 0;
    this.object.rotation.y = 0;

    // Generate initial set of levels
    this.updateLevels(0);
  }

  rotate(delta: number): void {
    this.rotationY += delta;
    this.object.rotation.y = this.rotationY;
  }

  getSegmentType(levelIndex: number, localAngle: number): "empty" | "normal" | "obstacle" {
    const level = this.activeLevels.get(levelIndex);
    if (!level || level.isBroken) return "empty";

    // Convert local angle (0 to 2PI) to segment index
    const segmentAngle = (Math.PI * 2) / SEGMENTS_PER_LEVEL;
    let normalizedAngle = localAngle % (Math.PI * 2);
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

    const segmentIndex = Math.floor(normalizedAngle / segmentAngle) % SEGMENTS_PER_LEVEL;
    return level.segments[segmentIndex];
  }

  breakLevel(levelIndex: number): void {
    const level = this.activeLevels.get(levelIndex);
    if (!level || level.isBroken) return;

    level.isBroken = true;
    level.breakTimer = 0;
    level.segmentPhysics = [];

    // Detach segments from level group and put them in the physics simulation
    const children = [...level.group.children];
    for (const child of children) {
      if (child instanceof THREE.Mesh && child !== level.group.children[0] /* skip any debug objects if any */) {
        // Calculate radial direction based on the segment's rotation
        const angle = child.rotation.y + (Math.PI * 2) / SEGMENTS_PER_LEVEL / 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)).normalize();

        // Assign initial velocities
        const speed = 4.0 + Math.random() * 3.0;
        const vel = dir.clone().multiplyScalar(speed);
        vel.y = 3.0 + Math.random() * 4.0; // Fly upwards slightly

        const angVel = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        );

        level.segmentPhysics.push({
          mesh: child,
          vel,
          angVel,
        });
      }
    }
  }

  update(dt: number, currentLevelIndex: number): void {
    // 1. Maintain visible levels window (procedural generation & cleanup)
    this.updateLevels(currentLevelIndex);

    // 2. Animate crumbling (broken) levels
    for (const [index, level] of this.activeLevels.entries()) {
      if (level.isBroken && level.segmentPhysics) {
        level.breakTimer += dt;
        
        if (level.breakTimer > 1.2) {
          // Finished animation, remove from scene
          this.object.remove(level.group);
          this.activeLevels.delete(index);
        } else {
          // Update physics of segments
          for (const phys of level.segmentPhysics) {
            // Apply gravity
            phys.vel.y += -15.0 * dt;
            
            // Move segment
            phys.mesh.position.addScaledVector(phys.vel, dt);
            
            // Rotate segment
            phys.mesh.rotation.x += phys.angVel.x * dt;
            phys.mesh.rotation.y += phys.angVel.y * dt;
            phys.mesh.rotation.z += phys.angVel.z * dt;
            
            // Fade out
            if (phys.mesh.material instanceof THREE.Material) {
              phys.mesh.material.transparent = true;
              phys.mesh.material.opacity = Math.max(0, 1 - level.breakTimer / 1.2);
            }
          }
        }
      }
    }
  }

  private updateLevels(currentIndex: number): void {
    const startIdx = Math.max(0, currentIndex - VISIBLE_LEVELS_BEHIND);
    const endIdx = currentIndex + VISIBLE_LEVELS_AHEAD;

    // Generate new levels
    for (let i = startIdx; i <= endIdx; i++) {
      if (!this.activeLevels.has(i)) {
        this.generateLevel(i);
      }
    }

    // Clean up levels too far behind
    for (const index of this.activeLevels.keys()) {
      if (index < startIdx) {
        const level = this.activeLevels.get(index)!;
        this.object.remove(level.group);
        this.activeLevels.delete(index);
      }
    }
  }

  private generateLevel(index: number): void {
    const levelY = -index * LEVEL_SPACING;
    const levelGroup = new THREE.Group();
    levelGroup.position.y = levelY;
    this.object.add(levelGroup);

    const segments: Array<"empty" | "normal" | "obstacle"> = [];

    if (index === 0) {
      // Level 0: starting zone. Safe, only 1 gap opposite to starting position
      // Starting ball is at angle 270 (towards camera), index 9
      for (let s = 0; s < SEGMENTS_PER_LEVEL; s++) {
        // Gap at index 3 (opposite side)
        if (s === 3 || s === 4) {
          segments.push("empty");
        } else {
          segments.push("normal");
        }
      }
    } else {
      // Level 1+: procedurally generated
      // 1. Determine gap starting index
      const gapStart = Math.floor(Math.random() * SEGMENTS_PER_LEVEL);
      
      // Initialize all as normal
      for (let s = 0; s < SEGMENTS_PER_LEVEL; s++) {
        segments.push("normal");
      }

      // 2. Set gaps
      for (let g = 0; g < GAP_SIZE_SEGMENTS; g++) {
        const idx = (gapStart + g) % SEGMENTS_PER_LEVEL;
        segments.push(); // dummy write
        segments[idx] = "empty";
      }

      // 3. Set obstacles (depends on level index, gets harder)
      // Level 1: 1 obstacle segment. Level 10+: up to 3 obstacles.
      const numObstacles = Math.min(1 + Math.floor(index / 8), 3);
      let placedObstacles = 0;
      
      // Try to place obstacles, making sure they aren't on top of the gaps
      let attempts = 0;
      while (placedObstacles < numObstacles && attempts < 20) {
        attempts++;
        const obsIdx = Math.floor(Math.random() * SEGMENTS_PER_LEVEL);
        
        // Don't overlap with gap, and don't place on all segments
        if (segments[obsIdx] === "normal") {
          // Check: don't place obstacle right adjacent to gap if we can avoid it, to keep it fair
          const nextIdx = (obsIdx + 1) % SEGMENTS_PER_LEVEL;
          const prevIdx = (obsIdx - 1 + SEGMENTS_PER_LEVEL) % SEGMENTS_PER_LEVEL;
          
          if (segments[nextIdx] !== "empty" && segments[prevIdx] !== "empty") {
            segments[obsIdx] = "obstacle";
            placedObstacles++;
          }
        }
      }
    }

    // Determine normal platform material color for this level
    const matIndex = index % this.normalMaterials.length;
    const normalMaterial = this.normalMaterials[matIndex];

    // Build meshes for this level
    for (let s = 0; s < SEGMENTS_PER_LEVEL; s++) {
      if (segments[s] === "empty") continue;

      const isObstacle = segments[s] === "obstacle";
      
      // Clone materials to allow independent opacity fading during shatter
      const material = isObstacle
        ? this.obstacleMaterial.clone()
        : normalMaterial.clone();

      const segmentMesh = new THREE.Mesh(this.segmentGeometry, material);
      
      // Rotate segment to its proper place around the Y axis
      // Note: segmentGeometry covers [0, SEGMENT_ANGLE]
      segmentMesh.rotation.y = s * ((Math.PI * 2) / SEGMENTS_PER_LEVEL);
      
      segmentMesh.castShadow = true;
      segmentMesh.receiveShadow = true;
      levelGroup.add(segmentMesh);
    }

    this.activeLevels.set(index, {
      index,
      y: levelY,
      group: levelGroup,
      segments,
      isBroken: false,
      breakTimer: 0,
    });
  }
}
