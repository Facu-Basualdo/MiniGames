import { getNickname } from "../../../shared/nickname";
import { fetchRoomState, sanitizeCode } from "../../../shared/room/api";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { getSupabase } from "../../../shared/supabase";
import { Car, type CarInput } from "./Car";
import {
  BARRIER_RESTITUTION,
  BEST_KEY,
  CAR_LENGTH,
  CAR_RADIUS,
  CAR_WIDTH,
  CONE_HIT_COOLDOWN_MS,
  CONE_SLOW,
  MAX_DT,
  NET_SEND_MS,
  REMOTE_STALE_MS,
  WALL_MARGIN,
  WALL_RESTITUTION,
  colorFor,
  formatRaceTime,
  hashStr,
} from "./constants";
import { Hud } from "./Hud";
import {
  BARRIER_HALF_THICK,
  BOOST_RADIUS,
  CONE_RADIUS,
  buildObstacles,
  type Obstacles,
} from "./obstacles";
import { RaceChannel } from "./RaceChannel";
import { Renderer, type RemoteCar, type Skid } from "./Renderer";
import { TRACK_DEFS, buildTrack, trackPreview, type Track } from "./tracks";

type State = "loading" | "ready" | "countdown" | "racing" | "finished";

const COUNTDOWN_SEC = 3;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: Hud;
  private readonly renderer = new Renderer();
  private readonly car = new Car();
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  private readonly roomCode: string | null;

  private track!: Track;
  private selectedTrack = 0;
  private obstacles: Obstacles = { cones: [], barriers: [], boosts: [] };
  /** Marcas de derrape (se desvanecen). Indices de boost sobre los que estoy. */
  private readonly skids: Skid[] = [];
  private readonly insideBoost = new Set<number>();
  private prevRear: { lx: number; ly: number; rx: number; ry: number } | null = null;
  private state: State = "loading";
  private readonly me: string;
  private readonly myColor: string;

  /** Autos de los demas jugadores de la sala, por nickname. */
  private readonly remotes = new Map<string, RemoteCar>();
  private channel: RaceChannel | null = null;
  private sendAccMs = 0;

  private countdownLeft = 0;
  private startTime = 0;
  private finalMs = 0;
  private lap = 0;
  private prevS = 0;
  private sectors = [false, false, false];
  /** Mejor tiempo local del circuito actual (se recarga en setupTrack). */
  private best = 0;
  /** Resultado de la ultima carrera, para reponer su ranking al volver a el. */
  private lastResult: { trackId: string; ms: number } | null = null;

  private readonly keys: CarInput = { up: false, down: false, left: false, right: false };
  private lastTime = 0;
  private viewW = 0;
  private viewH = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container, () => this.onAction());

    const rawCode = new URLSearchParams(window.location.search).get("room");
    this.roomCode = rawCode ? sanitizeCode(rawCode) : null;
    this.me = getNickname() ?? "yo";
    this.myColor = colorFor(this.me);

    this.room = initRoomMode("car-race", { getScore: () => Math.round(this.elapsedMs()) });

    // Selector de circuito: solo en modo solo (en sala el mapa es fijo por seed).
    if (!this.room) {
      this.hud.buildMapSelector(
        TRACK_DEFS.map((_, i) => trackPreview(i)),
        (idx) => this.onSelectMap(idx),
      );
    }

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    this.resize();
    window.addEventListener("resize", () => this.resize());

    void this.boot();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  /**
   * Elige el circuito y arma el canal de posiciones. En modo sala el mapa sale
   * de un seed deterministico (codigo + ronda), asi todos corren en el mismo;
   * en solitario es aleatorio puro.
   */
  private async boot(): Promise<void> {
    let trackIdx = Math.floor(Math.random() * TRACK_DEFS.length);
    let obstacleSeed = (Math.random() * 0xffffffff) >>> 0;

    if (this.roomCode && getSupabase()) {
      const state = await fetchRoomState(this.roomCode);
      const round = state?.room.current_round ?? 0;
      // Seed determinista de sala: mismo circuito y mismos obstaculos para todos.
      const seed = hashStr(`${this.roomCode}:${round}`);
      trackIdx = seed % TRACK_DEFS.length;
      obstacleSeed = seed;

      this.channel = new RaceChannel(this.roomCode, round);
      this.channel.onPos((p) => {
        if (p.p === this.me) return;
        let car = this.remotes.get(p.p);
        if (!car) {
          car = {
            player: p.p,
            color: colorFor(p.p),
            x: p.x,
            y: p.y,
            angle: p.a,
            tx: p.x,
            ty: p.y,
            ta: p.a,
            lap: p.l,
            s: p.s,
            finished: p.f,
            lastAt: Date.now(),
          };
          this.remotes.set(p.p, car);
          return;
        }
        car.tx = p.x;
        car.ty = p.y;
        car.ta = p.a;
        car.lap = p.l;
        car.s = p.s;
        car.finished = p.f;
        car.lastAt = Date.now();
      });
    }

    this.setupTrack(trackIdx, obstacleSeed);

    if (this.room) {
      // En sala la carrera arranca sola: todos cargan casi a la vez y el
      // countdown de 3s los deja practicamente sincronizados.
      this.beginCountdown();
    } else {
      this.state = "ready";
      this.hud.showStart(this.track.def.name, this.track.def.laps, this.bestText());
      this.hud.setSelectedMap(this.selectedTrack);
      this.hud.showRankingReadonly("car-race", this.track.def.id);
    }
  }

  /** Arma circuito y obstaculos: indice de pista + seed del layout de hazards. */
  private setupTrack(trackIdx: number, obstacleSeed: number): void {
    this.selectedTrack = ((trackIdx % TRACK_DEFS.length) + TRACK_DEFS.length) % TRACK_DEFS.length;
    this.track = buildTrack(this.selectedTrack);
    this.obstacles = buildObstacles(this.track, hashStr(`obs:${obstacleSeed}`));
    this.best = Number(localStorage.getItem(this.bestKey())) || 0;
    this.hud.setTrackName(`${this.track.def.name} · ${this.track.def.laps} vueltas`);
    this.hud.setLap(1, this.track.def.laps);
    this.hud.setTime(formatRaceTime(0));
    this.placeAtGrid();
  }

  /**
   * Elegir un circuito desde el menu (solo modo solo). Reconstruye la pista con
   * un layout de obstaculos nuevo y refresca el overlay para previsualizarla.
   */
  private onSelectMap(idx: number): void {
    if (this.room || (this.state !== "ready" && this.state !== "finished")) return;
    this.setupTrack(idx, (Math.random() * 0xffffffff) >>> 0);
    this.hud.setStartInfo(this.track.def.name, this.track.def.laps, this.bestText());
    this.hud.setSelectedMap(this.selectedTrack);
    // El ranking sigue al circuito elegido. Si es el que acabo de correr, se
    // muestra con el puntaje logrado (formulario de nombre); si no, solo lectura.
    if (this.lastResult && this.lastResult.trackId === this.track.def.id) {
      this.hud.showRanking("car-race", this.lastResult.ms, this.track.def.id);
    } else {
      this.hud.showRankingReadonly("car-race", this.track.def.id);
    }
  }

  /** Clave de localStorage del mejor tiempo, por circuito. */
  private bestKey(): string {
    return `${BEST_KEY}:${this.track.def.id}`;
  }

  /** Grilla de largada + reseteo del estado de carrera y de la camara. */
  private placeAtGrid(): void {
    const start = this.track.pointAt(1 - 60 / this.track.total);
    const lane = ((hashStr(this.me) % 5) - 2) * (this.track.def.width / 6.5);
    const perp = start.angle + Math.PI / 2;
    this.car.reset(start.x + Math.cos(perp) * lane, start.y + Math.sin(perp) * lane, start.angle);
    this.prevS = this.track.progressAt(this.car.x, this.car.y).s;
    this.lap = 0;
    this.sectors = [false, false, false];
    this.skids.length = 0;
    this.insideBoost.clear();
    this.prevRear = null;
    this.renderer.snapCamera();
  }

  private onAction(): void {
    // En modo sala se corre una sola carrera por ronda: sin reintento.
    if (this.room) return;
    if (this.state === "ready" || this.state === "finished") {
      // Corre el circuito elegido en el menu (mismo que se previsualiza).
      this.placeAtGrid();
      this.hud.hideOverlay();
      this.beginCountdown();
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownLeft = COUNTDOWN_SEC;
    this.lastResult = null;
    this.hud.hideOverlay();
  }

  private go(): void {
    this.state = "racing";
    this.startTime = performance.now();
    this.hud.showCountdown("¡YA!", this.track.theme.accent);
    window.setTimeout(() => this.hud.hideCountdown(), 700);
  }

  private elapsedMs(): number {
    if (this.state === "racing") return performance.now() - this.startTime;
    if (this.state === "finished") return this.finalMs;
    return 0;
  }

  private bestText(): string {
    return this.best > 0 ? formatRaceTime(this.best) : "-";
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.keys.up = down;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.keys.down = down;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.keys.left = down;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.keys.right = down;
        break;
      case "Enter":
      case " ":
        if (down) this.onAction();
        return;
      default:
        return;
    }
    e.preventDefault();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = this.viewW * dpr;
    this.canvas.height = this.viewH * dpr;
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Loop ----------

  private tick(timestamp: number): void {
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > MAX_DT) dt = MAX_DT;
    this.lastTime = timestamp;

    this.update(dt);
    if (this.track) {
      this.renderer.draw(
        this.ctx,
        this.viewW,
        this.viewH,
        this.track,
        this.obstacles,
        this.skids,
        this.car,
        this.myColor,
        [...this.remotes.values()],
        dt,
      );
    }

    requestAnimationFrame((t) => this.tick(t));
  }

  private update(dt: number): void {
    if (this.state === "loading") return;

    this.updateRemotes(dt);

    if (this.state === "countdown") {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.go();
      } else {
        this.hud.showCountdown(String(Math.ceil(this.countdownLeft)), this.track.theme.accent);
      }
      return;
    }

    if (this.state !== "racing" && this.state !== "finished") return;

    if (this.state === "racing") {
      const input: CarInput = {
        up: this.keys.up || this.hud.touchInput.up,
        down: this.keys.down || this.hud.touchInput.down,
        left: this.keys.left || this.hud.touchInput.left,
        right: this.keys.right || this.hud.touchInput.right,
      };
      const { dist } = this.track.progressAt(this.car.x, this.car.y, this.prevS);
      this.car.update(dt, input, dist <= this.track.def.width / 2);
      this.applyWalls();
      this.handleCollisions(dt);
      this.recordSkids(dt);
      this.trackLapProgress();
      this.hud.setTime(formatRaceTime(this.elapsedMs()));
      this.hud.setLap(this.lap + 1, this.track.def.laps);
    } else {
      this.decaySkids(dt);
    }

    this.updatePosition();
    this.netSend(dt);
  }

  /** Vueltas con checkpoints: hay que pasar los 3 sectores antes de la meta. */
  private trackLapProgress(): void {
    const { s } = this.track.progressAt(this.car.x, this.car.y, this.prevS);

    if (s > 0.2 && s < 0.4) this.sectors[0] = true;
    if (this.sectors[0] && s > 0.45 && s < 0.65) this.sectors[1] = true;
    if (this.sectors[1] && s > 0.7 && s < 0.9) this.sectors[2] = true;

    // Cruce de meta hacia adelante (el progreso salta de ~1 a ~0).
    if (this.prevS > 0.9 && s < 0.1 && this.sectors.every(Boolean)) {
      this.lap++;
      this.sectors = [false, false, false];
      if (this.lap >= this.track.def.laps) this.finishRace();
    }
    this.prevS = s;
  }

  private finishRace(): void {
    this.finalMs = performance.now() - this.startTime;
    this.state = "finished";
    this.hud.setTime(formatRaceTime(this.finalMs));
    this.hud.setLap(this.track.def.laps, this.track.def.laps);

    // Aviso inmediato de llegada al resto de la sala.
    this.emitPos();

    const ms = Math.round(this.finalMs);
    if (this.room) {
      this.room.reportScore(ms);
      return;
    }

    const isRecord = this.best === 0 || ms < this.best;
    if (isRecord) {
      this.best = ms;
      localStorage.setItem(this.bestKey(), String(this.best));
    }
    this.hud.showGameOver(formatRaceTime(ms), this.bestText(), isRecord, true);
    // Ranking por circuito: cada pista tiene su propia tabla (variante).
    this.lastResult = { trackId: this.track.def.id, ms };
    this.hud.showRanking("car-race", ms, this.track.def.id);
  }

  // ---------- Obstaculos y derrape ----------

  /**
   * Paredes en el borde del asfalto: si el auto se pasa del ancho de la pista,
   * lo empuja de vuelta y anula la velocidad hacia afuera. Asi no se puede
   * cortar por el pasto ni meterse en el hueco entre dos tramos cercanos.
   */
  private applyWalls(): void {
    const prog = this.track.progressAt(this.car.x, this.car.y, this.prevS);
    const limit = this.track.def.width / 2 - WALL_MARGIN;
    if (prog.dist <= limit) return;
    const cp = this.track.pointAt(prog.s);
    let nx = this.car.x - cp.x;
    let ny = this.car.y - cp.y;
    const d = Math.hypot(nx, ny) || 1;
    nx /= d;
    ny /= d;
    this.car.x = cp.x + nx * limit;
    this.car.y = cp.y + ny * limit;
    // Pared: la normal (nx,ny) apunta HACIA AFUERA del asfalto. Hay que anular
    // la velocidad que empuja hacia afuera (vn > 0); si el auto ya va hacia
    // adentro (vn < 0) no se toca, para que pueda despegarse de la pared.
    // (Es la convencion opuesta a Car.bounce, pensada para obstaculos.)
    const vn = this.car.vx * nx + this.car.vy * ny;
    if (vn > 0) {
      const j = (1 + WALL_RESTITUTION) * vn;
      this.car.vx -= j * nx;
      this.car.vy -= j * ny;
    }
  }

  /** Colisiones del auto propio con boosts, barreras y conos. */
  private handleCollisions(dt: number): void {
    const car = this.car;

    // Boost pads: envion al entrar (flanco de subida), no cada frame.
    const boostR2 = (BOOST_RADIUS * 0.6) * (BOOST_RADIUS * 0.6);
    this.obstacles.boosts.forEach((b, i) => {
      const inside = (car.x - b.x) ** 2 + (car.y - b.y) ** 2 < boostR2;
      if (inside && !this.insideBoost.has(i)) {
        car.applyBoost();
        this.insideBoost.add(i);
      } else if (!inside && this.insideBoost.has(i)) {
        this.insideBoost.delete(i);
      }
    });

    // Barreras: capsula (segmento + grosor); empuje fuera + rebote.
    const minD = CAR_RADIUS + BARRIER_HALF_THICK;
    for (const b of this.obstacles.barriers) {
      const cos = Math.cos(b.angle);
      const sin = Math.sin(b.angle);
      let along = (car.x - b.x) * cos + (car.y - b.y) * sin;
      along = Math.max(-b.half, Math.min(b.half, along));
      const segX = b.x + cos * along;
      const segY = b.y + sin * along;
      let nx = car.x - segX;
      let ny = car.y - segY;
      let d = Math.hypot(nx, ny);
      if (d >= minD) continue;
      if (d < 0.001) {
        nx = -sin;
        ny = cos;
        d = 1;
      }
      nx /= d;
      ny /= d;
      car.x += nx * (minD - d);
      car.y += ny * (minD - d);
      car.bounce(nx, ny, BARRIER_RESTITUTION);
    }

    // Conos: frenada breve (con cooldown) y golpe visual.
    const coneR = CAR_RADIUS + CONE_RADIUS * 0.55;
    const now = performance.now();
    for (const c of this.obstacles.cones) {
      const dx = car.x - c.x;
      const dy = car.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < coneR * coneR && now - c.hitAt > CONE_HIT_COOLDOWN_MS) {
        car.slowDown(CONE_SLOW);
        c.hitAt = now;
        const d = Math.sqrt(d2) || 1;
        c.ox -= (dx / d) * 12;
        c.oy -= (dy / d) * 12;
      }
      // El cono golpeado vuelve lentamente a su lugar.
      c.ox *= Math.exp(-4 * dt);
      c.oy *= Math.exp(-4 * dt);
    }
  }

  /** Registra marcas de goma cuando el auto derrapa; siempre desvanece. */
  private recordSkids(dt: number): void {
    this.decaySkids(dt);
    const car = this.car;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const rearX = -CAR_LENGTH / 2 + 6;
    const toWorld = (px: number, py: number) => ({
      x: car.x + cos * px - sin * py,
      y: car.y + sin * px + cos * py,
    });
    const l = toWorld(rearX, -CAR_WIDTH / 2);
    const r = toWorld(rearX, CAR_WIDTH / 2);

    const drifting = car.slip > 45 && Math.abs(car.speed) > 60;
    if (drifting && this.prevRear) {
      this.skids.push({ x1: this.prevRear.lx, y1: this.prevRear.ly, x2: l.x, y2: l.y, alpha: 1 });
      this.skids.push({ x1: this.prevRear.rx, y1: this.prevRear.ry, x2: r.x, y2: r.y, alpha: 1 });
      if (this.skids.length > 600) this.skids.splice(0, this.skids.length - 600);
    }
    this.prevRear = drifting ? { lx: l.x, ly: l.y, rx: r.x, ry: r.y } : null;
  }

  private decaySkids(dt: number): void {
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].alpha -= dt * 0.25;
      if (this.skids[i].alpha <= 0) this.skids.splice(i, 1);
    }
  }

  // ---------- Red ----------

  private netSend(dt: number): void {
    if (!this.channel) return;
    this.sendAccMs += dt * 1000;
    // Terminado, baja la cadencia: solo mantiene vivo el auto en pantalla.
    const interval = this.state === "finished" ? NET_SEND_MS * 5 : NET_SEND_MS;
    if (this.sendAccMs < interval) return;
    this.sendAccMs = 0;
    this.emitPos();
  }

  private emitPos(): void {
    if (!this.channel) return;
    this.channel.send({
      p: this.me,
      x: Math.round(this.car.x),
      y: Math.round(this.car.y),
      a: Number(this.car.angle.toFixed(3)),
      l: this.lap,
      s: Number(this.prevS.toFixed(4)),
      f: this.state === "finished",
    });
  }

  /** Interpola los autos remotos hacia su ultimo snapshot y purga inactivos. */
  private updateRemotes(dt: number): void {
    const now = Date.now();
    const k = 1 - Math.exp(-dt * 10);
    for (const [player, car] of this.remotes) {
      if (now - car.lastAt > REMOTE_STALE_MS) {
        this.remotes.delete(player);
        continue;
      }
      car.x += (car.tx - car.x) * k;
      car.y += (car.ty - car.y) * k;
      // Angulo por el camino corto para que el giro no de la vuelta larga.
      let da = car.ta - car.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      car.angle += da * k;
    }
  }

  /** Posicion en carrera comparando progreso total (vueltas + fraccion). */
  private updatePosition(): void {
    if (this.remotes.size === 0) {
      this.hud.setPos(null);
      return;
    }
    const myTotal = this.state === "finished" ? this.track.def.laps : this.lap + this.prevS;
    let rank = 1;
    for (const car of this.remotes.values()) {
      const theirTotal = car.finished ? this.track.def.laps : car.lap + car.s;
      if (theirTotal > myTotal) rank++;
    }
    this.hud.setPos(`${rank}°/${this.remotes.size + 1}`);
  }
}
