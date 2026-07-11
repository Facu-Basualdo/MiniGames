import { CATEGORIES } from "./constants";
import type { BtCategoryId, BtCell, BtState, BtVote } from "./BastaTransport";

type Answers = Partial<Record<BtCategoryId, string>>;

/** Cruz de "tachar" dibujada (nada de emojis, regla del repo). */
const CROSS_SVG = `
  <svg class="bt__cross" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6 18 18M18 6 6 18"/>
  </svg>`;

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPE[c]);
}

const STATUS_LABEL: Record<string, string> = {
  unique: "unica",
  repeated: "repetida",
  rejected: "tachada",
  empty: "vacia",
};

/**
 * Hud de Basta (estetica "hoja de cuaderno", ver DESIGN.md). Tres vistas segun la
 * fase que manda el server:
 *  - filling / grace: la hoja rayada con las 7 categorias como inputs + boton BASTA.
 *  - voting: las respuestas de todos, con un boton para tachar las ajenas.
 *  - reveal: las mismas respuestas con su puntaje (100 / 50 / 0) y el subtotal.
 * Los estados de espera / resultados / tablero final los cubre el RoomOverlay por encima.
 */
export class Hud {
  private readonly stage: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private readonly letterEl: HTMLElement;
  private readonly clockBar: HTMLElement;
  private readonly rosterEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly panelEl: HTMLElement;
  private readonly bastaBtn: HTMLButtonElement;

  private fillChangeCb: () => void = () => {};
  private bastaCb: () => void = () => {};
  private voteCb: (target: string, category: BtCategoryId) => void = () => {};

  private me = "";
  /** Que hay montado en el panel ahora, para no reconstruir los inputs en cada snapshot. */
  private panelMode: "none" | "sheet" | "voting" | "reveal" = "none";
  private sheetLetterIndex = -1;
  private readonly inputs = new Map<BtCategoryId, HTMLInputElement>();

  private clockRaf = 0;
  private clockAnchor = 0;
  private clockMs = 0;
  private clockTotal = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "bt";
    wrap.innerHTML = `
      <div class="bt__stage" hidden>
        <div class="bt__topbar">
          <div class="bt__letter" aria-label="letra"></div>
          <div class="bt__clock"><div class="bt__clock-bar"></div></div>
          <div class="bt__roster"></div>
        </div>
        <div class="bt__banner" hidden></div>
        <div class="bt__panel"></div>
        <button class="bt__basta" type="button" disabled>BASTA</button>
      </div>
      <div class="bt__overlay" hidden></div>
      <div class="bt__countdown" hidden></div>
    `;
    root.appendChild(wrap);

    this.stage = wrap.querySelector(".bt__stage")!;
    this.overlay = wrap.querySelector(".bt__overlay")!;
    this.countdownEl = wrap.querySelector(".bt__countdown")!;
    this.letterEl = wrap.querySelector(".bt__letter")!;
    this.clockBar = wrap.querySelector(".bt__clock-bar")!;
    this.rosterEl = wrap.querySelector(".bt__roster")!;
    this.bannerEl = wrap.querySelector(".bt__banner")!;
    this.panelEl = wrap.querySelector(".bt__panel")!;
    this.bastaBtn = wrap.querySelector(".bt__basta")!;

    this.bastaBtn.addEventListener("click", () => {
      if (!this.bastaBtn.disabled) this.bastaCb();
    });
  }

  // ---------- Suscripciones ----------

  onFillChange(cb: () => void): void {
    this.fillChangeCb = cb;
  }
  onBasta(cb: () => void): void {
    this.bastaCb = cb;
  }
  onVote(cb: (target: string, category: BtCategoryId) => void): void {
    this.voteCb = cb;
  }

  // ---------- Mensajes / countdown ----------

  showMessage(title: string, bodyHtml: string, action?: { label: string; onClick: () => void }): void {
    this.stage.hidden = true;
    this.overlay.hidden = false;
    this.overlay.innerHTML = `
      <div class="bt__card">
        <h1 class="bt__card-title">${title}</h1>
        <div class="bt__card-body">${bodyHtml}</div>
        ${action ? `<button class="bt__card-btn" type="button">${action.label}</button>` : ""}
      </div>`;
    if (action) {
      this.overlay
        .querySelector<HTMLButtonElement>(".bt__card-btn")!
        .addEventListener("click", action.onClick);
    }
  }

  showCountdown(text: string | null): void {
    if (text === null) {
      this.countdownEl.hidden = true;
      return;
    }
    this.countdownEl.hidden = false;
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove("is-pop");
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add("is-pop");
  }

  showStage(): void {
    this.overlay.hidden = true;
    this.stage.hidden = false;
  }

  // ---------- Render por fase ----------

  render(s: BtState, me: string): void {
    this.me = me;
    this.letterEl.textContent = s.letter ?? "";
    this.renderRoster(s);
    this.updateClock(s);

    if (s.phase === "filling" || s.phase === "grace") {
      this.renderSheet(s);
    } else if (s.phase === "voting") {
      this.renderVoting(s);
    } else if (s.phase === "reveal") {
      this.renderReveal(s);
    }
  }

  private renderRoster(s: BtState): void {
    const total = s.totalLetters;
    const idx = Math.min(s.letterIndex + 1, total);
    const chips = s.players
      .map((p) => {
        const cls = ["bt__chip"];
        if (!p.connected) cls.push("is-off");
        if (p.nickname === this.me) cls.push("is-me");
        if (p.nickname === s.bastaBy) cls.push("is-basta");
        const prog =
          s.phase === "filling" || s.phase === "grace"
            ? `<span class="bt__chip-prog">${p.filledCount}/${CATEGORIES.length}</span>`
            : `<span class="bt__chip-prog">${p.total}</span>`;
        return `<div class="${cls.join(" ")}"><span class="bt__chip-name">${esc(p.nickname)}</span>${prog}</div>`;
      })
      .join("");
    this.rosterEl.innerHTML = `<div class="bt__round">Letra ${idx}/${total}</div>${chips}`;
  }

  // ---------- Vista: hoja (filling / grace) ----------

  private renderSheet(s: BtState): void {
    const fresh = this.panelMode !== "sheet" || this.sheetLetterIndex !== s.letterIndex;
    if (fresh) {
      this.buildSheet();
      this.panelMode = "sheet";
      this.sheetLetterIndex = s.letterIndex;
    }
    // Banner de gracia cuando alguien grito BASTA.
    if (s.phase === "grace" && s.bastaBy) {
      this.bannerEl.hidden = false;
      this.bannerEl.textContent =
        s.bastaBy === this.me ? "Gritaste BASTA. Cerrando..." : `${s.bastaBy} grito BASTA. Cerrando...`;
    } else {
      this.bannerEl.hidden = true;
    }
    this.bastaBtn.hidden = false;
    this.refreshBastaEnabled();
  }

  private buildSheet(): void {
    this.inputs.clear();
    this.panelEl.innerHTML = `
      <div class="bt__sheet">
        ${CATEGORIES.map(
          (c) => `
          <div class="bt__row">
            <label class="bt__cat" for="bt-${c.id}">${c.label}</label>
            <input class="bt__input" id="bt-${c.id}" data-cat="${c.id}" type="text"
                   autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="40" />
          </div>`,
        ).join("")}
      </div>`;
    for (const c of CATEGORIES) {
      const input = this.panelEl.querySelector<HTMLInputElement>(`#bt-${c.id}`)!;
      this.inputs.set(c.id, input);
      input.addEventListener("input", () => {
        this.refreshBastaEnabled();
        this.fillChangeCb();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (this.allFilled()) this.bastaCb();
        else this.focusNextEmpty(c.id);
      });
    }
    const first = this.inputs.get(CATEGORIES[0].id);
    first?.focus();
  }

  private focusNextEmpty(from: BtCategoryId): void {
    const order = CATEGORIES.map((c) => c.id);
    const start = order.indexOf(from);
    for (let k = 1; k <= order.length; k++) {
      const id = order[(start + k) % order.length];
      const input = this.inputs.get(id);
      if (input && input.value.trim() === "") {
        input.focus();
        return;
      }
    }
  }

  private allFilled(): boolean {
    return CATEGORIES.every((c) => (this.inputs.get(c.id)?.value.trim() ?? "") !== "");
  }

  private refreshBastaEnabled(): void {
    this.bastaBtn.disabled = !this.allFilled();
  }

  getAnswers(): Answers {
    const out: Answers = {};
    for (const c of CATEGORIES) out[c.id] = this.inputs.get(c.id)?.value ?? "";
    return out;
  }

  /** Rellena los inputs (recuperacion tras F5). Solo si la hoja esta montada. */
  setAnswers(answers: Answers): void {
    for (const c of CATEGORIES) {
      const input = this.inputs.get(c.id);
      if (input && !input.value) input.value = answers[c.id] ?? "";
    }
    this.refreshBastaEnabled();
  }

  // ---------- Vista: votacion ----------

  private renderVoting(s: BtState): void {
    this.panelMode = "voting";
    this.bannerEl.hidden = false;
    this.bannerEl.textContent = "Tacha las respuestas que no valgan";
    this.bastaBtn.hidden = true;

    const cells = s.cells ?? [];
    const votes = s.votes ?? [];
    const eligible = s.players.length - 1;
    this.panelEl.innerHTML = `<div class="bt__board">${CATEGORIES.map((c) =>
      this.categoryBlock(c.id, c.label, s, cells, votes, eligible),
    ).join("")}</div>`;

    for (const btn of this.panelEl.querySelectorAll<HTMLButtonElement>(".bt__tacha")) {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target!;
        const category = btn.dataset.cat as BtCategoryId;
        this.voteCb(target, category);
      });
    }
  }

  private categoryBlock(
    cat: BtCategoryId,
    label: string,
    s: BtState,
    cells: BtCell[],
    votes: BtVote[],
    eligible: number,
  ): string {
    const rows = s.players
      .map((p) => {
        const cell = cells.find((c) => c.player === p.nickname && c.category === cat);
        const text = cell?.text ?? "";
        const rejects = votes.filter((v) => v.target === p.nickname && v.category === cat).length;
        const mine = votes.some(
          (v) => v.voter === this.me && v.target === p.nickname && v.category === cat,
        );
        const doomed = eligible > 0 && rejects * 2 > eligible;
        const empty = text.trim() === "";
        const cls = ["bt__ans"];
        if (empty) cls.push("is-empty");
        if (doomed) cls.push("is-doomed");
        const canVote = !empty && p.nickname !== this.me;
        const btn = canVote
          ? `<button class="bt__tacha${mine ? " is-on" : ""}" type="button" data-target="${esc(
              p.nickname,
            )}" data-cat="${cat}" title="Tachar">${CROSS_SVG}${rejects > 0 ? `<span class="bt__rejects">${rejects}</span>` : ""}</button>`
          : "";
        return `
          <div class="${cls.join(" ")}">
            <span class="bt__ans-who">${esc(p.nickname)}</span>
            <span class="bt__ans-text">${empty ? "&mdash;" : esc(text)}</span>
            ${btn}
          </div>`;
      })
      .join("");
    return `<section class="bt__cat-block"><h3 class="bt__cat-title">${label}</h3>${rows}</section>`;
  }

  // ---------- Vista: reveal ----------

  private renderReveal(s: BtState): void {
    this.panelMode = "reveal";
    this.bastaBtn.hidden = true;
    const scores = s.letterScores ?? [];
    const mine = scores.find((x) => x.player === this.me);
    this.bannerEl.hidden = false;
    this.bannerEl.textContent = mine ? `Sumaste ${mine.points} esta letra` : "Puntaje de la letra";

    const cells = s.cells ?? [];
    this.panelEl.innerHTML = `<div class="bt__board">${CATEGORIES.map((c) => {
      const rows = s.players
        .map((p) => {
          const cell = cells.find((x) => x.player === p.nickname && x.category === c.id);
          const status = cell?.status ?? "empty";
          const points = cell?.points ?? 0;
          const text = cell?.text ?? "";
          const empty = text.trim() === "";
          return `
            <div class="bt__ans is-${status}">
              <span class="bt__ans-who">${esc(p.nickname)}</span>
              <span class="bt__ans-text">${empty ? "&mdash;" : esc(text)}</span>
              <span class="bt__ans-pts" title="${STATUS_LABEL[status] ?? ""}">${points}</span>
            </div>`;
        })
        .join("");
      return `<section class="bt__cat-block"><h3 class="bt__cat-title">${c.label}</h3>${rows}</section>`;
    }).join("")}</div>`;
  }

  // ---------- Reloj (barra que se consume) ----------

  private updateClock(s: BtState): void {
    if (s.clockMs == null || s.clockTotalMs == null || s.clockTotalMs <= 0) {
      this.clearClock();
      return;
    }
    this.clockAnchor = performance.now();
    this.clockMs = s.clockMs;
    this.clockTotal = s.clockTotalMs;
    if (this.clockRaf === 0) this.clockRaf = requestAnimationFrame(() => this.tickClock());
  }

  private tickClock(): void {
    this.clockRaf = 0;
    const elapsed = performance.now() - this.clockAnchor;
    const remaining = Math.max(0, this.clockMs - elapsed);
    const frac = this.clockTotal > 0 ? remaining / this.clockTotal : 0;
    this.clockBar.style.transform = `scaleX(${frac})`;
    this.clockBar.classList.toggle("is-low", frac < 0.25);
    if (remaining > 0) this.clockRaf = requestAnimationFrame(() => this.tickClock());
  }

  private clearClock(): void {
    if (this.clockRaf !== 0) cancelAnimationFrame(this.clockRaf);
    this.clockRaf = 0;
    this.clockBar.style.transform = "scaleX(0)";
    this.clockBar.classList.remove("is-low");
  }
}
