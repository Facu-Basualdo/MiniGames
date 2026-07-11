import { SoundEffects } from "../game/SoundEffects";
import { type HackLevel, type LevelContext } from "./types";

/**
 * Nivel 2 — Decodificador (inspirado en el "Connecting to the host" de GTA).
 *
 * Arriba hay un CODIGO de `CODE_LEN` numeros de dos digitos (estilo IP:
 * "48.93.63.06"). Abajo, una grilla de numeros. En algun lado de la grilla ese
 * codigo aparece como una corrida horizontal contigua; hay que encontrarla y
 * confirmarla. El cursor arrastra una "ventana" de `CODE_LEN` celdas: cuando
 * coincide con el codigo, Enter la valida. Errar da flash rojo. Se descifran
 * `CODES` codigos (grilla nueva cada vez) para completar el nivel.
 */

const ROWS = 8;
const COLS = 10;
const CODE_LEN = 4;
const CODES = 1;

function two(n: number): string {
  return n.toString().padStart(2, "0");
}

export class DecoderLevel implements HackLevel {
  readonly id = "decoder";
  readonly title = "DECODIFICADOR";
  readonly controls = "Flechas para mover el cursor. Enter valida la corrida que coincide con el codigo de arriba.";

  private codeEl!: HTMLDivElement;
  private gridEl!: HTMLDivElement;
  private cells: HTMLDivElement[] = [];

  private grid: string[][] = [];
  private code: string[] = [];
  private cursorRow = 0;
  private cursorCol = 0;
  private solved = 0;
  private busy = false;
  private wrongTimer: number | null = null;
  private readonly ctx: LevelContext;

  constructor(ctx: LevelContext) {
    this.ctx = ctx;
  }

  mount(host: HTMLElement): void {
    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "dec";

    const banner = document.createElement("div");
    banner.className = "dec__banner";
    banner.textContent = "CONECTANDO AL HOST — SECUENCIA REQUERIDA";

    this.codeEl = document.createElement("div");
    this.codeEl.className = "dec__code";

    this.gridEl = document.createElement("div");
    this.gridEl.className = "dec__grid";
    this.gridEl.style.setProperty("--cols", String(COLS));

    wrap.append(banner, this.codeEl, this.gridEl);
    host.appendChild(wrap);
  }

  begin(): void {
    this.clearWrongTimer();
    this.solved = 0;
    this.busy = false;
    this.newCode();
  }

  private newCode(): void {
    // Grilla random.
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) row.push(two(Math.floor(Math.random() * 100)));
      this.grid.push(row);
    }

    // Codigo objetivo, plantado como corrida horizontal en una fila/columna al azar.
    this.code = [];
    for (let i = 0; i < CODE_LEN; i++) this.code.push(two(Math.floor(Math.random() * 100)));
    const plantRow = Math.floor(Math.random() * ROWS);
    const plantCol = Math.floor(Math.random() * (COLS - CODE_LEN + 1));
    for (let i = 0; i < CODE_LEN; i++) this.grid[plantRow][plantCol + i] = this.code[i];

    this.cursorRow = 0;
    this.cursorCol = 0;
    this.renderCode();
    this.buildGrid();
    this.renderCursor();
    this.updateStatus();
  }

  private renderCode(): void {
    this.codeEl.innerHTML = "";
    this.code.forEach((n, i) => {
      if (i > 0) {
        const dot = document.createElement("span");
        dot.className = "dec__dot";
        dot.textContent = ".";
        this.codeEl.appendChild(dot);
      }
      const span = document.createElement("span");
      span.className = "dec__code-num";
      span.textContent = n;
      this.codeEl.appendChild(span);
    });
  }

  private buildGrid(): void {
    this.gridEl.innerHTML = "";
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "dec__cell";
        cell.textContent = this.grid[r][c];
        const rr = r;
        const cc = c;
        // Click = poner el arranque de la ventana ahi y validar (bueno para touch).
        cell.addEventListener("click", () => {
          this.cursorRow = rr;
          this.cursorCol = Math.min(cc, COLS - CODE_LEN);
          this.renderCursor();
          this.confirm();
        });
        this.cells.push(cell);
        this.gridEl.appendChild(cell);
      }
    }
  }

  private renderCursor(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r * COLS + c];
        const inWindow = r === this.cursorRow && c >= this.cursorCol && c < this.cursorCol + CODE_LEN;
        cell.classList.toggle("is-window", inWindow);
        cell.classList.toggle("is-cursor", r === this.cursorRow && c === this.cursorCol);
      }
    }
  }

  private moveCursor(dr: number, dc: number): void {
    this.cursorRow = Math.min(ROWS - 1, Math.max(0, this.cursorRow + dr));
    // La ventana entra completa: el arranque no pasa de COLS - CODE_LEN.
    this.cursorCol = Math.min(COLS - CODE_LEN, Math.max(0, this.cursorCol + dc));
    this.renderCursor();
    SoundEffects.playMove();
  }

  private confirm(): void {
    if (this.busy) return;
    let match = true;
    for (let i = 0; i < CODE_LEN; i++) {
      if (this.grid[this.cursorRow][this.cursorCol + i] !== this.code[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      SoundEffects.playLock();
      // Marcar la corrida acertada.
      for (let i = 0; i < CODE_LEN; i++) {
        this.cells[this.cursorRow * COLS + this.cursorCol + i].classList.add("is-hit");
      }
      this.solved++;
      this.ctx.onProgress();
      this.updateStatus();
      if (this.solved >= CODES) {
        this.ctx.onSolved();
        return;
      }
      this.busy = true;
      this.wrongTimer = window.setTimeout(() => {
        this.busy = false;
        this.wrongTimer = null;
        this.newCode();
      }, 400);
    } else {
      SoundEffects.playError();
      this.busy = true;
      for (let i = 0; i < CODE_LEN; i++) {
        this.cells[this.cursorRow * COLS + this.cursorCol + i].classList.add("is-miss");
      }
      this.wrongTimer = window.setTimeout(() => {
        for (let i = 0; i < CODE_LEN; i++) {
          this.cells[this.cursorRow * COLS + this.cursorCol + i]?.classList.remove("is-miss");
        }
        this.busy = false;
        this.wrongTimer = null;
      }, 500);
    }
  }

  private updateStatus(): void {
    this.ctx.setStatus(
      CODES > 1 ? `CODIGO ${Math.min(this.solved + 1, CODES)}/${CODES}` : "SECUENCIA REQUERIDA"
    );
  }

  handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.moveCursor(-1, 0);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.moveCursor(1, 0);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.moveCursor(0, -1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.moveCursor(0, 1);
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
