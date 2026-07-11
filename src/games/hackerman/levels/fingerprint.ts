import { SoundEffects } from "../game/SoundEffects";
import { type HackLevel, type LevelContext, mulberry32 } from "./types";

/**
 * Nivel 1 — Clon de huella (inspirado en el "fingerprint clone" de GTA Online).
 *
 * A la derecha esta la huella OBJETIVO. A la izquierda una columna de
 * COMPONENTES: la huella partida en `SLOTS` franjas horizontales. Cada franja
 * arranca mostrando un candidato al azar; el jugador cicla los candidatos
 * (izq/der) y confirma (Enter) el que coincide con esa franja del objetivo.
 * Acierto -> la franja queda fijada (verde) y se pasa a la siguiente; error ->
 * flash rojo y bloqueo breve. Todas las franjas fijadas = nivel resuelto.
 *
 * Cada candidato es la misma franja pero de una huella distinta, asi que hay que
 * comparar de verdad contra el objetivo (no alcanza con ciclar a lo bruto: cada
 * intento fallido cuesta tiempo, que es justo el score del juego).
 */

const GRID_W = 44;
const GRID_H = 66;
const SLOTS = 6;
const STRIP_ROWS = GRID_H / SLOTS; // 11
const CANDIDATES = 4; // 1 correcto + 3 senuelos
const CELL = 3; // px por celda en el render
const WRONG_LOCK_MS = 750;
const COLOR = "#33ff88";

type Fingerprint = Uint8Array; // GRID_W * GRID_H, 1 = cresta

function makeFingerprint(seed: number): Fingerprint {
  const r = mulberry32(seed);
  const cx = GRID_W * (0.34 + 0.32 * r());
  const cy = GRID_H * (0.34 + 0.32 * r());
  const freq = 0.55 + r() * 0.4;
  const arms = 1 + Math.floor(r() * 3);
  const phase = r() * Math.PI * 2;
  const skew = (r() - 0.5) * 0.04;
  const wobble = 0.8 + r() * 1.2;

  const out = new Uint8Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rad = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const v =
        Math.sin(rad * freq + ang * arms + phase + Math.sin(x * 0.25 + y * skew) * wobble);
      out[y * GRID_W + x] = v > 0 ? 1 : 0;
    }
  }
  return out;
}

function drawBand(
  canvas: HTMLCanvasElement,
  fp: Fingerprint,
  slot: number,
  dim: boolean
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = dim ? "rgba(51,255,136,0.35)" : COLOR;
  const r0 = slot * STRIP_ROWS;
  for (let y = 0; y < STRIP_ROWS; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (fp[(r0 + y) * GRID_W + x]) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

interface Slot {
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  candidates: Fingerprint[];
  correct: number; // indice del candidato correcto
  current: number; // candidato mostrado
  locked: boolean;
}

export class FingerprintLevel implements HackLevel {
  readonly id = "fingerprint";
  readonly title = "CLON DE HUELLA";
  readonly controls = "Flechas para elegir franja y ciclar candidatos. Enter fija la que coincide con el objetivo.";

  private targetCanvas!: HTMLCanvasElement;
  private slots: Slot[] = [];
  private active = 0;
  private target!: Fingerprint;
  private busy = false;
  private wrongTimer: number | null = null;
  private readonly ctx: LevelContext;

  constructor(ctx: LevelContext) {
    this.ctx = ctx;
  }

  mount(host: HTMLElement): void {
    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "fp";

    const left = document.createElement("div");
    left.className = "fp__col fp__components";
    const leftHead = document.createElement("div");
    leftHead.className = "fp__head";
    leftHead.textContent = "COMPONENTES";
    left.appendChild(leftHead);

    const slotList = document.createElement("div");
    slotList.className = "fp__slots";
    left.appendChild(slotList);

    const right = document.createElement("div");
    right.className = "fp__col fp__target";
    const rightHead = document.createElement("div");
    rightHead.className = "fp__head";
    rightHead.textContent = "OBJETIVO";
    this.targetCanvas = document.createElement("canvas");
    this.targetCanvas.width = GRID_W * CELL;
    this.targetCanvas.height = GRID_H * CELL;
    this.targetCanvas.className = "fp__target-canvas";
    right.append(rightHead, this.targetCanvas);

    wrap.append(left, right);
    host.appendChild(wrap);

    this.slotList = slotList;
  }

  private slotList!: HTMLDivElement;

  begin(): void {
    this.clearWrongTimer();
    this.busy = false;
    this.active = 0;
    this.slots = [];
    this.slotList.innerHTML = "";

    const baseSeed = (Math.random() * 1e9) >>> 0;
    this.target = makeFingerprint(baseSeed);
    // Huellas senuelo: una por candidato-extra, compartidas por todas las franjas.
    const decoys: Fingerprint[] = [];
    for (let i = 0; i < CANDIDATES - 1; i++) decoys.push(makeFingerprint(baseSeed + 101 + i * 977));

    for (let s = 0; s < SLOTS; s++) {
      const pool = [this.target, ...decoys];
      // Barajar y recordar donde quedo el correcto (el objetivo).
      const order = pool.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const candidates = order.map((i) => pool[i]);
      const correct = order.indexOf(0);

      const el = document.createElement("div");
      el.className = "fp__slot";
      const prev = document.createElement("button");
      prev.className = "fp__arrow";
      prev.textContent = "<";
      const canvas = document.createElement("canvas");
      canvas.width = GRID_W * CELL;
      canvas.height = STRIP_ROWS * CELL;
      canvas.className = "fp__slot-canvas";
      const next = document.createElement("button");
      next.className = "fp__arrow";
      next.textContent = ">";
      el.append(prev, canvas, next);
      this.slotList.appendChild(el);

      const slot: Slot = {
        el,
        canvas,
        candidates,
        correct,
        current: Math.floor(Math.random() * CANDIDATES),
        locked: false,
      };
      this.slots.push(slot);

      const idx = s;
      prev.addEventListener("click", () => {
        this.setActive(idx);
        this.cycle(-1);
      });
      next.addEventListener("click", () => {
        this.setActive(idx);
        this.cycle(1);
      });
      // Click sobre la franja = confirmar el candidato mostrado (ideal para touch).
      canvas.addEventListener("click", () => {
        this.setActive(idx);
        this.confirm();
      });
    }

    drawBand(this.targetCanvas, this.target, 0, false);
    // El objetivo es la huella entera: se dibuja las 6 franjas seguidas.
    const tctx = this.targetCanvas.getContext("2d");
    if (tctx) {
      tctx.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
      tctx.fillStyle = COLOR;
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          if (this.target[y * GRID_W + x]) tctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    this.slots.forEach((_, i) => this.renderSlot(i));
    this.setActive(0);
    this.updateStatus();
  }

  private renderSlot(i: number): void {
    const slot = this.slots[i];
    drawBand(slot.canvas, slot.candidates[slot.current], i, !slot.locked);
    slot.el.classList.toggle("is-locked", slot.locked);
    slot.el.classList.toggle("is-active", i === this.active && !slot.locked);
  }

  private setActive(i: number): void {
    if (this.slots[i]?.locked) return;
    const prev = this.active;
    this.active = i;
    if (prev !== i) this.renderSlot(prev);
    this.renderSlot(i);
  }

  /** Mueve el foco a la siguiente franja sin fijar (dir +1 / -1), salteando fijadas. */
  private moveActive(dir: number): void {
    if (this.slots.every((s) => s.locked)) return;
    let i = this.active;
    for (let n = 0; n < SLOTS; n++) {
      i = (i + dir + SLOTS) % SLOTS;
      if (!this.slots[i].locked) break;
    }
    this.setActive(i);
    SoundEffects.playMove();
  }

  private cycle(dir: number): void {
    if (this.busy) return;
    const slot = this.slots[this.active];
    if (!slot || slot.locked) return;
    slot.current = (slot.current + dir + CANDIDATES) % CANDIDATES;
    this.renderSlot(this.active);
    SoundEffects.playCycle();
  }

  private confirm(): void {
    if (this.busy) return;
    const slot = this.slots[this.active];
    if (!slot || slot.locked) return;

    if (slot.current === slot.correct) {
      slot.locked = true;
      this.renderSlot(this.active);
      SoundEffects.playLock();
      this.ctx.onProgress();
      this.updateStatus();
      if (this.slots.every((s) => s.locked)) {
        this.ctx.onSolved();
        return;
      }
      // Enfocar la siguiente franja sin fijar.
      let i = this.active;
      for (let n = 0; n < SLOTS; n++) {
        i = (i + 1) % SLOTS;
        if (!this.slots[i].locked) break;
      }
      this.setActive(i);
    } else {
      // Error: flash rojo y bloqueo breve (el tiempo corre, asi que cuesta).
      SoundEffects.playError();
      this.busy = true;
      slot.el.classList.add("is-wrong");
      this.wrongTimer = window.setTimeout(() => {
        slot.el.classList.remove("is-wrong");
        this.busy = false;
        this.wrongTimer = null;
      }, WRONG_LOCK_MS);
    }
  }

  private updateStatus(): void {
    const done = this.slots.filter((s) => s.locked).length;
    this.ctx.setStatus(`COMPONENTES ${done}/${SLOTS}`);
  }

  handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.moveActive(-1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.moveActive(1);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.cycle(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.cycle(1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        this.confirm();
        break;
    }
  }

  private clearWrongTimer(): void {
    if (this.wrongTimer !== null) {
      clearTimeout(this.wrongTimer);
      this.wrongTimer = null;
    }
  }

  destroy(): void {
    this.clearWrongTimer();
  }
}
