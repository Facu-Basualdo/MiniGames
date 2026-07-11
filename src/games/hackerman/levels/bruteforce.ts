import { SoundEffects } from "../game/SoundEffects";
import { type HackLevel, type LevelContext } from "./types";

/**
 * Nivel 3 — BruteForce (inspirado en el minijuego de reels de letras de GTA).
 *
 * Arriba, la CLAVE de acceso (una palabra). Abajo, un reel vertical por letra:
 * cada reel gira por el alfabeto y una banda central marca la letra elegida.
 * Hay que alinear la banda de cada reel con la letra correspondiente de la clave;
 * al coincidir, el reel queda fijado (verde) solo. Todos fijados = nivel resuelto.
 * La clave se muestra completa, asi que es una carrera de destreza contra reloj.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VISIBLE = 2; // letras visibles arriba y abajo del centro
const WORDS = [
  "ACCESO",
  "SISTEMA",
  "KERNEL",
  "VECTOR",
  "SOCKET",
  "ROUTER",
  "CIFRADO",
  "MATRIZ",
  "PROXY",
  "BINARIO",
  "FIREWALL",
  "PAQUETE",
];

interface Reel {
  el: HTMLDivElement;
  window: HTMLDivElement;
  target: number; // indice de la letra objetivo en ALPHABET
  current: number; // indice actual en el centro
  locked: boolean;
}

export class BruteForceLevel implements HackLevel {
  readonly id = "bruteforce";
  readonly title = "BRUTEFORCE";
  readonly controls = "Izq/Der elige columna, Arriba/Abajo gira las letras. Alinea cada columna con la clave.";

  private keyEl!: HTMLDivElement;
  private reelsEl!: HTMLDivElement;
  private reels: Reel[] = [];
  private word = "";
  private active = 0;
  private readonly ctx: LevelContext;

  constructor(ctx: LevelContext) {
    this.ctx = ctx;
  }

  mount(host: HTMLElement): void {
    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "bf";

    const banner = document.createElement("div");
    banner.className = "bf__banner";
    banner.textContent = "BRUTEFORCE — CLAVE DE ACCESO";

    this.keyEl = document.createElement("div");
    this.keyEl.className = "bf__key";

    this.reelsEl = document.createElement("div");
    this.reelsEl.className = "bf__reels";

    wrap.append(banner, this.keyEl, this.reelsEl);
    host.appendChild(wrap);
  }

  begin(): void {
    this.word = WORDS[Math.floor(Math.random() * WORDS.length)];
    this.active = 0;
    this.reels = [];
    this.reelsEl.innerHTML = "";
    this.keyEl.innerHTML = "";

    for (let i = 0; i < this.word.length; i++) {
      const target = ALPHABET.indexOf(this.word[i]);
      // Arrancar en una letra distinta al objetivo para que siempre haya que girar.
      let current = Math.floor(Math.random() * ALPHABET.length);
      if (current === target) current = (current + 1 + Math.floor(Math.random() * 24)) % 26;

      const el = document.createElement("div");
      el.className = "bf__reel";
      const up = document.createElement("div");
      up.className = "bf__zone bf__zone--up";
      const win = document.createElement("div");
      win.className = "bf__window";
      const down = document.createElement("div");
      down.className = "bf__zone bf__zone--down";
      el.append(up, win, down);
      this.reelsEl.appendChild(el);

      const letter = document.createElement("span");
      letter.className = "bf__key-letter";
      this.keyEl.appendChild(letter);

      const idx = i;
      up.addEventListener("click", () => {
        this.active = idx;
        this.scroll(-1);
      });
      down.addEventListener("click", () => {
        this.active = idx;
        this.scroll(1);
      });

      this.reels.push({ el, window: win, target, current, locked: false });
    }

    this.reels.forEach((_, i) => this.renderReel(i));
    this.renderKey();
    this.updateStatus();
  }

  private renderReel(i: number): void {
    const reel = this.reels[i];
    reel.el.classList.toggle("is-active", i === this.active && !reel.locked);
    reel.el.classList.toggle("is-locked", reel.locked);

    reel.window.innerHTML = "";
    for (let d = -VISIBLE; d <= VISIBLE; d++) {
      const li = (reel.current + d + ALPHABET.length) % ALPHABET.length;
      const span = document.createElement("span");
      span.className = "bf__letter";
      if (d === 0) span.classList.add("bf__letter--center");
      else span.classList.add(`bf__letter--off${Math.abs(d)}`);
      span.textContent = ALPHABET[li];
      reel.window.appendChild(span);
    }
  }

  private renderKey(): void {
    const spans = this.keyEl.querySelectorAll<HTMLSpanElement>(".bf__key-letter");
    this.reels.forEach((reel, i) => {
      spans[i].textContent = this.word[i];
      spans[i].classList.toggle("is-locked", reel.locked);
    });
  }

  private setActive(i: number): void {
    if (this.reels[i]?.locked) {
      // Saltar a la primera columna sin fijar hacia la derecha.
      let j = i;
      for (let n = 0; n < this.reels.length; n++) {
        if (!this.reels[j].locked) break;
        j = (j + 1) % this.reels.length;
      }
      i = j;
    }
    const prev = this.active;
    this.active = i;
    if (prev !== i) this.renderReel(prev);
    this.renderReel(i);
  }

  private moveActive(dir: number): void {
    if (this.reels.every((r) => r.locked)) return;
    let i = this.active;
    for (let n = 0; n < this.reels.length; n++) {
      i = (i + dir + this.reels.length) % this.reels.length;
      if (!this.reels[i].locked) break;
    }
    this.setActive(i);
    SoundEffects.playMove();
  }

  private scroll(dir: number): void {
    const reel = this.reels[this.active];
    if (!reel || reel.locked) return;
    reel.current = (reel.current + dir + ALPHABET.length) % ALPHABET.length;
    this.renderReel(this.active);

    if (reel.current === reel.target) {
      reel.locked = true;
      this.renderReel(this.active);
      this.renderKey();
      SoundEffects.playLock();
      this.ctx.onProgress();
      this.updateStatus();
      if (this.reels.every((r) => r.locked)) {
        this.ctx.onSolved();
        return;
      }
      this.moveActive(1);
    } else {
      SoundEffects.playCycle();
    }
  }

  private updateStatus(): void {
    const done = this.reels.filter((r) => r.locked).length;
    this.ctx.setStatus(`CLAVE ${done}/${this.reels.length}`);
  }

  handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        this.moveActive(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.moveActive(1);
        break;
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        this.scroll(-1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        this.scroll(1);
        break;
    }
  }

  destroy(): void {
    // Sin timers ni listeners globales.
  }
}
