import * as THREE from "three";
import { Ball } from "./Ball";
import { Tower } from "./Tower";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import {
  BACKGROUND_COLOR,
  BEST_SCORE_KEY,
  CAM_FOV,
  CAM_HEIGHT_OFFSET,
  CAM_BACK,
  CAM_LOOK_Y_OFFSET,
  CAM_LERP,
  LEVEL_SPACING,
  BALL_RADIUS,
  PLATFORM_THICKNESS,
  COMBO_THRESHOLD,
  BOUNCE_VELOCITY,
} from "./constants";

type GameState = "ready" | "countdown" | "playing" | "gameover";

const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;
const MAX_DT = 0.1;

export class Game {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunTarget = new THREE.Object3D();

  private readonly tower = new Tower();
  private readonly ball = new Ball();
  private readonly input: InputController;
  private readonly hud: Hud;
  private readonly room: RoomMode | null;

  private readonly lookTarget = new THREE.Vector3();

  // Game state
  private state: GameState = "ready";
  private score = 0;
  private best = 0;
  private deadFor = 0;
  private highestPassedLevel = -1;
  private lastBounceLevelIndex = 0;
  private collisionCooldown = 0; // Prevent multi-colliding in a single bounce

  // Countdown timer
  private countdownTime = 0;
  private lastCountdownIndex = -1;
  
  // Screen shake
  private screenShakeTime = 0;

  // Frame timing
  private lastTime = performance.now();

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene Setup
    const bgColor = new THREE.Color(BACKGROUND_COLOR);
    this.scene.background = bgColor;
    this.scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, 0.045);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      CAM_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, CAM_HEIGHT_OFFSET, CAM_BACK);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Lights Setup
    // Soft sky light and ground light
    this.scene.add(new THREE.HemisphereLight(0xcdb4db, 0x221a28, 1.2));
    
    // Directional light casting shadows (moves vertically with the ball)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
    this.sun.position.set(5, 10, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 25;
    this.sun.shadow.camera.left = -5;
    this.sun.shadow.camera.right = 5;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -8;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    // 5. Add Game Objects
    this.scene.add(this.tower.object);
    this.scene.add(this.ball.object);
    this.scene.add(this.ball.getTrailGroup());

    // 6. Controllers and HUD
    this.input = new InputController(this.renderer.domElement, () => this.handleActivate());
    this.hud = new Hud(this.container, () => this.handleActivate());

    this.best = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    this.hud.setBest(this.best);
    this.hud.showStart();

    // 7. Supabase Room Mode
    this.room = initRoomMode("helix-jump", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });

    // Initial positioning
    this.updateCamera(1, 0.016);
    window.addEventListener("resize", this.onResize);
    
    // Begin Loop
    this.renderer.setAnimationLoop(this.tick);
  }

  private handleActivate(): void {
    if (this.state === "playing" || this.state === "countdown") return;
    if (this.state === "gameover" && (this.room || this.deadFor < 0.6)) return;
    this.beginCountdown();
  }

  private beginCountdown(): void {
    this.ball.reset();
    this.tower.reset();
    this.input.reset();
    this.score = 0;
    this.hud.setScore(0);
    this.highestPassedLevel = -1;
    this.lastBounceLevelIndex = 0;
    this.collisionCooldown = 0;
    this.screenShakeTime = 0;

    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private updateCountdown(dt: number): void {
    this.ball.update(dt, "countdown");
    this.tower.update(dt, 0);

    this.countdownTime += dt;
    const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
    if (index >= COUNTDOWN_LABELS.length) {
      this.startGame();
    } else if (index !== this.lastCountdownIndex) {
      this.lastCountdownIndex = index;
      SoundEffects.playCountdownTick();
      this.hud.showCountdown(COUNTDOWN_LABELS[index]);
    }
  }

  private startGame(): void {
    this.ball.reset();
    this.input.reset();
    this.score = 0;
    this.highestPassedLevel = -1;
    this.lastBounceLevelIndex = 0;
    this.collisionCooldown = 0;
    this.hud.setScore(0);
    this.hud.hide();
    this.hud.showCountdown(null);
    this.state = "playing";
  }

  private die(): void {
    this.state = "gameover";
    this.deadFor = 0;
    SoundEffects.playDeath();

    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_SCORE_KEY, String(this.best));
      this.hud.setBest(this.best);
    }
    this.hud.showGameOver(this.score, this.best);

    if (this.room) {
      this.room.reportScore(this.score);
    } else {
      this.hud.showRanking("helix-jump", this.score);
    }
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    if (this.state === "playing") {
      this.updatePlaying(dt);
    } else if (this.state === "countdown") {
      this.updateCountdown(dt);
    } else {
      this.updateIdle(dt);
    }

    this.updateCamera(this.state === "playing" ? CAM_LERP : 0.05, dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlaying(dt: number): void {
    // 1. Rotate tower based on player input
    const rotationDelta = this.input.getRotationDelta(dt);
    if (rotationDelta !== 0) {
      this.tower.rotate(rotationDelta);
    }

    // 2. Physics & Ball Update
    this.ball.update(dt, "playing");

    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= dt;
    }

    // 3. Collision Checking (Ball vs Platform Levels)
    const ballY = this.ball.object.position.y;
    const ballBottom = ballY - BALL_RADIUS;

    // Find the level index nearest to the ball's bottom
    const nearestLevelIdx = Math.round(-ballBottom / LEVEL_SPACING);
    const levelHeight = -nearestLevelIdx * LEVEL_SPACING;

    // We check if the ball is intersecting with the nearest platform level
    // Platforms have a thickness: [levelHeight, levelHeight + PLATFORM_THICKNESS]
    // The ball is falling downwards and hits the top surface of the platform
    const isBallDescending = this.ball.vy <= 0;
    const isNearTopSurface =
      ballBottom <= levelHeight + 0.1 &&
      ballBottom >= levelHeight - PLATFORM_THICKNESS - 0.15;

    if (isBallDescending && isNearTopSurface && nearestLevelIdx >= 0 && this.collisionCooldown <= 0) {
      // Local angle of the ball's position relative to the tower
      // Tower cylinder is along XZ, ball is always in front along +Z (angle 270 deg / 1.5 * Math.PI)
      const localAngle = 1.5 * Math.PI - this.tower.rotationY;
      const segmentType = this.tower.getSegmentType(nearestLevelIdx, localAngle);

      if (segmentType === "normal" || segmentType === "obstacle") {
        if (this.ball.isFireball) {
          // Smash and break right through the platform!
          this.tower.breakLevel(nearestLevelIdx);
          SoundEffects.playBreak();
          this.screenShakeTime = 0.25; // Trigger screen shake
          
          this.ball.setFireball(false);
          this.lastBounceLevelIndex = nearestLevelIdx; // Reset combo origin
          this.collisionCooldown = 0.2; // Brief cooldown to avoid instant re-trigger
        } else if (segmentType === "normal") {
          // Normal bounce
          this.ball.vy = BOUNCE_VELOCITY;
          this.ball.bounce();
          SoundEffects.playBounce();
          
          // Reset combo logic
          this.lastBounceLevelIndex = nearestLevelIdx;
          this.collisionCooldown = 0.15;

          // Push ball position exactly above the platform to prevent clips
          this.ball.object.position.y = levelHeight + BALL_RADIUS + 0.05;
        } else if (segmentType === "obstacle") {
          // Hit an obstacle -> Death!
          this.die();
          return;
        }
      }
    }

    // 4. Scoring Logic (Triggers when ball passes through gaps)
    // If the ball falls past a level index, count score and check fireball combo
    const currentPassIdx = Math.floor(-ballY / LEVEL_SPACING);
    if (currentPassIdx > this.highestPassedLevel) {
      // Calculate how many levels were passed in a single drop
      const fallDepth = currentPassIdx - this.lastBounceLevelIndex + 1;
      
      if (fallDepth > 0) {
        // Award points (with combo multipliers)
        const pointsEarned = fallDepth * (fallDepth >= COMBO_THRESHOLD ? 2 : 1);
        this.score += pointsEarned;
        this.hud.setScore(this.score);

        // Activate fireball if combo threshold reached
        if (fallDepth >= COMBO_THRESHOLD) {
          this.ball.setFireball(true);
        }

        SoundEffects.playPassLevel(fallDepth);
      }
      this.highestPassedLevel = currentPassIdx;
    }

    // 5. Update Tower crumbling physics
    this.tower.update(dt, nearestLevelIdx);
  }

  private updateIdle(dt: number): void {
    this.ball.update(dt, this.state);
    
    // Smoothly rotate the tower slowly in idle mode for preview
    this.tower.rotate(0.2 * dt);
    
    const nearestLevelIdx = Math.max(0, Math.round(-this.ball.object.position.y / LEVEL_SPACING));
    this.tower.update(dt, nearestLevelIdx);

    if (this.state === "gameover") {
      this.deadFor += dt;
    }
  }

  private updateCamera(lerpFactor: number, dt: number): void {
    // Target camera Y tracks the ball, positioned slightly above
    const targetY = this.ball.object.position.y + CAM_HEIGHT_OFFSET;
    
    // Smooth vertical camera tracking
    this.camera.position.y = THREE.MathUtils.lerp(
      this.camera.position.y,
      targetY,
      lerpFactor
    );
    
    this.camera.position.x = 0;
    this.camera.position.z = CAM_BACK;

    // Apply Screen Shake if active
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      const shakeForce = 0.12;
      this.camera.position.x += (Math.random() - 0.5) * shakeForce;
      this.camera.position.y += (Math.random() - 0.5) * shakeForce;
      this.camera.position.z += (Math.random() - 0.5) * shakeForce;
    }

    // Camera look target tracks the ball but offset slightly down
    this.lookTarget.set(0, this.ball.object.position.y + CAM_LOOK_Y_OFFSET, 0);
    this.camera.lookAt(this.lookTarget);

    // Light follows the ball's height to keep illumination consistent
    this.sunTarget.position.set(0, this.ball.object.position.y, 0);
    this.sun.position.set(5, this.ball.object.position.y + 10, 6);
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
