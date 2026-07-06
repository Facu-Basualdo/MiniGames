import { getSupabase } from "./supabase";
import { fetchTop, submitScore, type ScoreRow } from "./leaderboard";
import { formatScore, getDirection } from "./scoring";
import { getNickname, setNickname, NICKNAME_MAX } from "./nickname";

const TOP_LIMIT = 10;

/**
 * Decide si `score` entra al Top N ya cargado. Hay lugar si todavia no se
 * llenaron las N filas; si estan llenas, califica cuando iguala o supera al
 * peor puntaje del top (segun la direccion del juego).
 */
function qualifiesForTop(
  gameId: string,
  score: number,
  variant: string | undefined,
  rows: ScoreRow[],
): boolean {
  if (rows.length < TOP_LIMIT) return true;
  const worst = rows[rows.length - 1].score;
  return getDirection(gameId, variant) === "lower"
    ? score <= worst
    : score >= worst;
}

interface RenderOpts {
  /** Variante del ranking (p.ej. tamano de sliding-puzzle). */
  variant?: string;
  /**
   * Puntaje de la partida recien terminada. Si se pasa, el panel pide
   * confirmar el nombre (prellenado con el ultimo usado), envia el puntaje y
   * resalta la fila propia. Omitir en modo solo-lectura (landing).
   */
  score?: number;
}

const STYLE_ID = "mg-leaderboard-styles";

const CSS = `
.mg-lb { width: 100%; max-width: 360px; margin: 0 auto; font-family: inherit; color: #fff; }
.mg-lb__title { font-size: 0.85rem; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.7; text-align: center; margin: 0 0 0.6rem; }
.mg-lb__status { text-align: center; opacity: 0.6; font-size: 0.85rem; padding: 0.4rem 0; }
.mg-lb__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.mg-lb__row { display: grid; grid-template-columns: 1.6rem 1fr auto; align-items: center; gap: 0.5rem; padding: 0.3rem 0.55rem; border-radius: 8px; background: rgba(255,255,255,0.05); font-size: 0.92rem; }
.mg-lb__row--me { background: rgba(255,255,255,0.18); font-weight: 700; box-shadow: 0 0 0 1px rgba(255,255,255,0.35) inset; }
.mg-lb__rank { opacity: 0.6; text-align: right; font-variant-numeric: tabular-nums; }
.mg-lb__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-lb__value { font-variant-numeric: tabular-nums; }
.mg-lb__form { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; }
.mg-lb__input { flex: 1; min-width: 0; padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.35); color: #fff; font: inherit; }
.mg-lb__input:focus { outline: none; border-color: rgba(255,255,255,0.6); }
.mg-lb__save { padding: 0.45rem 0.8rem; border-radius: 8px; border: none; background: #fff; color: #111; font: inherit; font-weight: 700; cursor: pointer; }
.mg-lb__save:hover { opacity: 0.85; }
.mg-lb__hint { text-align: center; font-size: 0.78rem; opacity: 0.55; margin-top: 0.4rem; }
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/**
 * Componente DOM autocontenido para mostrar el Top N de un juego. Reutilizado
 * por cada juego (pantalla game-over) y por la landing (modal solo-lectura).
 * Inyecta su propio CSS una sola vez y no depende del estilo de cada juego.
 */
export class LeaderboardPanel {
  readonly root: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly listEl: HTMLUListElement;
  private readonly formEl: HTMLFormElement;
  private readonly inputEl: HTMLInputElement;

  /** Contexto de la partida en curso mientras se pide el nickname. */
  private pending: { gameId: string; score: number; variant?: string } | null = null;

  constructor() {
    ensureStyles();

    this.root = document.createElement("div");
    this.root.className = "mg-lb";
    // Evita que clics/toques dentro del panel (input, boton, filas) lleguen a
    // los listeners de "toca para reiniciar" que varios juegos ponen en su
    // overlay/contenedor.
    const stop = (e: Event) => e.stopPropagation();
    this.root.addEventListener("pointerdown", stop);
    this.root.addEventListener("mousedown", stop);
    this.root.addEventListener("click", stop);
    this.root.addEventListener("touchstart", stop);

    const title = document.createElement("div");
    title.className = "mg-lb__title";
    title.textContent = "Ranking global";

    this.formEl = document.createElement("form");
    this.formEl.className = "mg-lb__form";
    this.formEl.style.display = "none";

    this.inputEl = document.createElement("input");
    this.inputEl.className = "mg-lb__input";
    this.inputEl.type = "text";
    this.inputEl.maxLength = NICKNAME_MAX;
    this.inputEl.placeholder = "Tu nombre";
    this.inputEl.autocomplete = "off";

    const save = document.createElement("button");
    save.className = "mg-lb__save";
    save.type = "submit";
    save.textContent = "Guardar";

    this.formEl.append(this.inputEl, save);
    this.formEl.addEventListener("submit", this.onSubmitName);
    // Evita que Enter/Espacio mientras se escribe el nombre lleguen a los
    // listeners de teclado del juego (que reiniciarian la partida).
    this.inputEl.addEventListener("keydown", (e) => e.stopPropagation());

    this.statusEl = document.createElement("div");
    this.statusEl.className = "mg-lb__status";

    this.listEl = document.createElement("ul");
    this.listEl.className = "mg-lb__list";

    this.root.append(title, this.formEl, this.statusEl, this.listEl);
  }

  mount(container: HTMLElement): void {
    container.append(this.root);
  }

  unmount(): void {
    this.root.remove();
  }

  /** Vacia y oculta el panel (p.ej. al volver a la pantalla de inicio). */
  clear(): void {
    this.pending = null;
    this.formEl.style.display = "none";
    this.listEl.innerHTML = "";
    this.statusEl.textContent = "";
    this.root.style.display = "none";
  }

  /**
   * Renderiza el ranking del juego. Si `opts.score` viene y el puntaje entra
   * al Top 10, muestra el formulario de nombre (prellenado con el ultimo
   * usado) y envia el puntaje recien cuando el jugador confirma. Si no
   * califica, solo muestra el ranking sin pedir el nombre.
   */
  async render(gameId: string, opts: RenderOpts = {}): Promise<void> {
    this.root.style.display = "";
    this.pending = null;
    this.formEl.style.display = "none";

    if (!getSupabase()) {
      this.listEl.innerHTML = "";
      this.statusEl.textContent = "Ranking no disponible";
      return;
    }

    this.statusEl.textContent = "Cargando...";
    this.listEl.innerHTML = "";

    const rows = await fetchTop(gameId, { variant: opts.variant });

    // Partida terminada: pedir/confirmar el nombre solo si el puntaje entra al
    // Top 10. El nombre usado la vez anterior aparece prellenado como
    // sugerencia editable.
    const hasScore = opts.score !== undefined && Number.isFinite(opts.score);
    if (hasScore && qualifiesForTop(gameId, opts.score!, opts.variant, rows)) {
      this.pending = { gameId, score: opts.score!, variant: opts.variant };
      this.formEl.style.display = "flex";
      this.inputEl.value = getNickname() ?? "";
      this.inputEl.focus();
      this.inputEl.select();
    }

    this.renderRows(gameId, rows, opts.variant, hasScore ? opts.score : undefined);
  }

  private async renderList(
    gameId: string,
    variant: string | undefined,
    highlightScore: number | undefined,
  ): Promise<void> {
    this.statusEl.textContent = "Cargando...";
    this.listEl.innerHTML = "";
    const rows = await fetchTop(gameId, { variant });
    this.renderRows(gameId, rows, variant, highlightScore);
  }

  private renderRows(
    gameId: string,
    rows: ScoreRow[],
    variant: string | undefined,
    highlightScore: number | undefined,
  ): void {
    this.listEl.innerHTML = "";
    if (rows.length === 0) {
      this.statusEl.textContent = "Todavia no hay puntajes. Se el primero.";
      return;
    }
    this.statusEl.textContent = "";

    const me = getNickname();
    let highlighted = false;
    rows.forEach((row, i) => {
      const isMe =
        !highlighted &&
        me !== null &&
        row.player === me &&
        highlightScore !== undefined &&
        row.score === highlightScore;
      if (isMe) highlighted = true;
      this.listEl.append(this.buildRow(gameId, row, i + 1, isMe, variant));
    });
  }

  private buildRow(
    gameId: string,
    row: ScoreRow,
    rank: number,
    isMe: boolean,
    variant: string | undefined,
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "mg-lb__row" + (isMe ? " mg-lb__row--me" : "");

    const rankEl = document.createElement("span");
    rankEl.className = "mg-lb__rank";
    rankEl.textContent = String(rank);

    const nameEl = document.createElement("span");
    nameEl.className = "mg-lb__name";
    nameEl.textContent = row.player;

    const valueEl = document.createElement("span");
    valueEl.className = "mg-lb__value";
    valueEl.textContent = formatScore(gameId, row.score, variant);

    li.append(rankEl, nameEl, valueEl);
    return li;
  }

  private onSubmitName = (e: Event): void => {
    e.preventDefault();
    if (!this.pending) return;
    const saved = setNickname(this.inputEl.value);
    if (!saved) {
      this.inputEl.focus();
      return;
    }
    const { gameId, score, variant } = this.pending;
    this.pending = null;
    this.formEl.style.display = "none";
    void submitScore(gameId, score, { variant }).then(() =>
      this.renderList(gameId, variant, score),
    );
  };
}
