import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import { Tree } from "./Tree";
import { Lumberjack } from "./Lumberjack";
import { Environment } from "./Environment";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { toon } from "./materials";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import {
  BEST_SCORE_KEY,
  CAMERA_SHAKE,
  GROUND_COLOR,
  GROUND_EDGE_COLOR,
  SKY_BOTTOM_COLOR,
  SKY_TOP_COLOR,
  TIMER_DRAIN_BASE,
  TIMER_DRAIN_MAX,
  TIMER_DRAIN_RAMP,
  TIMER_GAIN,
  TIMER_MAX,
  TIMER_START,
} from "./constants";

type GameState = "ready" | "countdown" | "playing" | "gameover";

/** Countdown before a run starts: one label shown per COUNTDOWN_STEP seconds. */
const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

export class Game {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;

  private readonly tree: Tree;
  private readonly lumberjack: Lumberjack;
  private readonly environment: Environment;
  private readonly input: InputController;
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private readonly container: HTMLElement;
  private state: GameState = "ready";
  private score = 0;
  private best = 0;
  private timer = TIMER_START;
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  private shake = 0;
  private readonly cameraBase = new THREE.Vector3(0, 3.0, 8.2);
  private lastTime = performance.now();

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_BOTTOM_COLOR), 18, 40);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 3.4, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.18,
      0.5,
      0.9,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.scene.add(new THREE.HemisphereLight(0xe8a7d7, 0x2b1029, 1.2));
    const sun = new THREE.DirectionalLight(0xffe6b3, 1.8);
    sun.position.set(6, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 34;
    const s = 9;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s + 5;
    sun.shadow.camera.bottom = -s;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8c52ff, 0.55);
    fill.position.set(-6, 4, -3);
    this.scene.add(fill);

    this.scene.add(makeGround());
    this.environment = new Environment();
    this.scene.add(this.environment.group);

    this.tree = new Tree();
    this.lumberjack = new Lumberjack();
    this.scene.add(this.tree.group, this.lumberjack.group);

    this.input = new InputController(this.renderer.domElement);
    this.hud = new Hud(this.container, () => this.handleActivate());

    this.best = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    this.hud.setBest(this.best);
    this.hud.showStart();

    this.room = initRoomMode("timberman", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    window.addEventListener("resize", this.onResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  private handleActivate(): void {
    if (this.state === "playing" || this.state === "countdown") return;
    // En modo sala se juega una sola partida por ronda: sin reintento.
    if (this.room && this.state === "gameover") return;
    this.beginCountdown();
  }

  /** Resets the run and runs the 3-2-1-YA countdown before play begins. */
  private beginCountdown(): void {
    this.tree.reset();
    this.lumberjack.reset();
    this.input.clear();
    this.timer = TIMER_START;
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.hide();
    this.hud.showTimer(true);
    this.hud.setTimer(this.timer);
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private startGame(): void {
    this.score = 0;
    this.timer = TIMER_START;
    this.input.clear();
    this.hud.setScore(0);
    this.hud.setTimer(this.timer);
    this.hud.hide();
    this.hud.showCountdown(null);
    this.state = "playing";
    this.lastTime = performance.now();
  }

  private endGame(): void {
    this.state = "gameover";
    SoundEffects.playHit();
    this.shake = CAMERA_SHAKE * 4;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_SCORE_KEY, String(this.best));
    }
    this.hud.setBest(this.best);
    this.hud.showGameOver(this.score, this.best);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("timberman", this.score);
  }

  private processInput(): void {
    let side = this.input.consumeChop();
    while (side) {
      this.lumberjack.chop(side);
      SoundEffects.playChop();
      // Chop the bottom log: the tree drops one and a new log settles beside the
      // lumberjack. If that log has a branch on his side, it goes through him: hit.
      this.tree.chop(side);
      if (this.tree.bottomBranch === side) {
        this.endGame();
        return;
      }
      this.score++;
      this.timer = Math.min(TIMER_MAX, this.timer + TIMER_GAIN);
      this.shake = CAMERA_SHAKE;
      this.hud.setScore(this.score);
      side = this.input.consumeChop();
    }
    this.hud.setTimer(this.timer);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === "playing") {
      this.processInput();
      if (this.state === "playing") {
        const drain = Math.min(TIMER_DRAIN_MAX, TIMER_DRAIN_BASE + this.score * TIMER_DRAIN_RAMP);
        this.timer -= drain * dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.hud.setTimer(0);
          this.endGame();
        } else {
          this.hud.setTimer(this.timer);
        }
      }
    } else if (this.state === "countdown") {
      this.countdownTime += dt;
      const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
      if (index >= COUNTDOWN_LABELS.length) this.startGame();
      else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    }

    this.tree.update(dt);
    this.lumberjack.update(dt);
    this.environment.update(dt);
    this.applyCameraShake(dt);

    this.composer.render();
  };

  private applyCameraShake(dt: number): void {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.9);
    this.camera.position.set(
      this.cameraBase.x + (Math.random() - 0.5) * this.shake,
      this.cameraBase.y + (Math.random() - 0.5) * this.shake,
      this.cameraBase.z,
    );
  }

  private readonly onResize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloomPass.setSize(innerWidth, innerHeight);
  };
}

/** Vertical sky gradient rendered to a small canvas texture. */
function makeSkyTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY_TOP_COLOR);
  grad.addColorStop(1, SKY_BOTTOM_COLOR);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grassy disc the lumberjack stands on, over a dirt base. */
function makeGround(): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.6, 48), toon(GROUND_COLOR));
  top.position.y = -0.3;
  top.receiveShadow = true;
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(6, 5.2, 1.6, 48), toon(GROUND_EDGE_COLOR));
  dirt.position.y = -1.25;
  dirt.receiveShadow = true;
  group.add(top, dirt);
  return group;
}
