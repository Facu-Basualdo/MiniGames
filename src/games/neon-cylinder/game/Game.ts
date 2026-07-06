import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import { Tunnel } from "./Tunnel";
import { Player } from "./Player";
import { ObstacleSpawner } from "./ObstacleSpawner";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import {
  BACKGROUND_COLOR,
  BASE_SPEED,
  BEST_SCORE_KEY,
  CAMERA_Z,
  FOG_FAR,
  FOG_NEAR,
  MAX_SPEED,
  SPEED_RAMP_PER_SEC,
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

  private readonly tunnel: Tunnel;
  private readonly player: Player;
  private readonly spawner: ObstacleSpawner;
  private readonly input: InputController;
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  private readonly container: HTMLElement;
  private state: GameState = "ready";
  private score = 0;
  private best = 0;
  private elapsed = 0;
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  private lastTime = performance.now();

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, FOG_NEAR, FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 0, CAMERA_Z);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.85,
      0.4,
      0.4,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.tunnel = new Tunnel();
    this.player = new Player();
    this.spawner = new ObstacleSpawner(this.scene);

    this.scene.add(this.tunnel.mesh, this.player.object);

    this.input = new InputController(this.renderer.domElement);
    this.hud = new Hud(this.container, () => this.handleActivate());

    this.best = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    this.hud.setBest(this.best);
    this.hud.showStart();

    this.room = initRoomMode("neon-cylinder", {
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
    this.player.reset();
    this.spawner.reset();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private startGame(): void {
    this.player.reset();
    this.spawner.reset();
    this.score = 0;
    this.elapsed = 0;
    this.hud.setScore(0);
    this.hud.hide();
    this.hud.showCountdown(null);
    this.state = "playing";
    this.lastTime = performance.now();
  }

  private endGame(): void {
    this.state = "gameover";
    SoundEffects.playHit();
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_SCORE_KEY, String(this.best));
    }
    this.hud.setBest(this.best);
    this.hud.showGameOver(this.score, this.best);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("neon-cylinder", this.score);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === "playing") {
      this.elapsed += dt;
      const speed = Math.min(BASE_SPEED + this.elapsed * SPEED_RAMP_PER_SEC, MAX_SPEED);
      const dz = speed * dt;

      if (this.input.consumeFlip()) {
        this.player.flip();
        SoundEffects.playFlip();
      }
      this.player.update(dt, this.input.direction);
      this.tunnel.scroll(dz);

      const events = this.spawner.update(dt, dz, this.player.angle, this.player.object.position.z, this.score);
      for (const event of events) {
        if (event === "hit") {
          this.endGame();
          break;
        }
        this.score++;
        SoundEffects.playScore();
      }
      this.hud.setScore(this.score);
    } else if (this.state === "countdown") {
      this.tunnel.scroll(dt * 4);
      this.countdownTime += dt;
      const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
      if (index >= COUNTDOWN_LABELS.length) this.startGame();
      else if (index !== this.lastCountdownIndex) {
        this.lastCountdownIndex = index;
        SoundEffects.playCountdownTick();
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    } else {
      this.tunnel.scroll(dt * 4);
    }

    this.composer.render();
  };

  private readonly onResize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloomPass.setSize(innerWidth, innerHeight);
  };
}
