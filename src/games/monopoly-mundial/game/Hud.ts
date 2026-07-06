import { LeaderboardPanel } from "../../../shared/LeaderboardPanel";
import { isMuted, toggleMute } from "./audio";
import { Dice3D } from "./Dice3D";
import { Tokens3D, type TokenView } from "./Tokens3D";
import { GAME_ID, GROUP_COLORS, GROUP_TILES, JAIL_FINE, TILES, TOKENS } from "./constants";
import { netWorth, rentFor, tradeValid } from "./engine";
import type { Action, Difficulty, GameState, TradeOffer } from "./types";

/** Configuracion elegida en la pantalla de inicio del modo solitario. */
export interface SoloSetup {
  rivals: number;
  difficulty: Difficulty;
  token: number;
}

export interface HudCallbacks {
  /** Accion del jugador local (el Game decide si aplicarla o enviarla). */
  onAction: (action: Action) => void;
  /** Enter / boton empezar desde la pantalla de inicio o game over. */
  onStart: () => void;
}

const RULES_PAGES: { title: string; body: string }[] = [
  {
    title: "El objetivo",
    body: `<p><strong>Junta la mayor fortuna del Mundial 2026 y funde a tus rivales.</strong></p>
      <p>Ficha selecciones, compra los estadios sede y cobra la entrada cada vez que un rival caiga en tu territorio. El ultimo director tecnico solvente gana el torneo.</p>
      <p>En modo solitario jugas contra 1 a 5 rivales manejados por la maquina, con tres dificultades: <strong>Debutante</strong> (el mas facil), <strong>Profesional</strong> y <strong>Campeon del Mundo</strong> (el mas dificil). En salas online juegan hasta 6 personas.</p>`,
  },
  {
    title: "Tirar los dados",
    body: `<p>Cada turno arranca tirando los dados con <strong>TIRAR</strong>. Tu ficha avanza esa cantidad de casillas.</p>
      <p><strong>Dobles:</strong> si ambos dados muestran el mismo numero, volves a tirar. A la <strong>tercera</strong> vez seguida te muestran la tarjeta roja y vas directo al Vestuario.</p>
      <p>Cada vez que pasas por el <strong>Saque Inicial</strong> cobras $200 de premios.</p>`,
  },
  {
    title: "Comprar propiedades",
    body: `<p>Si caes en una seleccion, estadio o servicio sin dueno, podes <strong>ficharlo</strong> pagando el precio de lista, o dejarlo pasar.</p>
      <p>Cuando un rival cae en una propiedad tuya te paga la <strong>entrada</strong> automaticamente. Las propiedades hipotecadas no cobran entrada.</p>
      <p><strong>Consejo:</strong> si completas un grupo de color entero, la entrada de esas selecciones sin tribunas se <strong>duplica</strong>, y ademas podes empezar a construir.</p>`,
  },
  {
    title: "Estadios y servicios",
    body: `<p><strong>Estadios sede</strong> (Azteca, SoFi, AT&T y MetLife): la entrada depende de cuantos tenga el dueno: $25, $50, $100 o $200 con los cuatro.</p>
      <p><strong>Servicios</strong> (Cabina VAR y Transmision TV): la entrada es 4 veces lo que marquen los dados, o 10 veces si el dueno tiene los dos.</p>`,
  },
  {
    title: "Tarjetas VAR y FIFA",
    body: `<p>Al caer en una casilla <strong>VAR</strong> o <strong>FIFA</strong> levantas la tarjeta de arriba del mazo: premios, multas, traslados por el tablero o una roja directa.</p>
      <p>La tarjeta <strong>Apelacion ganada</strong> se guarda y te saca del Vestuario gratis cuando la necesites.</p>`,
  },
  {
    title: "El Vestuario",
    body: `<p>Vas suspendido al Vestuario si caes en <strong>Tarjeta Roja</strong>, si una tarjeta te expulsa o si sacas dobles tres veces seguidas.</p>
      <p>Suspendido igual cobras entradas y podes construir o canjear. Para volver a la cancha: sacar <strong>dobles</strong> (tenes 3 intentos), pagar la multa de $${JAIL_FINE}, o usar una <strong>Apelacion ganada</strong>. Si fallas el tercer intento pagas la multa y avanzas lo que marcaron los dados.</p>
      <p>Caer en el Vestuario de visita no hace nada: estas <strong>de visita</strong>.</p>`,
  },
  {
    title: "Tribunas y estadio propio",
    body: `<p>Con un grupo de color completo podes construir <strong>tribunas</strong> en esas selecciones (boton en la ficha de cada propiedad). La entrada sube muchisimo con cada tribuna.</p>
      <p><strong>Construccion pareja:</strong> tenes que construir la primera tribuna en todas las selecciones del grupo antes de la segunda, y asi hasta 4. La quinta mejora convierte la cancha en un <strong>estadio completo</strong>, la entrada maxima.</p>
      <p>Podes vender tribunas a la banca a mitad de precio cuando necesites efectivo.</p>`,
  },
  {
    title: "Hipotecas",
    body: `<p>Corto de plata? <strong>Hipoteca</strong> una propiedad y la banca te da la mitad de su precio. Antes tenes que vender todas las tribunas de ese grupo.</p>
      <p>Una propiedad hipotecada no cobra entrada. Para <strong>levantar la hipoteca</strong> pagas lo que te dieron mas 10% de interes.</p>`,
  },
  {
    title: "Canjes",
    body: `<p>Con el boton <strong>CANJE</strong> podes ofrecerle a otro jugador un intercambio de propiedades y efectivo, como en el mercado de pases.</p>
      <p>Solo se canjean propiedades sin tribunas (vende las tribunas del grupo primero). El otro jugador acepta o rechaza la oferta.</p>`,
  },
  {
    title: "Deudas y bancarrota",
    body: `<p>Si debes mas efectivo del que tenes, el juego te lo avisa: vende tribunas o hipoteca propiedades (tocando tus casillas) hasta juntar la plata y toca <strong>PAGAR</strong>.</p>
      <p>Si ni liquidando todo te alcanza, te declaras en <strong>bancarrota</strong>: entregas todo al acreedor y quedas eliminado del torneo. Gana el ultimo que quede en pie.</p>
      <p>En salas online, si se acaba el tiempo de la ronda gana el que tenga mas <strong>patrimonio</strong> (efectivo + propiedades + tribunas).</p>`,
  },
];

/** Etiqueta corta por tipo de casilla especial (sin imagenes: puro CSS Panini). */
const KIND_TAG: Partial<Record<string, string>> = {
  go: "SAQUE",
  jail: "VESTUARIO",
  fanfest: "FAN FEST",
  gotojail: "TARJETA ROJA",
  tax: "TASA",
  var: "VAR",
  fifa: "FIFA",
  stadium: "SEDE",
  utility: "SERVICIO",
};

/** Posicion (fila, columna) de cada casilla en la grilla 11x11. */
function tileGridPos(idx: number): [number, number] {
  if (idx === 0) return [11, 11];
  if (idx < 10) return [11, 11 - idx];
  if (idx === 10) return [11, 1];
  if (idx < 20) return [11 - (idx - 10), 1];
  if (idx === 20) return [1, 1];
  if (idx < 30) return [1, idx - 19];
  if (idx === 30) return [1, 11];
  return [idx - 29, 11];
}

function side(idx: number): "bottom" | "left" | "top" | "right" {
  if (idx <= 10) return "bottom";
  if (idx <= 20) return "left";
  if (idx <= 30) return "top";
  return "right";
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/** Celda de estadistica para el panel "Mi equipo". */
function teamStat(label: string, value: string): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "team-stat";
  const v = document.createElement("span");
  v.className = "team-stat-val";
  v.textContent = value;
  const l = document.createElement("span");
  l.className = "team-stat-label";
  l.textContent = label;
  cell.append(v, l);
  return cell;
}

export class Hud {
  private readonly cb: HudCallbacks;

  private boardEl!: HTMLDivElement;
  private tileEls: HTMLDivElement[] = [];
  private diceEl!: HTMLDivElement;
  private dice3dHost!: HTMLDivElement;
  private dice3d: Dice3D | null = null;
  private tokens3dHost!: HTMLDivElement;
  private tokens3d: Tokens3D | null = null;
  private tokenKey = "";
  private turnBannerEl!: HTMLDivElement;
  private toastEl!: HTMLDivElement;
  private playersEl!: HTMLDivElement;
  private actionsEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;
  private logClockEl!: HTMLSpanElement;
  private overlayEl!: HTMLDivElement;
  private countdownEl!: HTMLDivElement;
  private modalEl!: HTMLDivElement;
  private leaderboard: LeaderboardPanel | null = null;
  private leaderboardHost!: HTMLDivElement;

  private lastLogId = -1;
  private toastTimer = 0;
  private rulesPage = 0;
  private diceInit = false;
  private lastDiceSeq = -1;

  constructor(container: HTMLElement, cb: HudCallbacks) {
    this.cb = cb;
    container.innerHTML = "";
    container.appendChild(this.build());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.overlayEl.classList.contains("hidden")) {
        e.preventDefault();
        this.cb.onStart();
      }
    });
  }

  // ---------- Construccion del layout ----------

  private build(): HTMLDivElement {
    const root = el("div", "mono-root");

    // Tablero
    this.boardEl = el("div", "mono-board");
    for (let i = 0; i < TILES.length; i++) {
      const tile = TILES[i];
      const [row, col] = tileGridPos(i);
      const node = el("div", `tile tile-${tile.kind} tile-side-${side(i)}`);
      node.style.gridRow = String(row);
      node.style.gridColumn = String(col);
      if (tile.kind === "street") {
        const band = el("div", "tile-band");
        band.style.background = GROUP_COLORS[tile.group!];
        node.appendChild(band);
      } else {
        const tag = KIND_TAG[tile.kind];
        if (tag) node.appendChild(el("div", "tile-tag", tag));
      }
      node.appendChild(el("div", "tile-name", tile.short));
      if (tile.price) node.appendChild(el("div", "tile-price", `$${tile.price}`));
      node.appendChild(el("div", "tile-houses"));
      node.appendChild(el("div", "tile-owner"));
      node.appendChild(el("div", "tile-tokens"));
      node.addEventListener("click", () => this.openTileModal(i));
      this.tileEls.push(node);
      this.boardEl.appendChild(node);
    }

    const center = el("div", "board-center");
    center.appendChild(el("div", "board-brand", "MUNDIALOPOLY<span>COPA 2026 - MEXICO / EE.UU. / CANADA</span>"));
    this.turnBannerEl = el("div", "turn-banner");
    this.diceEl = el("div", "dice-area");
    this.toastEl = el("div", "toast hidden");
    this.dice3dHost = el("div", "dice-3d");
    center.append(this.dice3dHost, this.turnBannerEl, this.diceEl, this.toastEl);
    this.boardEl.appendChild(center);

    // Dados 3D; si WebGL no arranca, se cae al render DOM de siempre.
    try {
      this.dice3d = new Dice3D(this.dice3dHost);
    } catch {
      this.dice3d = null;
      this.dice3dHost.remove();
    }

    // Fichas 3D: canvas transparente que cubre todo el tablero (pointer-events
    // none). Si WebGL no arranca, se cae a los discos DOM en cada casilla.
    this.tokens3dHost = el("div", "tokens-3d");
    this.boardEl.appendChild(this.tokens3dHost);
    try {
      this.tokens3d = new Tokens3D(this.tokens3dHost);
      const ro = new ResizeObserver(() => {
        const r = this.boardEl.getBoundingClientRect();
        this.tokens3d?.resize(r.width, r.height);
      });
      ro.observe(this.boardEl);
    } catch {
      this.tokens3d = null;
      this.tokens3dHost.remove();
    }

    // Panel lateral
    const sidebar = el("div", "mono-side");
    this.playersEl = el("div", "players-panel");
    this.actionsEl = el("div", "actions-panel");
    const logBox = el("div", "log-box");
    const logHead = el("div", "log-head", "HISTORIAL");
    this.logClockEl = el("span", "log-clock", "00:00");
    logHead.appendChild(this.logClockEl);
    this.logEl = el("div", "log-list");
    logBox.append(logHead, this.logEl);
    sidebar.append(this.playersEl, this.actionsEl, logBox);

    // Overlays
    this.overlayEl = el("div", "overlay hidden");
    this.countdownEl = el("div", "countdown");
    this.modalEl = el("div", "modal-layer hidden");
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) this.closeModal();
    });
    this.leaderboardHost = el("div");

    root.append(this.boardEl, sidebar, this.overlayEl, this.countdownEl, this.modalEl);
    return root;
  }

  // ---------- Pantallas de inicio / espera / fin ----------

  /** Pantalla de inicio del modo solitario, con setup de rivales y ficha. */
  showSoloStart(nickname: string, best: number | null, setup: SoloSetup, onChange: (s: SoloSetup) => void): void {
    const box = el("div", "overlay-box");
    box.appendChild(el("h1", "overlay-title", "MUNDIALOPOLY"));
    box.appendChild(el("p", "overlay-sub", "El juego de propiedades de la Copa 2026. Ficha selecciones, compra estadios sede y fundi a tus rivales."));
    if (best !== null) box.appendChild(el("p", "overlay-best", `Mejor patrimonio: $${best}`));

    const form = el("div", "setup-form");

    const rivalRow = el("div", "setup-row");
    rivalRow.appendChild(el("span", "setup-label", "Rivales"));
    const rivalOpts = el("div", "setup-opts");
    for (let n = 1; n <= 5; n++) {
      const btn = el("button", `opt${setup.rivals === n ? " active" : ""}`, String(n));
      btn.addEventListener("click", () => onChange({ ...setup, rivals: n }));
      rivalOpts.appendChild(btn);
    }
    rivalRow.appendChild(rivalOpts);

    const diffRow = el("div", "setup-row");
    diffRow.appendChild(el("span", "setup-label", "Dificultad"));
    const diffOpts = el("div", "setup-opts");
    const diffs: [Difficulty, string][] = [
      ["debutante", "Debutante"],
      ["profesional", "Profesional"],
      ["campeon", "Campeon del Mundo"],
    ];
    for (const [value, label] of diffs) {
      const btn = el("button", `opt${setup.difficulty === value ? " active" : ""}`, label);
      btn.addEventListener("click", () => onChange({ ...setup, difficulty: value }));
      diffOpts.appendChild(btn);
    }
    diffRow.appendChild(diffOpts);

    const tokenRow = el("div", "setup-row");
    tokenRow.appendChild(el("span", "setup-label", "Tu ficha"));
    const tokenOpts = el("div", "setup-opts");
    TOKENS.forEach((token, i) => {
      const btn = el("button", `opt token-opt${setup.token === i ? " active" : ""}`, token.abbr);
      btn.style.setProperty("--token-color", token.color);
      btn.title = token.name;
      btn.addEventListener("click", () => onChange({ ...setup, token: i }));
      tokenOpts.appendChild(btn);
    });
    tokenRow.appendChild(tokenOpts);

    form.append(rivalRow, diffRow, tokenRow);
    box.appendChild(form);
    box.appendChild(el("p", "overlay-hint", `Jugas como ${nickname}. ENTER para comenzar`));

    const buttons = el("div", "overlay-buttons");
    const start = el("button", "btn btn-primary", "COMENZAR");
    start.addEventListener("click", () => this.cb.onStart());
    const rules = el("button", "btn", "REGLAS");
    rules.addEventListener("click", () => this.openRulesModal());
    buttons.append(start, rules);
    box.appendChild(buttons);

    this.setOverlay(box);
  }

  /** Sala online: lista de presentes y quien arranca. */
  showRoomWait(players: string[], me: string, isHost: boolean): void {
    const box = el("div", "overlay-box");
    box.appendChild(el("h1", "overlay-title", "MUNDIALOPOLY"));
    box.appendChild(el("p", "overlay-sub", `Partida online (${players.length}/6 jugadores)`));
    const list = el("div", "wait-list");
    players.forEach((p, i) => {
      const token = TOKENS[i % TOKENS.length];
      const row = el("div", "wait-row");
      const disc = el("span", "token-disc", token.abbr);
      disc.style.setProperty("--token-color", token.color);
      row.append(disc, el("span", "wait-name", p + (p === me ? " (vos)" : "")));
      list.appendChild(row);
    });
    box.appendChild(list);
    box.appendChild(el("p", "overlay-hint", isHost
      ? "Sos el anfitrion. ENTER para comenzar"
      : "Esperando a que el anfitrion comience..."));
    if (isHost) {
      const start = el("button", "btn btn-primary", "COMENZAR");
      start.addEventListener("click", () => this.cb.onStart());
      box.appendChild(start);
    }
    this.setOverlay(box);
  }

  /** Tabla final con patrimonio de todos; Enter reinicia (solo local). */
  showGameOver(state: GameState, me: string, opts: { restartHint: string; onMenu?: () => void }): void {
    const box = el("div", "overlay-box overlay-wide");
    const winner = state.winner;
    box.appendChild(el("h1", "overlay-title", winner === me ? "CAMPEON DEL MUNDO!" : "FIN DEL TORNEO"));
    if (winner) box.appendChild(el("p", "overlay-sub", `${winner} levanta la copa.`));

    const table = el("div", "final-table");
    const rows = state.players
      .map((p) => ({ name: p.name, worth: netWorth(state, p.name), bankrupt: p.bankrupt, token: p.token }))
      .sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.worth - a.worth);
    rows.forEach((r, i) => {
      const row = el("div", `final-row${r.name === me ? " me" : ""}`);
      const disc = el("span", "token-disc", TOKENS[r.token % TOKENS.length].abbr);
      disc.style.setProperty("--token-color", TOKENS[r.token % TOKENS.length].color);
      row.append(
        el("span", "final-rank", `${i + 1}`),
        disc,
        el("span", "final-name", r.name),
        el("span", "final-worth", r.bankrupt ? "En bancarrota" : `$${r.worth}`),
      );
      table.appendChild(row);
    });
    box.appendChild(table);
    box.appendChild(this.leaderboardHost);
    box.appendChild(el("p", "overlay-hint", opts.restartHint));
    if (opts.onMenu) {
      const menu = el("button", "btn btn-small", "MENU");
      menu.addEventListener("click", opts.onMenu);
      box.appendChild(menu);
    }
    this.setOverlay(box);
  }

  /** Ranking global (solo fuera del modo sala), igual que el resto de los juegos. */
  showRanking(gameId: string, score: number): void {
    if (!this.leaderboard) {
      this.leaderboard = new LeaderboardPanel();
      this.leaderboard.mount(this.leaderboardHost);
    }
    void this.leaderboard.render(gameId || GAME_ID, { score });
  }

  showError(text: string): void {
    const box = el("div", "overlay-box");
    box.appendChild(el("h1", "overlay-title", "MUNDIALOPOLY"));
    box.appendChild(el("p", "overlay-sub", text));
    this.setOverlay(box);
  }

  hideOverlay(): void {
    this.overlayEl.classList.add("hidden");
  }

  private setOverlay(content: HTMLElement): void {
    this.overlayEl.innerHTML = "";
    this.overlayEl.appendChild(content);
    this.overlayEl.classList.remove("hidden");
  }

  showCountdown(text: string | null): void {
    if (text === null) {
      this.countdownEl.classList.remove("visible");
      this.countdownEl.textContent = "";
      return;
    }
    this.countdownEl.classList.add("visible");
    this.countdownEl.textContent = text;
    this.countdownEl.style.animation = "none";
    void this.countdownEl.offsetHeight;
    this.countdownEl.style.animation = "";
  }

  // ---------- Render del estado ----------

  render(state: GameState, me: string): void {
    this.renderBoard(state);
    this.renderPlayers(state, me);
    this.renderActions(state, me);
    this.renderLog(state);
    this.renderDice(state);
    this.renderTradeIncoming(state, me);
    this.logClockEl.textContent = clock(Date.now() - state.startedAt);
  }

  private renderBoard(state: GameState): void {
    for (let i = 0; i < TILES.length; i++) {
      const node = this.tileEls[i];
      const own = state.own[i];
      const ownerEl = node.querySelector<HTMLDivElement>(".tile-owner")!;
      const housesEl = node.querySelector<HTMLDivElement>(".tile-houses")!;
      node.classList.toggle("mortgaged", !!own?.mortgaged);
      if (own) {
        const player = state.players.find((p) => p.name === own.owner);
        const token = TOKENS[(player?.token ?? 0) % TOKENS.length];
        ownerEl.style.background = token.color;
        ownerEl.style.display = "block";
        ownerEl.title = own.owner;
      } else {
        ownerEl.style.display = "none";
      }
      if (own && own.houses > 0) {
        housesEl.textContent = own.houses === 5 ? "EST" : "T".repeat(own.houses);
        housesEl.classList.toggle("hotel", own.houses === 5);
        housesEl.style.display = "block";
      } else {
        housesEl.style.display = "none";
      }
      // Discos DOM solo como fallback (sin WebGL); con fichas 3D quedan vacios.
      const tokensEl = node.querySelector<HTMLDivElement>(".tile-tokens")!;
      tokensEl.innerHTML = "";
      if (!this.tokens3d) {
        for (const player of state.players) {
          if (player.bankrupt || player.pos !== i) continue;
          const token = TOKENS[player.token % TOKENS.length];
          const disc = el("span", `token-disc small${state.players[state.turn] === player ? " current" : ""}`, token.abbr);
          disc.style.setProperty("--token-color", token.color);
          disc.title = player.name;
          tokensEl.appendChild(disc);
        }
      }
    }

    this.syncTokens3D(state);
  }

  /** Coloca las fichas 3D sobre el centro (en px) de la casilla de cada jugador. */
  private syncTokens3D(state: GameState): void {
    if (!this.tokens3d) return;
    const key = state.players.map((p) => p.token).join("-");
    if (key !== this.tokenKey) {
      this.tokenKey = key;
      this.tokens3d.setTokens(state.players.map((p) => TOKENS[p.token % TOKENS.length].color));
      const r = this.boardEl.getBoundingClientRect();
      this.tokens3d.resize(r.width, r.height);
    }
    const br = this.boardEl.getBoundingClientRect();
    const views: TokenView[] = state.players.map((p) => {
      const tr = this.tileEls[p.pos].getBoundingClientRect();
      return {
        color: TOKENS[p.token % TOKENS.length].color,
        x: tr.left - br.left + tr.width / 2,
        y: tr.top - br.top + tr.height / 2,
        current: state.turn === state.players.indexOf(p) && state.phase !== "over",
        bankrupt: p.bankrupt,
      };
    });
    this.tokens3d.sync(views);
  }

  private renderPlayers(state: GameState, me: string): void {
    this.playersEl.innerHTML = "";
    state.players.forEach((player, idx) => {
      const token = TOKENS[player.token % TOKENS.length];
      const card = el("div", `player-card${idx === state.turn ? " active" : ""}${player.bankrupt ? " bankrupt" : ""}`);
      const head = el("div", "player-head");
      const disc = el("span", "token-disc", token.abbr);
      disc.style.setProperty("--token-color", token.color);
      head.append(
        disc,
        el("span", "player-name", player.name + (player.name === me ? " (vos)" : "")),
        el("span", "player-money", player.bankrupt ? "OUT" : `$${player.money}`),
      );
      card.appendChild(head);

      const badges = el("div", "player-badges");
      if (player.inJail) badges.appendChild(el("span", "badge badge-jail", "SUSPENDIDO"));
      if (player.pardons > 0) badges.appendChild(el("span", "badge", `APELACION x${player.pardons}`));
      if (badges.childElementCount > 0) card.appendChild(badges);

      const chips = el("div", "player-chips");
      for (const [group, tiles] of Object.entries(GROUP_TILES)) {
        for (const t of tiles) {
          const own = state.own[t];
          if (own?.owner !== player.name) continue;
          const chip = el("span", `chip${own.mortgaged ? " chip-mortgaged" : ""}`);
          chip.style.background = GROUP_COLORS[group];
          chip.title = TILES[t].name;
          chips.appendChild(chip);
        }
      }
      for (const t of [...(TILES.flatMap((tile, i) => (tile.kind === "stadium" || tile.kind === "utility" ? [i] : [])))]) {
        const own = state.own[t];
        if (own?.owner !== player.name) continue;
        const chip = el("span", `chip chip-special${own.mortgaged ? " chip-mortgaged" : ""}`, TILES[t].kind === "stadium" ? "E" : "S");
        chip.title = TILES[t].name;
        chips.appendChild(chip);
      }
      if (chips.childElementCount > 0) card.appendChild(chips);
      this.playersEl.appendChild(card);
    });
  }

  private renderActions(state: GameState, me: string): void {
    this.actionsEl.innerHTML = "";
    const player = state.players[state.turn];
    const myTurn = player.name === me && !player.bankrupt;
    const act = (action: Action) => () => this.cb.onAction(action);

    this.turnBannerEl.textContent = state.phase === "over"
      ? `Campeon: ${state.winner ?? ""}`
      : myTurn ? "Tu turno" : `Turno de ${player.name}`;
    this.turnBannerEl.classList.toggle("mine", myTurn && state.phase !== "over");

    const addBtn = (label: string, onClick: () => void, cls = "btn") => {
      const btn = el("button", cls, label);
      btn.addEventListener("click", onClick);
      this.actionsEl.appendChild(btn);
      return btn;
    };

    if (myTurn && state.phase !== "over") {
      switch (state.phase) {
        case "roll":
          if (player.inJail) {
            addBtn("TIRAR (dobles)", act({ type: "roll" }), "btn btn-primary");
            if (player.money >= JAIL_FINE) addBtn(`PAGAR $${JAIL_FINE}`, act({ type: "payJail" }));
            if (player.pardons > 0) addBtn("USAR APELACION", act({ type: "usePardon" }));
          } else {
            addBtn("TIRAR", act({ type: "roll" }), "btn btn-primary");
          }
          addBtn("CANJE", () => this.openTradeModal(state, me));
          break;
        case "buy": {
          const tile = TILES[state.buying!];
          if (player.money >= (tile.price ?? 0)) {
            addBtn(`FICHAR $${tile.price}`, act({ type: "buy" }), "btn btn-primary");
          }
          addBtn("DEJAR PASAR", act({ type: "skip" }));
          break;
        }
        case "manage":
          addBtn("TERMINAR TURNO", act({ type: "end" }), "btn btn-primary");
          addBtn("CANJE", () => this.openTradeModal(state, me));
          break;
        case "debt": {
          const debt = state.debt!;
          this.actionsEl.appendChild(el("div", "debt-note",
            `Debes $${debt.amount}${debt.to ? ` a ${debt.to}` : " a la banca"}. Toca tus casillas para vender tribunas o hipotecar.`));
          const pay = addBtn(`PAGAR $${debt.amount}`, act({ type: "payDebt" }), "btn btn-primary");
          if (player.money < debt.amount) pay.setAttribute("disabled", "true");
          addBtn("BANCARROTA", act({ type: "bankrupt" }), "btn btn-danger");
          break;
        }
      }
    } else if (state.phase !== "over") {
      this.actionsEl.appendChild(el("div", "waiting-note", `Esperando a ${player.name}...`));
    }

    if (state.trade && state.trade.from === me) {
      addBtn("CANCELAR CANJE", act({ type: "tradeCancel" }));
    }

    const utils = el("div", "actions-utils");
    const team = el("button", "btn btn-small btn-team", "MI EQUIPO");
    team.addEventListener("click", () => this.openTeamModal(state, me));
    const rules = el("button", "btn btn-small", "REGLAS");
    rules.addEventListener("click", () => this.openRulesModal());
    const mute = el("button", "btn btn-small", isMuted() ? "SONIDO: OFF" : "SONIDO: ON");
    mute.addEventListener("click", () => {
      toggleMute();
      mute.textContent = isMuted() ? "SONIDO: OFF" : "SONIDO: ON";
    });
    utils.append(team, rules, mute);
    this.actionsEl.appendChild(utils);
  }

  /** Panel "Mi equipo": patrimonio, cartas guardadas y propiedades detalladas. */
  private openTeamModal(state: GameState, me: string): void {
    const player = state.players.find((p) => p.name === me);
    if (!player) return;
    const box = el("div", "modal-box team-modal");
    box.appendChild(el("h2", "team-title", "MI EQUIPO"));

    // Resumen de patrimonio.
    const owned = Object.keys(state.own).map(Number).filter((i) => state.own[i].owner === me);
    const groupsDone = Object.entries(GROUP_TILES).filter(([, tiles]) =>
      tiles.every((t) => state.own[t]?.owner === me)).length;
    const summary = el("div", "team-summary");
    summary.append(
      teamStat("Efectivo", `$${player.money}`),
      teamStat("Patrimonio", `$${netWorth(state, me)}`),
      teamStat("Propiedades", String(owned.length)),
      teamStat("Grupos completos", String(groupsDone)),
    );
    box.appendChild(summary);

    // Cartas guardadas (apelaciones).
    const cards = el("div", "team-cards");
    cards.appendChild(el("h3", "team-sub", "Cartas guardadas"));
    if (player.pardons > 0) {
      const row = el("div", "card-hand");
      for (let k = 0; k < player.pardons; k++) {
        const c = el("div", "hand-card", "APELACIÓN<span>Salí del Vestuario gratis</span>");
        row.appendChild(c);
      }
      cards.appendChild(row);
    } else {
      cards.appendChild(el("div", "team-empty", "No tenés cartas guardadas."));
    }
    box.appendChild(cards);

    // Propiedades agrupadas.
    const props = el("div", "team-props");
    props.appendChild(el("h3", "team-sub", "Mis propiedades"));
    if (owned.length === 0) {
      props.appendChild(el("div", "team-empty", "Todavía no fichaste ninguna propiedad."));
    } else {
      const order = [...Object.entries(GROUP_TILES).flatMap(([, t]) => t),
        ...TILES.flatMap((t, i) => (t.kind === "stadium" || t.kind === "utility" ? [i] : []))];
      for (const idx of order) {
        const own = state.own[idx];
        if (own?.owner !== me) continue;
        const tile = TILES[idx];
        const row = el("div", `team-prop${own.mortgaged ? " mortgaged" : ""}`);
        const chip = el("span", "chip");
        chip.style.background = tile.kind === "street" ? GROUP_COLORS[tile.group!] : "#2a3550";
        const info = el("div", "team-prop-info");
        info.append(
          el("span", "team-prop-name", tile.name),
          el("span", "team-prop-meta",
            (tile.kind === "street"
              ? (own.houses === 5 ? "Estadio completo" : own.houses > 0 ? `${own.houses} tribuna(s)` : "Sin tribunas")
              : tile.kind === "stadium" ? "Estadio sede" : "Servicio")
            + (own.mortgaged ? " · hipotecada" : ` · entrada $${rentFor(state, idx, 7)}`)),
        );
        row.append(chip, info, el("span", "team-prop-go", "VER"));
        row.addEventListener("click", () => { this.closeModal(); this.openTileModal(idx); });
        props.appendChild(row);
      }
    }
    box.appendChild(props);

    const close = el("button", "btn btn-small modal-close", "CERRAR");
    close.addEventListener("click", () => this.closeModal());
    box.appendChild(close);
    this.openModal(box, "team");
  }

  private renderDice(state: GameState): void {
    // Ultimo evento "dice" del motor: distingue una tirada nueva de un
    // re-render con los mismos valores (dos 3-4 seguidos son tiradas distintas
    // pero valores iguales; el seq del fx no miente).
    let maxDiceSeq = -1;
    for (const ev of state.fx) if (ev.kind === "dice" && ev.seq > maxDiceSeq) maxDiceSeq = ev.seq;

    if (this.dice3d) {
      // Primera vez que vemos el estado (carga o join a mitad de turno): sin
      // animacion, para no reproducir una tirada vieja.
      if (!this.diceInit) {
        this.diceInit = true;
        this.lastDiceSeq = maxDiceSeq;
        if (state.dice) this.dice3d.showStatic(state.dice[0], state.dice[1]);
        else this.dice3d.hide();
        return;
      }
      if (!state.dice) {
        this.dice3d.hide();
        return;
      }
      if (maxDiceSeq > this.lastDiceSeq) {
        this.lastDiceSeq = maxDiceSeq;
        this.dice3d.roll(state.dice[0], state.dice[1]);
      } else {
        this.dice3d.showStatic(state.dice[0], state.dice[1]);
      }
      return;
    }

    // Fallback DOM (sin WebGL).
    this.diceEl.innerHTML = "";
    if (!state.dice) return;
    for (const value of state.dice) {
      this.diceEl.appendChild(el("div", "die", String(value)));
    }
  }

  private renderLog(state: GameState): void {
    for (const entry of state.log) {
      if (entry.id <= this.lastLogId) continue;
      this.lastLogId = entry.id;
      const row = el("div", "log-entry");
      row.append(el("span", "log-time", clock(entry.t)), el("span", "log-text", entry.text));
      this.logEl.prepend(row);
      // Toast con los eventos de tarjetas para que se lean sin buscar el log.
      if (entry.text.includes("saca una Tarjeta")) this.showToast(entry.text);
    }
    while (this.logEl.childElementCount > 40) this.logEl.lastElementChild?.remove();
  }

  private showToast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add("hidden"), 4200);
  }

  // ---------- Canje entrante ----------

  private renderTradeIncoming(state: GameState, me: string): void {
    const trade = state.trade;
    if (!trade || trade.to !== me) {
      if (this.modalEl.dataset.kind === "trade-incoming") this.closeModal();
      return;
    }
    if (this.modalEl.dataset.kind === "trade-incoming") return;

    const box = el("div", "modal-box");
    box.appendChild(el("h2", "", `${trade.from} te ofrece un canje`));
    const cols = el("div", "trade-cols");
    cols.appendChild(this.tradeColumn("Recibis", trade.giveMoney, trade.giveProps));
    cols.appendChild(this.tradeColumn("Entregas", trade.getMoney, trade.getProps));
    box.appendChild(cols);
    const buttons = el("div", "overlay-buttons");
    const ok = el("button", "btn btn-primary", "ACEPTAR");
    ok.addEventListener("click", () => {
      this.cb.onAction({ type: "tradeAccept" });
      this.closeModal();
    });
    const no = el("button", "btn btn-danger", "RECHAZAR");
    no.addEventListener("click", () => {
      this.cb.onAction({ type: "tradeReject" });
      this.closeModal();
    });
    buttons.append(ok, no);
    box.appendChild(buttons);
    this.openModal(box, "trade-incoming");
  }

  private tradeColumn(title: string, money: number, props: number[]): HTMLElement {
    const col = el("div", "trade-col");
    col.appendChild(el("h3", "", title));
    if (money > 0) col.appendChild(el("div", "trade-item", `$${money}`));
    for (const idx of props) {
      const tile = TILES[idx];
      const item = el("div", "trade-item");
      if (tile.kind === "street") {
        const chip = el("span", "chip");
        chip.style.background = GROUP_COLORS[tile.group!];
        item.appendChild(chip);
      }
      item.appendChild(document.createTextNode(tile.name));
      col.appendChild(item);
    }
    if (money === 0 && props.length === 0) col.appendChild(el("div", "trade-item empty", "Nada"));
    return col;
  }

  // ---------- Modales ----------

  private openModal(content: HTMLElement, kind: string): void {
    this.modalEl.innerHTML = "";
    this.modalEl.appendChild(content);
    this.modalEl.dataset.kind = kind;
    this.modalEl.classList.remove("hidden");
  }

  closeModal(): void {
    this.modalEl.classList.add("hidden");
    this.modalEl.dataset.kind = "";
    this.modalEl.innerHTML = "";
  }

  /** Ficha de propiedad al tocar una casilla: rentas + acciones del dueno. */
  private openTileModal(idx: number): void {
    const state = this.lastState;
    const me = this.lastMe;
    if (!state) return;
    const tile = TILES[idx];
    if (tile.kind !== "street" && tile.kind !== "stadium" && tile.kind !== "utility") return;

    const box = el("div", "modal-box deed");
    const head = el("div", "deed-head", tile.name);
    if (tile.kind === "street") head.style.background = GROUP_COLORS[tile.group!];
    box.appendChild(head);

    const own = state.own[idx];
    const info = el("div", "deed-body");
    info.appendChild(el("div", "deed-row", `<span>Precio</span><span>$${tile.price}</span>`));
    if (tile.kind === "street") {
      const labels = ["Entrada", "Con 1 tribuna", "Con 2 tribunas", "Con 3 tribunas", "Con 4 tribunas", "Estadio completo"];
      tile.rents!.forEach((rent, i) => {
        info.appendChild(el("div", `deed-row${own?.houses === i ? " current" : ""}`, `<span>${labels[i]}</span><span>$${rent}</span>`));
      });
      info.appendChild(el("div", "deed-row", `<span>Tribuna</span><span>$${tile.houseCost}</span>`));
      info.appendChild(el("div", "deed-note", "Con el grupo completo la entrada sin tribunas se duplica."));
    } else if (tile.kind === "stadium") {
      info.appendChild(el("div", "deed-row", "<span>1 estadio</span><span>$25</span>"));
      info.appendChild(el("div", "deed-row", "<span>2 estadios</span><span>$50</span>"));
      info.appendChild(el("div", "deed-row", "<span>3 estadios</span><span>$100</span>"));
      info.appendChild(el("div", "deed-row", "<span>4 estadios</span><span>$200</span>"));
    } else {
      info.appendChild(el("div", "deed-note", "Entrada: 4 veces los dados con un servicio, 10 veces con los dos."));
    }
    info.appendChild(el("div", "deed-row", `<span>Hipoteca</span><span>$${Math.floor((tile.price ?? 0) / 2)}</span>`));
    info.appendChild(el("div", "deed-owner", own
      ? `Dueno: ${own.owner}${own.mortgaged ? " (hipotecada)" : ""}`
      : "Sin dueno"));
    if (own) {
      info.appendChild(el("div", "deed-note", `Entrada actual: $${rentFor(state, idx, 7)}`));
    }
    box.appendChild(info);

    // Acciones del dueno en su turno.
    const player = state.players[state.turn];
    if (own && own.owner === me && player.name === me && (state.phase === "roll" || state.phase === "manage" || state.phase === "debt")) {
      const buttons = el("div", "overlay-buttons");
      const dispatch = (action: Action) => () => {
        this.cb.onAction(action);
        this.closeModal();
      };
      if (tile.kind === "street" && !own.mortgaged && state.phase !== "debt") {
        buttons.appendChild(this.smallBtn(`TRIBUNA $${tile.houseCost}`, dispatch({ type: "build", tile: idx })));
      }
      if (own.houses > 0) {
        buttons.appendChild(this.smallBtn(`VENDER TRIBUNA $${Math.floor((tile.houseCost ?? 0) / 2)}`, dispatch({ type: "sellHouse", tile: idx })));
      }
      if (!own.mortgaged && own.houses === 0) {
        buttons.appendChild(this.smallBtn(`HIPOTECAR $${Math.floor((tile.price ?? 0) / 2)}`, dispatch({ type: "mortgage", tile: idx })));
      }
      if (own.mortgaged && state.phase !== "debt") {
        buttons.appendChild(this.smallBtn(`LEVANTAR $${Math.ceil(Math.floor((tile.price ?? 0) / 2) * 1.1)}`, dispatch({ type: "unmortgage", tile: idx })));
      }
      if (buttons.childElementCount > 0) box.appendChild(buttons);
    }

    const close = el("button", "btn btn-small modal-close", "CERRAR");
    close.addEventListener("click", () => this.closeModal());
    box.appendChild(close);
    this.openModal(box, "deed");
  }

  private smallBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = el("button", "btn btn-small", label);
    btn.addEventListener("click", onClick);
    return btn;
  }

  /** Armador de canje: rival, efectivo de ambos lados y propiedades. */
  private openTradeModal(state: GameState, me: string): void {
    const rivals = state.players.filter((p) => p.name !== me && !p.bankrupt);
    if (rivals.length === 0) return;
    let target = rivals[0].name;
    let giveMoney = 0;
    let getMoney = 0;
    const giveProps = new Set<number>();
    const getProps = new Set<number>();

    const box = el("div", "modal-box trade-modal");
    box.appendChild(el("h2", "", "Mercado de pases"));

    const targetRow = el("div", "setup-row");
    targetRow.appendChild(el("span", "setup-label", "Con"));
    const targetOpts = el("div", "setup-opts");
    const renderBody = () => {
      body.innerHTML = "";
      body.appendChild(buildSide("Ofreces", me, giveProps, giveMoney, (v) => { giveMoney = v; }));
      body.appendChild(buildSide("Pedis", target, getProps, getMoney, (v) => { getMoney = v; }));
    };
    for (const rival of rivals) {
      const btn = el("button", `opt${target === rival.name ? " active" : ""}`, rival.name);
      btn.addEventListener("click", () => {
        target = rival.name;
        getProps.clear();
        for (const b of targetOpts.querySelectorAll("button")) b.classList.toggle("active", b.textContent === rival.name);
        renderBody();
      });
      targetOpts.appendChild(btn);
    }
    targetRow.appendChild(targetOpts);
    box.appendChild(targetRow);

    const body = el("div", "trade-cols");
    const buildSide = (title: string, who: string, set: Set<number>, money: number, setMoney: (v: number) => void): HTMLElement => {
      const col = el("div", "trade-col");
      col.appendChild(el("h3", "", title));
      const moneyInput = el("input") as HTMLInputElement;
      moneyInput.type = "number";
      moneyInput.min = "0";
      moneyInput.step = "10";
      moneyInput.value = String(money);
      moneyInput.className = "trade-money";
      moneyInput.addEventListener("input", () => setMoney(Math.max(0, Number(moneyInput.value) || 0)));
      const moneyRow = el("div", "trade-item");
      moneyRow.append(document.createTextNode("$ "), moneyInput);
      col.appendChild(moneyRow);
      const tradeable = Object.keys(state.own).map(Number).filter((i) => {
        const own = state.own[i];
        return own.owner === who && own.houses === 0;
      });
      for (const idx of tradeable) {
        const tile = TILES[idx];
        const item = el("label", "trade-item selectable");
        const check = el("input") as HTMLInputElement;
        check.type = "checkbox";
        check.checked = set.has(idx);
        check.addEventListener("change", () => (check.checked ? set.add(idx) : set.delete(idx)));
        if (tile.kind === "street") {
          const chip = el("span", "chip");
          chip.style.background = GROUP_COLORS[tile.group!];
          item.appendChild(chip);
        }
        item.append(check, document.createTextNode(` ${tile.name}${state.own[idx].mortgaged ? " (hip.)" : ""}`));
        col.appendChild(item);
      }
      if (tradeable.length === 0) col.appendChild(el("div", "trade-item empty", "Sin propiedades canjeables"));
      return col;
    };
    renderBody();
    box.appendChild(body);

    const buttons = el("div", "overlay-buttons");
    const send = el("button", "btn btn-primary", "OFRECER");
    send.addEventListener("click", () => {
      const offer: TradeOffer = {
        from: me,
        to: target,
        giveMoney,
        getMoney,
        giveProps: [...giveProps],
        getProps: [...getProps],
      };
      if (!tradeValid(state, offer)) return;
      this.cb.onAction({ type: "trade", offer });
      this.closeModal();
    });
    const cancel = el("button", "btn", "CANCELAR");
    cancel.addEventListener("click", () => this.closeModal());
    buttons.append(send, cancel);
    box.appendChild(buttons);
    this.openModal(box, "trade-build");
  }

  /** Reglas paginadas, como el manual del juego de consola. */
  openRulesModal(): void {
    this.rulesPage = 0;
    const box = el("div", "modal-box rules-modal");
    const title = el("h2", "");
    const body = el("div", "rules-body");
    const pager = el("div", "rules-pager");
    const prev = el("button", "btn btn-small", "ANTERIOR");
    const counter = el("span", "rules-counter");
    const next = el("button", "btn btn-small", "SIGUIENTE");
    const close = el("button", "btn btn-primary", "CERRAR");
    const renderPage = () => {
      const page = RULES_PAGES[this.rulesPage];
      title.textContent = page.title.toUpperCase();
      body.innerHTML = page.body;
      counter.textContent = `${this.rulesPage + 1} / ${RULES_PAGES.length}`;
      prev.style.visibility = this.rulesPage > 0 ? "visible" : "hidden";
      next.style.visibility = this.rulesPage < RULES_PAGES.length - 1 ? "visible" : "hidden";
    };
    prev.addEventListener("click", () => { this.rulesPage--; renderPage(); });
    next.addEventListener("click", () => { this.rulesPage++; renderPage(); });
    close.addEventListener("click", () => this.closeModal());
    pager.append(prev, counter, next);
    box.append(title, body, pager, close);
    renderPage();
    this.openModal(box, "rules");
  }

  /** Modal de compra al caer en propiedad libre (ademas de los botones). */
  maybeShowBuyModal(state: GameState, me: string): void {
    const player = state.players[state.turn];
    if (state.phase !== "buy" || player.name !== me) {
      if (this.modalEl.dataset.kind === "buy") this.closeModal();
      return;
    }
    if (this.modalEl.dataset.kind === "buy") return;
    const idx = state.buying!;
    const tile = TILES[idx];
    const box = el("div", "modal-box deed");
    const head = el("div", "deed-head", "EN VENTA");
    if (tile.kind === "street") head.style.background = GROUP_COLORS[tile.group!];
    box.appendChild(head);
    const bodyEl = el("div", "deed-body");
    bodyEl.appendChild(el("div", "deed-row", `<span>${tile.name}</span><span>$${tile.price}</span>`));
    if (tile.kind === "street") {
      bodyEl.appendChild(el("div", "deed-note", `Entrada base $${tile.rents![0]}, estadio completo $${tile.rents![5]}.`));
    }
    box.appendChild(bodyEl);
    const buttons = el("div", "overlay-buttons");
    const player2 = state.players[state.turn];
    if (player2.money >= (tile.price ?? 0)) {
      const buy = el("button", "btn btn-primary", `FICHAR $${tile.price}`);
      buy.addEventListener("click", () => {
        this.cb.onAction({ type: "buy" });
        this.closeModal();
      });
      buttons.appendChild(buy);
    } else {
      bodyEl.appendChild(el("div", "deed-note", "No te alcanza el efectivo."));
    }
    const skip = el("button", "btn", "DEJAR PASAR");
    skip.addEventListener("click", () => {
      this.cb.onAction({ type: "skip" });
      this.closeModal();
    });
    buttons.appendChild(skip);
    box.appendChild(buttons);
    this.openModal(box, "buy");
  }

  // Ultimo estado renderizado, para los modales que se abren por click.
  private lastState: GameState | null = null;
  private lastMe = "";

  remember(state: GameState, me: string): void {
    this.lastState = state;
    this.lastMe = me;
  }
}
