import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Bartender } from "./Bartender";
import { BartenderView } from "./BartenderView";
import { Lanes } from "./Lanes";
import { Barroom } from "./Barroom";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import {
  BARTENDER_X,
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  CAM_FOLLOW_Y,
  CAM_FOV,
  CAM_LERP,
  CAM_LOOK_X,
  CAM_LOOK_Y,
  CAM_LOOK_Z,
  CAM_POS_X,
  CAM_POS_Y,
  CAM_POS_Z,
  COLOR_BACKGROUND,
  COLOR_FOG,
  FOG_FAR,
  FOG_NEAR,
  LANE_COUNT,
  MAX_DT,
  MAX_MISSES,
  PIXEL_SIZE,
  POINTS_CATCH,
  POINTS_SERVE,
  POINTS_SERVE_PUNK,
  POINTS_TIP,
  TAP_X,
  TIP_SLOW_DURATION,
  TIP_SLOW_FACTOR,
} from "./constants";
import { laneCounterTopY, laneFloorY, lanePeopleZ, laneZ } from "./layout";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "barra-libre:best";
/** Countdown before a run starts: one label shown per COUNTDOWN_STEP seconds. */
const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

/** Orchestrates scene / camera / composer, the state machine and the loop.
 *  Retro HD-2D like Keepers!, set in a night bar: four stepped counters,
 *  customers marching at the tap, and a light rig doing the heavy lifting
 *  (lamps, neon, pulses, the glint that tracks the sliding beer). */
export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly pixelPass: RenderPixelatedPass;

  private readonly bartender = new Bartender();
  private readonly bartenderView = new BartenderView();
  private readonly lanes = new Lanes();
  private readonly barroom = new Barroom();
  private readonly hud: Hud;
  private readonly input: InputController;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;

  /** Warm glint under the tap while pouring / tracking the sliding beer. */
  private readonly tapLight = new THREE.PointLight(0xffc46a, 0, 4, 2);

  private state: State = "ready";
  private score = 0;
  private misses = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  /** Seconds of play, drives the difficulty phases. */
  private elapsed = 0;
  private deadFor = 0;
  private countdownTime = 0;
  /** Last countdown index that played a tick, so each number sounds once. */
  private lastCountdownIndex = -1;
  /** Remaining tip-show time: customers advance at half speed. */
  private slowTimer = 0;
  /** Remaining camera-shake time after a strike, s. */
  private shakeTime = 0;
  /** Flash intensity when a beer is fully poured. */
  private pourFlash = 0;
  private lastTime = performance.now();

  private readonly lookTarget = new THREE.Vector3(0, CAM_LOOK_Y, CAM_LOOK_Z);
  private readonly projected = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(COLOR_BACKGROUND);
    this.scene.fog = new THREE.Fog(COLOR_FOG, FOG_NEAR, FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(
      CAM_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      80,
    );
    this.camera.position.set(CAM_POS_X, CAM_POS_Y, CAM_POS_Z);
    this.camera.lookAt(this.lookTarget);

    this.renderer = new THREE.WebGLRenderer({ powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "game-canvas";
    container.appendChild(this.renderer.domElement);

    // Retro post chain: pixelate the lit scene, then bloom the highlights
    // (threshold low enough that neon and lamps glow).
    this.composer = new EffectComposer(this.renderer);
    this.pixelPass = new RenderPixelatedPass(PIXEL_SIZE, this.scene, this.camera);
    this.pixelPass.normalEdgeStrength = 0.25;
    this.pixelPass.depthEdgeStrength = 0.3;
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        BLOOM_STRENGTH,
        BLOOM_RADIUS,
        BLOOM_THRESHOLD,
      ),
    );
    this.composer.addPass(new OutputPass());

    this.scene.add(
      this.barroom.object,
      this.lanes.object,
      this.bartenderView.object,
      this.tapLight,
    );

    this.hud = new Hud(container);
    this.hud.setBest(this.best);
    this.hud.setMisses(0);
    this.hud.showHud(false);
    this.hud.showStart();

    this.input = new InputController(
      (dir) => this.onLaneMove(dir),
      () => this.onPourStart(),
      () => this.onPourEnd(),
      () => this.requestStart(),
      (clientY) => this.onPointerPress(clientY),
    );

    this.room = initRoomMode("barra-libre", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    window.addEventListener("resize", this.onResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  private onLaneMove(dir: number): void {
    if (this.state !== "playing") return;
    this.bartender.moveLane(dir);
  }

  private onPourStart(): void {
    if (this.state !== "playing") return;
    if (this.bartender.startPour()) SoundEffects.playPour();
  }

  private onPourEnd(): void {
    if (this.state !== "playing") return;
    const result = this.bartender.releasePour();
    if (result === "serve") {
      this.lanes.serve(this.bartender.lane);
      this.bartenderView.triggerServe();
      SoundEffects.playServe();
    } else if (result === "discard") {
      SoundEffects.playDiscard();
    }
  }

  /** A press anywhere: start the run, or hop to the bar under the finger
   *  and open the tap (the release serves). */
  private onPointerPress(clientY: number): void {
    if (this.state !== "playing") {
      this.requestStart();
      return;
    }
    const lane = this.nearestLane(clientY);
    if (lane !== this.bartender.lane) this.bartender.moveTo(lane);
    if (this.bartender.lane === lane) this.onPourStart();
  }

  /** Maps a screen Y to the visually nearest lane by projecting each
   *  lane's bartender spot into screen space. */
  private nearestLane(clientY: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.projected.set(BARTENDER_X, laneFloorY(lane) + 0.9, lanePeopleZ(lane));
      this.projected.project(this.camera);
      const screenY = ((1 - this.projected.y) / 2) * window.innerHeight;
      const dist = Math.abs(clientY - screenY);
      if (dist < bestDist) {
        bestDist = dist;
        best = lane;
      }
    }
    return best;
  }

  /** Enter or a tap on a start / game-over screen begins the countdown. */
  private requestStart(): void {
    if (this.state === "playing" || this.state === "countdown") return;
    // En modo sala se juega una sola partida por ronda: sin reintento.
    if (this.state === "dead" && (this.room || this.deadFor < 0.6)) return;
    this.beginCountdown();
  }

  /** Resets the bar and runs the 3-2-1-YA countdown before play begins. */
  private beginCountdown(): void {
    this.lanes.reset();
    this.bartender.reset();
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.showHud(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private updateCountdown(dt: number): void {
    this.countdownTime += dt;
    const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
    if (index >= COUNTDOWN_LABELS.length) this.start();
    else if (index !== this.lastCountdownIndex) {
      this.lastCountdownIndex = index;
      SoundEffects.playCountdownTick();
      this.hud.showCountdown(COUNTDOWN_LABELS[index]);
    }
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    this.misses = 0;
    this.elapsed = 0;
    this.slowTimer = 0;
    this.lanes.reset();
    this.bartender.reset();
    this.hud.setScore(0);
    this.hud.setMisses(0);
    this.hud.showHud(true);
    this.hud.hide();
    this.hud.showCountdown(null);
    SoundEffects.playBell();
  }

  private die(): void {
    this.state = "dead";
    this.deadFor = 0;
    this.hud.showHud(false);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(this.score, this.best);
    SoundEffects.playGameOver();
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("barra-libre", this.score);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    if (this.state === "playing") this.updatePlaying(dt);
    else if (this.state === "countdown") this.updateCountdown(dt);
    else if (this.state === "dead") this.deadFor += dt;

    this.bartenderView.update(dt, this.bartender);
    this.barroom.update(dt);
    this.updateLights(dt);
    this.updateCamera(dt);
    this.composer.render();

    // Hook de estado para los scripts de QA (scripts/inspect-threejs-canvas.mjs
    // y sondas headless: el WebGL por software corre lento, asi que los tests
    // esperan estados en vez de tiempos).
    (window as any).__THREE_GAME_DIAGNOSTICS__ = {
      state: this.state,
      score: this.score,
      misses: this.misses,
      lane: this.bartender.lane,
      pour: this.bartender.pour,
      pourLevel: this.bartender.pourLevel,
      elapsed: this.elapsed,
    };
  };

  private updatePlaying(dt: number): void {
    this.elapsed += dt;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    const slowFactor = this.slowTimer > 0 ? TIP_SLOW_FACTOR : 1;

    if (this.bartender.update(dt)) {
      SoundEffects.playFull();
      this.pourFlash = 1.0;
    }

    const events = this.lanes.update(dt, this.elapsed, slowFactor, this.bartender.lane);
    for (const event of events) {
      switch (event.type) {
        case "served": {
          this.addScore(event.kind === "punk" ? POINTS_SERVE_PUNK : POINTS_SERVE);
          this.barroom.pulseGood.intensity = event.satisfied ? 24 : 16;
          if (event.satisfied) SoundEffects.playSatisfied();
          else SoundEffects.playServedHit();
          break;
        }
        case "caught": {
          this.bartenderView.triggerCatch();
          if (event.what === "tip") {
            this.addScore(POINTS_TIP);
            this.slowTimer = TIP_SLOW_DURATION;
            this.barroom.pulseGood.intensity = 28;
            this.hud.flashFeedback(`PROPINA +${POINTS_TIP}`, "gold");
            SoundEffects.playCoin();
          } else {
            this.addScore(POINTS_CATCH);
            this.barroom.pulseGood.intensity = 14;
            SoundEffects.playCatch();
          }
          break;
        }
        case "escaped":
          this.strike("TE AGARRARON");
          break;
        case "crashed":
          SoundEffects.playCrash();
          this.strike("VASO ROTO");
          break;
        case "mugFell":
          this.strike("VASO AL PISO");
          break;
      }
      if (this.state !== "playing") return;
    }
  }

  private addScore(points: number): void {
    this.score += points;
    this.hud.setScore(this.score);
  }

  private strike(label: string): void {
    this.misses += 1;
    this.hud.setMisses(this.misses);
    this.hud.flashFeedback(label, "bad");
    this.barroom.pulseBad.intensity = 30;
    this.shakeTime = 0.3;
    SoundEffects.playStrike();
    if (this.misses >= MAX_MISSES) this.die();
  }

  /** Dynamic lighting: the tap stays dim while pouring and flashes when the
   *  mug tops off (destello); once the beer is sliding the tap light fades
   *  out so the trip down the counter isn't lit. Feedback pulses decay. */
  private updateLights(dt: number): void {
    this.pourFlash = Math.max(0, this.pourFlash - dt * 5.0);

    if (this.bartender.locked) {
      const lane = this.bartender.lane;
      this.tapLight.position.set(TAP_X - 0.2, laneCounterTopY(lane) + 0.5, laneZ(lane) + 0.1);
      if (this.bartender.pour === "full") {
        this.tapLight.intensity = 3.0 + this.pourFlash * 8.0;
      } else {
        this.tapLight.intensity = 0.8;
      }
    } else {
      // Not pouring: the tap light fades out (no glint chasing the beer).
      this.tapLight.intensity = Math.max(0, this.tapLight.intensity - dt * 18);
    }

    this.barroom.pulseGood.intensity = Math.max(0, this.barroom.pulseGood.intensity - dt * 80);
    this.barroom.pulseBad.intensity = Math.max(0, this.barroom.pulseBad.intensity - dt * 70);
  }

  private updateCamera(dt: number): void {
    const targetX = CAM_POS_X;
    const targetY = CAM_POS_Y + this.bartender.visualLane * CAM_FOLLOW_Y;
    const targetZ = CAM_POS_Z;
    const t = Math.min(1, dt * CAM_LERP);
    this.camera.position.x += (targetX - this.camera.position.x) * t;
    this.camera.position.y += (targetY - this.camera.position.y) * t;
    this.camera.position.z += (targetZ - this.camera.position.z) * t;

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const amp = 0.08 * (this.shakeTime / 0.3);
      this.camera.position.x += (Math.random() * 2 - 1) * amp;
      this.camera.position.y += (Math.random() * 2 - 1) * amp;
    }

    this.lookTarget.set(
      CAM_LOOK_X,
      CAM_LOOK_Y + this.bartender.visualLane * CAM_FOLLOW_Y * 0.6,
      CAM_LOOK_Z,
    );
    this.camera.lookAt(this.lookTarget);
  }

  private readonly onResize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  };

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.renderer.setAnimationLoop(null);
    this.input.dispose();
  }
}
