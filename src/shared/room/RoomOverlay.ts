/**
 * Overlay DOM autocontenido del modo sala (patron LeaderboardPanel: inyecta su
 * propio CSS una sola vez y no depende del estilo de cada juego). Es fixed
 * full-screen con z-index por encima del overlay de cada juego, asi tapa el
 * "presiona ENTER para reintentar" sin tocar ningun Hud.
 *
 * Vistas: esperando (checklist de jugadores + countdown), resultados de ronda,
 * votacion del proximo juego, tablero final y error. Ademas un strip superior
 * permanente con codigo / ronda / tiempo mientras se juega.
 */

const STYLE_ID = "mg-room-styles";

/*
 * Paleta y tipografia de la landing (self-contained: se inyecta dentro de cada
 * juego, que no define las variables :root de /rooms, asi que van hardcodeadas):
 * tinta #111, card #efeee6, fondo crema #d6d3bd, acento cian #00f0ff, apagado
 * #6f6d5e. Estilo "flat" con bordes gruesos y pills, igual que el menu.
 */
const CSS = `
.mg-room-strip {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  z-index: 9999; padding: 7px 18px; border-radius: 0 0 14px 14px;
  background: #efeee6; color: #111; border: 2.5px solid #111; border-top: none;
  font-family: "Archivo", "Helvetica Neue", Arial, sans-serif; font-size: 12.5px;
  font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase;
  font-variant-numeric: tabular-nums; box-shadow: 0 5px 0 -2px rgba(17, 17, 17, 0.18);
  pointer-events: none; white-space: nowrap;
}
.mg-room {
  position: fixed; inset: 0; z-index: 10000; display: flex;
  align-items: center; justify-content: center; padding: 16px;
  background: rgba(17, 17, 17, 0.55); backdrop-filter: blur(5px);
  color: #111; font-family: "Archivo", "Helvetica Neue", Arial, sans-serif;
}
.mg-room__box {
  width: 100%; max-width: 440px; text-align: center;
  background: #efeee6; border: 2.5px solid #111; border-radius: 22px;
  padding: 28px 24px; box-shadow: 0 14px 0 -4px rgba(17, 17, 17, 0.35);
  max-height: 90vh; overflow-y: auto;
  /* Capa propia: al refrescar el contador el blur del fondo no re-centra la
     caja (evita el temblor vertical de subpixel del backdrop-filter). */
  transform: translateZ(0); backface-visibility: hidden;
}
.mg-room__kicker { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #0091a6; margin-bottom: 8px; }
.mg-room__title { font-size: clamp(28px, 7vw, 40px); font-weight: 900; letter-spacing: -1.2px; line-height: 1; margin: 0 0 10px; }
.mg-room__subtitle { font-size: 14px; font-weight: 500; color: #6f6d5e; margin: 0 0 18px; }
/* line-height/min-height fijos + digitos tabulares: el alto y ancho de la linea
   del contador no cambian al pasar de un numero a otro, asi el modal no se mueve. */
.mg-room__time { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.3; min-height: 1.3em; margin-bottom: 16px; }
.mg-room__list { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mg-room__row {
  display: grid; grid-template-columns: 2rem 1fr auto; align-items: center;
  gap: 10px; padding: 12px 14px; border-radius: 12px;
  border: 2px solid rgba(17, 17, 17, 0.14); background: #ffffff;
  font-size: 15px; font-weight: 600; text-align: left;
}
.mg-room__row--me { border-color: #111; box-shadow: 0 0 0 2.5px #111; font-weight: 800; }
.mg-room__rank { color: #6f6d5e; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
.mg-room__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-room__value { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 800; }
.mg-room__value small { color: #6f6d5e; font-weight: 600; font-size: 0.78em; margin-left: 8px; }
.mg-room__state { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #6f6d5e; }
.mg-room__state--done { color: #0a9d54; }
.mg-room__state--offline { opacity: 0.45; }
.mg-room__section { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6f6d5e; margin: 18px 0 10px; }
.mg-room__votes { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.mg-room__vote {
  --accent: #00f0ff;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px; border-radius: 14px; cursor: pointer;
  border: 2px solid rgba(17, 17, 17, 0.2); background: #ffffff;
  color: #111; font: inherit; font-size: 15px; font-weight: 700; text-align: left;
  transition: border-color 0.15s ease, transform 0.14s ease, box-shadow 0.15s ease;
}
.mg-room__vote:hover { border-color: #111; transform: translateY(-2px); box-shadow: 0 6px 0 -3px #111; }
.mg-room__vote--mine { border-color: #111; box-shadow: 0 0 0 2.5px #111; }
.mg-room__vote-count { font-size: 12px; font-weight: 700; color: #6f6d5e; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mg-room__actions { display: flex; gap: 10px; margin-top: 6px; }
.mg-room__actions .mg-room__btn { flex: 1; }
.mg-room__btn {
  display: inline-block; padding: 14px 22px; border-radius: 999px;
  border: 2px solid #111; background: none; color: #111; font: inherit; font-size: 14px;
  font-weight: 800; letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
  text-decoration: none; text-align: center;
  transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
}
.mg-room__btn:hover { background: #111; color: #efeee6; }
.mg-room__btn:active { transform: translateY(1px); }
.mg-room__btn--primary { background: #111; color: #efeee6; }
.mg-room__btn--primary:hover { background: #00f0ff; color: #111; }
.mg-room__hint { font-size: 12px; font-weight: 500; color: #6f6d5e; margin-top: 14px; line-height: 1.5; }
.mg-room__winner {
  display: inline-block; margin-bottom: 18px; padding: 9px 20px; border-radius: 999px;
  background: #111; color: #efeee6; font-size: 15px; font-weight: 800; letter-spacing: 0.3px;
}
.mg-room__takeover {
  display: block; margin: 14px auto 0; padding: 10px 18px; border-radius: 999px;
  border: 2px solid #c81d4a; background: transparent; color: #c81d4a;
  font: inherit; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;
  text-transform: uppercase; cursor: pointer;
}
.mg-room__takeover:hover { background: #c81d4a; color: #efeee6; }
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

export interface WaitingEntry {
  player: string;
  state: "done" | "playing" | "offline";
}

export interface ResultEntry {
  rank: number;
  player: string;
  /** Puntaje ya formateado ("12", "213 ms", "sin jugar"). */
  scoreText: string;
  points: number;
}

export interface TotalEntry {
  rank: number;
  player: string;
  points: number;
}

export interface VoteOption {
  id: string;
  title: string;
  accent?: string;
}

const STATE_LABELS: Record<WaitingEntry["state"], string> = {
  done: "listo",
  playing: "jugando",
  offline: "desconectado",
};

export class RoomOverlay {
  private readonly root: HTMLDivElement;
  private readonly boxEl: HTMLDivElement;
  private readonly stripEl: HTMLDivElement;
  private timeEl: HTMLDivElement | null = null;
  private takeoverEl: HTMLButtonElement | null = null;

  constructor() {
    ensureStyles();

    this.stripEl = document.createElement("div");
    this.stripEl.className = "mg-room-strip";
    this.stripEl.style.display = "none";

    this.root = document.createElement("div");
    this.root.className = "mg-room";
    this.root.style.display = "none";
    // Que ningun toque/clic dentro del overlay llegue a los listeners de
    // "toca para reiniciar" que los juegos ponen en su contenedor.
    for (const type of ["pointerdown", "mousedown", "click", "touchstart"]) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }

    this.boxEl = document.createElement("div");
    this.boxEl.className = "mg-room__box";
    this.root.append(this.boxEl);

    document.body.append(this.stripEl, this.root);
  }

  /** Strip superior con codigo / ronda / tiempo. null lo oculta. */
  setStrip(text: string | null): void {
    if (text === null) {
      this.stripEl.style.display = "none";
      return;
    }
    this.stripEl.style.display = "";
    this.stripEl.textContent = text;
  }

  /** Actualiza solo el countdown de la vista actual (esperando / votacion). */
  setTimeText(text: string | null): void {
    if (!this.timeEl) return;
    this.timeEl.textContent = text ?? "";
  }

  hide(): void {
    this.root.style.display = "none";
    this.timeEl = null;
  }

  private show(): void {
    this.root.style.display = "";
    this.boxEl.innerHTML = "";
    this.timeEl = null;
    this.takeoverEl = null;
  }

  /**
   * Agrega (una sola vez por vista) el boton para tomar el control cuando el
   * host se desconecto. Idempotente: si ya esta en la vista actual, no hace nada.
   */
  offerTakeover(onClick: () => void): void {
    if (this.root.style.display === "none") return;
    if (this.takeoverEl && this.boxEl.contains(this.takeoverEl)) return;
    const btn = document.createElement("button");
    btn.className = "mg-room__takeover";
    btn.type = "button";
    btn.textContent = "El anfitrion se desconecto - tomar el control";
    btn.addEventListener("click", onClick);
    this.takeoverEl = btn;
    this.boxEl.append(btn);
  }

  private addKicker(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__kicker";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addTitle(text: string): void {
    const el = document.createElement("h2");
    el.className = "mg-room__title";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addSubtitle(text: string): void {
    const el = document.createElement("p");
    el.className = "mg-room__subtitle";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addTime(): void {
    this.timeEl = document.createElement("div");
    this.timeEl.className = "mg-room__time";
    this.boxEl.append(this.timeEl);
  }

  private addSection(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__section";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private makeButton(
    label: string,
    onClick: () => void,
    variant: "primary" | "ghost" = "primary",
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "mg-room__btn" + (variant === "primary" ? " mg-room__btn--primary" : "");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private addButton(label: string, onClick: () => void): void {
    this.boxEl.append(this.makeButton(label, onClick, "primary"));
  }

  private addHint(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__hint";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private buildRow(
    left: string,
    name: string,
    right: HTMLElement | string,
    isMe: boolean,
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "mg-room__row" + (isMe ? " mg-room__row--me" : "");

    const rankEl = document.createElement("span");
    rankEl.className = "mg-room__rank";
    rankEl.textContent = left;

    const nameEl = document.createElement("span");
    nameEl.className = "mg-room__name";
    nameEl.textContent = name;

    let rightEl: HTMLElement;
    if (typeof right === "string") {
      rightEl = document.createElement("span");
      rightEl.className = "mg-room__value";
      rightEl.textContent = right;
    } else {
      rightEl = right;
    }

    li.append(rankEl, nameEl, rightEl);
    return li;
  }

  private addTotals(totals: TotalEntry[], me: string): void {
    this.addSection("Tablero acumulado");
    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of totals) {
      list.append(this.buildRow(String(row.rank), row.player, `${row.points} pts`, row.player === me));
    }
    this.boxEl.append(list);
  }

  /** Pantalla "esperando a los demas" con checklist de jugadores. */
  showWaiting(entries: WaitingEntry[], me: string): void {
    this.show();
    this.addKicker("Sala");
    this.addTitle("Esperando a los demas...");
    this.addTime();

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const e of entries) {
      const state = document.createElement("span");
      state.className = `mg-room__state mg-room__state--${e.state}`;
      state.textContent = STATE_LABELS[e.state];
      list.append(this.buildRow(e.state === "done" ? "OK" : "...", e.player, state, e.player === me));
    }
    this.boxEl.append(list);
  }

  /** Resultados de la ronda + tablero acumulado. */
  showResults(opts: {
    roundNo: number;
    totalRounds: number;
    gameTitle: string;
    rows: ResultEntry[];
    totals: TotalEntry[];
    me: string;
    /** Accion del host ("Siguiente juego" / "Ver resultados finales"), o null. */
    hostAction: { label: string; onClick: () => void } | null;
    /** Texto de espera para los no-host (o mientras arranca la votacion). */
    waitingText: string | null;
  }): void {
    this.show();
    this.addKicker(`Ronda ${opts.roundNo}/${opts.totalRounds} - ${opts.gameTitle}`);
    this.addTitle("Resultados");

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of opts.rows) {
      const value = document.createElement("span");
      value.className = "mg-room__value";
      value.textContent = `+${row.points}`;
      const small = document.createElement("small");
      small.textContent = row.scoreText;
      value.append(small);
      list.append(this.buildRow(String(row.rank), row.player, value, row.player === opts.me));
    }
    this.boxEl.append(list);

    this.addTotals(opts.totals, opts.me);

    if (opts.hostAction) {
      this.addButton(opts.hostAction.label, opts.hostAction.onClick);
    } else if (opts.waitingText) {
      this.addHint(opts.waitingText);
    }
  }

  /** Votacion (proximo juego o tope de tiempo). */
  showVoting(opts: {
    options: VoteOption[];
    /** Cantidad de votos por opcion. */
    counts: Record<string, number>;
    myVote: string | null;
    onVote: (optionId: string) => void;
    /** Textos de la vista (por defecto, la votacion del proximo juego). */
    kicker?: string;
    title?: string;
    hint?: string;
  }): void {
    this.show();
    this.addKicker(opts.kicker ?? "Votacion");
    this.addTitle(opts.title ?? "Elegi el proximo juego");
    this.addTime();

    const wrap = document.createElement("div");
    wrap.className = "mg-room__votes";
    for (const opt of opts.options) {
      const btn = document.createElement("button");
      btn.className = "mg-room__vote" + (opts.myVote === opt.id ? " mg-room__vote--mine" : "");
      btn.type = "button";
      if (opt.accent) btn.style.setProperty("--accent", opt.accent);

      const title = document.createElement("span");
      title.textContent = opt.title;

      const count = document.createElement("span");
      count.className = "mg-room__vote-count";
      const n = opts.counts[opt.id] ?? 0;
      count.textContent = n === 1 ? "1 voto" : `${n} votos`;

      btn.append(title, count);
      btn.addEventListener("click", () => opts.onVote(opt.id));
      wrap.append(btn);
    }
    this.boxEl.append(wrap);
    this.addHint(opts.hint ?? "Gana la mayoria; empate se define al azar");
  }

  /**
   * Tablero final con el ganador. Todos pueden salir al inicio; el host ademas
   * puede volver a la sala (revancha con los mismos jugadores).
   */
  showFinal(
    totals: TotalEntry[],
    me: string,
    opts: {
      /** Accion del host ("Volver a la sala"), o null para los demas. */
      hostAction: { label: string; onClick: () => void } | null;
      /** Texto de espera para los no-host. */
      waitingText: string | null;
    } = { hostAction: null, waitingText: null },
  ): void {
    this.show();
    this.addKicker("Fin de la sala");
    this.addTitle("Resultados finales");

    const winners = totals.filter((t) => t.rank === 1).map((t) => t.player);
    const winnerEl = document.createElement("div");
    winnerEl.className = "mg-room__winner";
    winnerEl.textContent =
      winners.length === 1 ? `Ganador: ${winners[0]}` : `Empate: ${winners.join(", ")}`;
    this.boxEl.append(winnerEl);

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of totals) {
      list.append(this.buildRow(String(row.rank), row.player, `${row.points} pts`, row.player === me));
    }
    this.boxEl.append(list);

    // El no-host espera al anfitrion para volver a la sala; el "Salir" siempre esta.
    if (!opts.hostAction && opts.waitingText) this.addHint(opts.waitingText);

    const actions = document.createElement("div");
    actions.className = "mg-room__actions";
    if (opts.hostAction) {
      actions.append(this.makeButton(opts.hostAction.label, opts.hostAction.onClick, "primary"));
    }
    actions.append(
      this.makeButton("Salir", () => (window.location.href = "/"), "ghost"),
    );
    this.boxEl.append(actions);
  }

  /** Error terminal (sala inexistente, etc.). */
  showError(message: string): void {
    this.show();
    this.addKicker("Sala");
    this.addTitle("Ups");
    this.addSubtitle(message);
    this.addButton("Volver al inicio", () => {
      window.location.href = "/";
    });
  }
}
