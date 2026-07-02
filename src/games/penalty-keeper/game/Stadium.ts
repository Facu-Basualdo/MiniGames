import * as THREE from "three";
import {
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  PENALTY_SPOT_Z,
  POST_RADIUS,
} from "./constants";
import { buildCrowd, buildGrassTexture, buildLinesTexture, buildTribuneTexture } from "./sprites";

/** Seconds between the two crowd postures. */
const CROWD_FRAME_TIME = 0.65;

/** Static world plus the lights, including the two feedback lights the Game
 *  pulses on saves and goals (the "dynamic" part of the lighting). */
export class Stadium {
  readonly object = new THREE.Group();
  /** Cool floodlight pulse fired on a save. */
  readonly savePulse: THREE.PointLight;
  /** Red pulse fired on a conceded goal. */
  readonly goalPulse: THREE.PointLight;

  /** Two crowd postures swapped on a timer so the tribune feels alive. */
  private readonly crowdFrames: THREE.CanvasTexture[];
  private crowdMaterial!: THREE.MeshBasicMaterial;
  private crowdTime = 0;
  private crowdFrame = 0;

  constructor() {
    const fans = buildCrowd(384);
    this.crowdFrames = [buildTribuneTexture(fans, 0), buildTribuneTexture(fans, 1)];
    this.object.add(this.buildGround());
    this.object.add(this.buildGoal());
    this.object.add(this.buildSurroundings());
    this.buildLights();

    this.savePulse = new THREE.PointLight(0x7cffb0, 0, 14, 1.6);
    this.savePulse.position.set(0, 2.2, 1.6);
    this.goalPulse = new THREE.PointLight(0xff4040, 0, 14, 1.6);
    this.goalPulse.position.set(0, 1.6, -1.2);
    this.object.add(this.savePulse, this.goalPulse);
  }

  private buildGround(): THREE.Group {
    const group = new THREE.Group();

    const grass = buildGrassTexture();
    grass.repeat.set(14, 12);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 70),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 18);
    ground.receiveShadow = true;
    group.add(ground);

    // Field markings: an alpha overlay floating a hair above the grass.
    const linesW = 44;
    const linesD = 18;
    const lines = new THREE.Mesh(
      new THREE.PlaneGeometry(linesW, linesD),
      new THREE.MeshStandardMaterial({
        map: buildLinesTexture(linesW, linesD),
        transparent: true,
        roughness: 0.9,
      }),
    );
    lines.rotation.x = -Math.PI / 2;
    lines.position.set(0, 0.01, linesD / 2);
    lines.receiveShadow = true;
    group.add(lines);

    return group;
  }

  /** Open frame: two posts and a crossbar, no net. */
  private buildGoal(): THREE.Group {
    const goal = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.1 });

    const postGeometry = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 8);
    const postL = new THREE.Mesh(postGeometry, mat);
    postL.position.set(-GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0);
    postL.castShadow = true;
    const postR = postL.clone();
    postR.position.x = GOAL_HALF_WIDTH;

    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, GOAL_HALF_WIDTH * 2 + POST_RADIUS * 2, 8),
      mat,
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, GOAL_HEIGHT + POST_RADIUS, 0);
    bar.castShadow = true;

    goal.add(postL, postR, bar);
    return goal;
  }

  private buildSurroundings(): THREE.Group {
    const group = new THREE.Group();

    // Ad boards along the far edge, with a faint emissive top edge for bloom.
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x13233a, roughness: 0.7 });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x1d3a5f,
      emissive: 0x2f6ab0,
      emissiveIntensity: 0.8,
    });
    for (const x of [-16, 0, 16]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(15, 0.9, 0.15), boardMat);
      board.position.set(x, 0.45, 26);
      group.add(board);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(15, 0.06, 0.16), edgeMat);
      edge.position.set(x, 0.93, 26);
      group.add(edge);
    }

    // Tribune with the animated pixel crowd, close enough that the fans
    // read through the fog.
    this.crowdMaterial = new THREE.MeshBasicMaterial({ map: this.crowdFrames[0] });
    const tribune = new THREE.Mesh(new THREE.PlaneGeometry(88, 6.2), this.crowdMaterial);
    tribune.position.set(0, 3.5, 33);
    tribune.rotation.y = Math.PI;
    group.add(tribune);

    // Floodlight towers with emissive heads (bloom picks these up).
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ff,
      emissive: 0xcfe0ff,
      emissiveIntensity: 2.2,
    });
    for (const x of [-19, 19]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 13, 6), mastMat);
      mast.position.set(x, 6.5, 32);
      group.add(mast);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.4), headMat);
      head.position.set(x, 13.4, 32);
      head.rotation.x = 0.35;
      group.add(head);
    }

    return group;
  }

  private buildLights(): void {
    this.object.add(new THREE.HemisphereLight(0xa9c2e8, 0x0c1810, 0.62));

    // Key "floodlight" comes from where the towers stand (high, out on the
    // pitch) so every shadow falls back toward the goal, matching the
    // visible light sources. Frustum covers goal to kicker with margin.
    const key = new THREE.DirectionalLight(0xeef3ff, 1.75);
    key.position.set(-7, 22, 26);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 70;
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 22;
    key.shadow.camera.bottom = -22;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.target.position.set(0, 0, 2);
    this.object.add(key, key.target);

    // Warm side spot from the right tower, aimed at the penalty area — gives
    // the sprites a lit side and a dark side so the lighting reads.
    const spot = new THREE.SpotLight(0xffe8c4, 45, 50, 0.5, 0.6, 1.3);
    spot.position.set(19, 13, 30);
    spot.target.position.set(0, 0, PENALTY_SPOT_Z);
    this.object.add(spot, spot.target);

    const rim = new THREE.DirectionalLight(0x7fa8e8, 0.5);
    rim.position.set(10, 9, -8);
    this.object.add(rim);
  }

  /** Swaps the crowd posture on a timer. */
  update(dt: number): void {
    this.crowdTime += dt;
    if (this.crowdTime < CROWD_FRAME_TIME) return;
    this.crowdTime = 0;
    this.crowdFrame = 1 - this.crowdFrame;
    this.crowdMaterial.map = this.crowdFrames[this.crowdFrame];
    this.crowdMaterial.needsUpdate = true;
  }
}
