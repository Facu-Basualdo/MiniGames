import * as THREE from "three";
import {
  BALL_COLOR,
  BALL_FIRE_COLOR,
  BALL_RADIUS,
  GRAVITY,
  MAX_FALL_VELOCITY,
} from "./constants";

export class Ball {
  readonly object = new THREE.Group();
  private readonly sphere: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;

  // Position & Physics
  vy = 0;
  isFireball = false;
  
  // Visual animation state
  private squashTime = 0;
  private targetScale = new THREE.Vector3(1, 1, 1);
  private currentScale = new THREE.Vector3(1, 1, 1);

  // Trail effect (pool of small spheres in world space)
  private readonly trailGroup = new THREE.Group();
  private readonly trailMeshes: THREE.Mesh[] = [];
  private readonly trailHistory: THREE.Vector3[] = [];
  private readonly maxTrailLength = 12;
  private trailSpawnTimer = 0;

  constructor() {
    // Distance of the ball from the center of the tower
    const ballDistance = 1.45; 
    
    // Position ball in front of the tower
    this.object.position.set(0, 2.5, ballDistance);

    // Create main ball mesh
    this.material = new THREE.MeshStandardMaterial({
      color: BALL_COLOR,
      roughness: 0.1,
      metalness: 0.1,
      emissive: BALL_COLOR,
      emissiveIntensity: 0.25,
    });

    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 24, 24),
      this.material
    );
    this.sphere.castShadow = true;
    this.object.add(this.sphere);

    // Build trail pool
    const trailGeom = new THREE.SphereGeometry(BALL_RADIUS * 0.8, 12, 12);
    for (let i = 0; i < this.maxTrailLength; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: BALL_COLOR,
        transparent: true,
        opacity: 0,
      });
      const trailMesh = new THREE.Mesh(trailGeom, trailMat);
      trailMesh.visible = false;
      this.trailMeshes.push(trailMesh);
      this.trailGroup.add(trailMesh);
    }
  }

  getTrailGroup(): THREE.Group {
    return this.trailGroup;
  }

  reset(): void {
    const ballDistance = 1.45;
    this.object.position.set(0, 2.5, ballDistance);
    this.vy = 0;
    this.isFireball = false;
    this.squashTime = 0;
    this.currentScale.set(1, 1, 1);
    this.sphere.scale.copy(this.currentScale);
    
    // Reset trail
    this.trailHistory.length = 0;
    for (const mesh of this.trailMeshes) {
      mesh.visible = false;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    
    this.updateMaterial();
  }

  bounce(): void {
    // Trigger bounce squash
    this.squashTime = 0.15; // lasts 0.15 seconds
    this.targetScale.set(1.3, 0.6, 1.3); // squash vertically, stretch horizontally
  }

  setFireball(active: boolean): void {
    if (this.isFireball === active) return;
    this.isFireball = active;
    this.updateMaterial();
  }

  private updateMaterial(): void {
    const activeColor = this.isFireball ? BALL_FIRE_COLOR : BALL_COLOR;
    this.material.color.setHex(activeColor);
    this.material.emissive.setHex(activeColor);
    this.material.emissiveIntensity = this.isFireball ? 0.8 : 0.25;

    // Update trail materials
    for (const mesh of this.trailMeshes) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(activeColor);
    }
  }

  update(dt: number, state: "playing" | "countdown" | "ready" | "gameover"): void {
    if (state === "playing") {
      // Physics: Apply gravity
      this.vy += GRAVITY * dt;
      if (this.vy < MAX_FALL_VELOCITY) this.vy = MAX_FALL_VELOCITY;
      this.object.position.y += this.vy * dt;

      // Handle trail history recording
      this.trailSpawnTimer += dt;
      if (this.trailSpawnTimer > 0.015) { // record every 15ms
        this.trailSpawnTimer = 0;
        this.trailHistory.unshift(this.object.position.clone());
        if (this.trailHistory.length > this.maxTrailLength) {
          this.trailHistory.pop();
        }
      }
    } else if (state === "countdown" || state === "ready") {
      // Floating idle bob
      const time = performance.now() * 0.003;
      this.object.position.y = 2.5 + Math.sin(time * 3) * 0.15;
      this.vy = 0;
    }

    // Squash & stretch animation
    if (state === "playing") {
      if (this.squashTime > 0) {
        // Easing out the squash
        this.squashTime -= dt;
        this.currentScale.lerp(this.targetScale, 0.4);
        if (this.squashTime <= 0) {
          this.targetScale.set(1, 1, 1);
        }
      } else {
        // Stretch based on vertical velocity
        if (this.vy > 0) {
          // Going up: stretch
          const stretch = Math.min(this.vy * 0.04, 0.3);
          this.targetScale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
        } else {
          // Falling: stretch downwards
          const stretch = Math.min(Math.abs(this.vy) * 0.03, 0.4);
          this.targetScale.set(1 - stretch * 0.4, 1 + stretch, 1 - stretch * 0.4);
        }
        this.currentScale.lerp(this.targetScale, 0.2);
      }
    } else {
      this.currentScale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
    }
    
    this.sphere.scale.copy(this.currentScale);

    // Render trail meshes
    for (let i = 0; i < this.trailMeshes.length; i++) {
      const mesh = this.trailMeshes[i];
      if (i < this.trailHistory.length && state === "playing") {
        mesh.position.copy(this.trailHistory[i]);
        mesh.visible = true;

        // Visual fade out
        const ratio = i / this.maxTrailLength;
        const baseOpacity = this.isFireball ? 0.8 : 0.4;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = baseOpacity * (1 - ratio);
        
        // Scale down trail
        const scaleVal = 1 - ratio * 0.8;
        mesh.scale.set(scaleVal, scaleVal, scaleVal);
      } else {
        mesh.visible = false;
      }
    }
  }
}
