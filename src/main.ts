import "./style.css";
import { games, coverUrl, type GameEntry } from "./games";
import { LeaderboardPanel } from "./shared/LeaderboardPanel";
import { getScoring } from "./shared/scoring";
import { fetchTop } from "./shared/leaderboard";
import { isLeaderboardEnabled } from "./shared/supabase";
import { recordPlay, fetchPlayCounts, cachedPlayCounts } from "./shared/plays";

const app = document.querySelector<HTMLDivElement>("#app")!;
const roomsOn = isLeaderboardEnabled();

// ---------- Barra de navegacion ----------

const nav = document.createElement("nav");
nav.className = "topbar";
nav.innerHTML = `
  <a class="topbar__logo" href="/"><img src="/juegachos.png" alt="JUEGACHOS" /></a>
  <div class="topbar__links">
    <a href="/" class="is-active">Juegos</a>
    ${roomsOn ? `<a href="/rooms/">Salas</a>` : ""}
  </div>
`;

// ---------- Titulo + buscador ----------

const hero = document.createElement("header");
hero.className = "hero";
hero.innerHTML = `
  <h1 class="hero__title">Todos los juegos</h1>
  <label class="hero__search">
    <input type="search" placeholder="Buscar" autocomplete="off" />
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
    </svg>
  </label>
`;
const searchInput = hero.querySelector<HTMLInputElement>("input")!;

// ---------- Filtros por categoria ----------

const categories = ["Todos", ...new Set(games.map((g) => g.category))];
let activeCategory = "Todos";

const filters = document.createElement("div");
filters.className = "filters";
for (const cat of categories) {
  const btn = document.createElement("button");
  btn.className = "filters__pill" + (cat === activeCategory ? " is-active" : "");
  btn.type = "button";
  btn.textContent = cat;
  btn.addEventListener("click", () => {
    activeCategory = cat;
    filters.querySelectorAll(".filters__pill").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    applyFilters();
  });
  filters.append(btn);
}

// ---------- Control de orden ----------

// Orden de las cards, elegible desde el control de la barra de filtros:
//   - "popular"  (default): mas jugados primero (conteo de partidas).
//   - "featured": el orden manual por `order` de cada meta.ts.
//   - "alpha":    alfabetico por titulo.
// El modo "popular" arranca con el conteo cacheado (sin parpadeo) y se refresca
// desde Supabase al terminar de montar. El sort es estable, asi que los empates
// conservan el orden base de games.ts (por `order`).
const cardById = new Map<string, HTMLElement>();
type SortMode = "popular" | "featured" | "alpha";
const SORT_KEY = "mg:sort";
let sortMode: SortMode = readSortMode();
let playCounts = cachedPlayCounts();

const sortControl = document.createElement("div");
sortControl.className = "sort";

const sortLabel = document.createElement("span");
sortLabel.className = "sort__label";
sortLabel.textContent = "Ordenar";

// Dropdown propio (no un <select> nativo, cuya lista la dibuja el SO y no se
// puede tematizar): un boton disparador + un menu con el estilo del sitio.
const SORT_LABELS: Record<SortMode, string> = {
  popular: "Populares",
  featured: "Destacados",
  alpha: "A-Z",
};
const SORT_ORDER: SortMode[] = ["popular", "featured", "alpha"];

const sortDropdown = document.createElement("div");
sortDropdown.className = "sort__dropdown";

const sortTrigger = document.createElement("button");
sortTrigger.type = "button";
sortTrigger.className = "sort__trigger";
sortTrigger.setAttribute("aria-haspopup", "listbox");
sortTrigger.setAttribute("aria-expanded", "false");
sortTrigger.innerHTML = `
  <span class="sort__current">${SORT_LABELS[sortMode]}</span>
  <svg class="sort__chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
`;
const sortCurrent = sortTrigger.querySelector(".sort__current")!;

const sortMenu = document.createElement("div");
sortMenu.className = "sort__menu";
sortMenu.setAttribute("role", "listbox");
const sortOptions = new Map<SortMode, HTMLButtonElement>();
for (const mode of SORT_ORDER) {
  const opt = document.createElement("button");
  opt.type = "button";
  opt.className = "sort__option" + (mode === sortMode ? " is-active" : "");
  opt.setAttribute("role", "option");
  opt.setAttribute("aria-selected", String(mode === sortMode));
  opt.textContent = SORT_LABELS[mode];
  opt.addEventListener("click", () => {
    selectSort(mode);
    closeSortMenu();
  });
  sortOptions.set(mode, opt);
  sortMenu.append(opt);
}

function openSortMenu(): void {
  sortDropdown.classList.add("is-open");
  sortTrigger.setAttribute("aria-expanded", "true");
  document.addEventListener("click", onDocClickForSort);
  document.addEventListener("keydown", onKeydownForSort);
}
function closeSortMenu(): void {
  sortDropdown.classList.remove("is-open");
  sortTrigger.setAttribute("aria-expanded", "false");
  document.removeEventListener("click", onDocClickForSort);
  document.removeEventListener("keydown", onKeydownForSort);
}
function onDocClickForSort(e: MouseEvent): void {
  if (!sortDropdown.contains(e.target as Node)) closeSortMenu();
}
function onKeydownForSort(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    closeSortMenu();
    sortTrigger.focus();
  }
}
function selectSort(mode: SortMode): void {
  if (mode !== sortMode) {
    sortMode = mode;
    try {
      localStorage.setItem(SORT_KEY, mode);
    } catch {
      // ignore
    }
    applyOrder();
  }
  sortCurrent.textContent = SORT_LABELS[mode];
  for (const [m, el] of sortOptions) {
    const active = m === mode;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-selected", String(active));
  }
}

sortTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  if (sortDropdown.classList.contains("is-open")) closeSortMenu();
  else openSortMenu();
});

sortDropdown.append(sortTrigger, sortMenu);
sortControl.append(sortLabel, sortDropdown);

// Barra que alinea los filtros de categoria (izquierda) con el orden (derecha).
const filtersBar = document.createElement("div");
filtersBar.className = "filters-bar";
filtersBar.append(filters, sortControl);

// ---------- Grilla de juegos ----------

const grid = document.createElement("div");
grid.className = "grid";

function readSortMode(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY);
    if (v === "popular" || v === "featured" || v === "alpha") return v;
  } catch {
    // ignore
  }
  return "popular";
}

function orderedGames(): GameEntry[] {
  if (sortMode === "alpha") {
    return [...games].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortMode === "featured") {
    return [...games]; // games.ts ya viene ordenado por `order`
  }
  return [...games].sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0));
}

orderedGames().forEach((game, i) => {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = game.path;
  card.style.setProperty("--i", String(i));
  if (game.accent) card.style.setProperty("--accent", game.accent);
  card.dataset.category = game.category;
  card.dataset.search = `${game.title} ${game.description}`.toLowerCase();

  // Suma una partida al contador de popularidad al abrir el juego. Se ignora el
  // clic-medio / nueva pestana y el boton de ranking (que frena la propagacion).
  card.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    recordPlay(game.id);
  });

  // El recuadro es solo la portada (con categoria y ranking como chips
  // superpuestos); el nombre del juego va debajo, fuera del recuadro.
  card.innerHTML = `
    <div class="game-card__cover">
      <div class="game-card__fallback"></div>
      <span class="game-card__tag">${game.category}</span>
    </div>
    <div class="game-card__head">
      <h2 class="game-card__name">${game.title}</h2>
      <span class="game-card__champ" hidden></span>
    </div>
  `;

  // Portada generada por IA; si el archivo no existe queda el fallback.
  const img = document.createElement("img");
  img.className = "game-card__img";
  img.src = coverUrl(game.id);
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => img.remove());
  card.querySelector(".game-card__cover")!.append(img);

  if (roomsOn) {
    const rankBtn = document.createElement("button");
    rankBtn.className = "game-card__ranking";
    rankBtn.type = "button";
    rankBtn.textContent = "Ranking";
    rankBtn.addEventListener("click", (e) => {
      // El card es un <a>; evitar que el clic navegue al juego.
      e.preventDefault();
      e.stopPropagation();
      openRankingModal(game);
    });
    card.querySelector(".game-card__cover")!.append(rankBtn);

    const champEl = card.querySelector<HTMLElement>(".game-card__champ")!;
    void loadChampion(game, champEl);
  }

  grid.append(card);
  cardById.set(game.id, card);
});

// Muestra al lider (Top 1) del ranking global junto al nombre del juego.
async function loadChampion(game: GameEntry, el: HTMLElement): Promise<void> {
  const scoring = getScoring(game.id);
  const variant = scoring.variants?.[0];
  const [top] = await fetchTop(game.id, { variant, limit: 1 });
  if (!top) return;

  el.innerHTML = `
    <svg class="game-card__crown" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7zm2 14h14v2H5v-2z" />
    </svg>
  `;
  const name = document.createElement("span");
  name.className = "game-card__champ-name";
  name.textContent = top.player;
  el.append(name);
  el.hidden = false;
}

// Banner destacado de salas multijugador, entre los filtros y la grilla.
const roomsBanner = document.createElement("a");
if (roomsOn) {
  roomsBanner.className = "rooms-banner";
  roomsBanner.href = "/rooms/";
  roomsBanner.innerHTML = `
    <div class="rooms-banner__glow"></div>
    <div class="rooms-banner__text">
      <span class="rooms-banner__kicker">Modo salas</span>
      <h2 class="rooms-banner__title">&iexcl;Jug&aacute; con amigos!</h2>
      <p class="rooms-banner__subtitle">Cre&aacute; una sala, compart&iacute; el c&oacute;digo y compitan ronda a ronda por el mejor puntaje.</p>
    </div>
    <span class="rooms-banner__cta">Crear sala <span class="rooms-banner__arrow">&rarr;</span></span>
  `;

  // Fondo ilustrado del banner; si el archivo no existe queda el glow solo.
  const bg = document.createElement("img");
  bg.className = "rooms-banner__bg";
  bg.src = "/covers/rooms-banner.jpg";
  bg.alt = "";
  bg.loading = "lazy";
  const scrim = document.createElement("div");
  scrim.className = "rooms-banner__scrim";
  bg.addEventListener("error", () => {
    bg.remove();
    scrim.remove();
  });
  roomsBanner.querySelector(".rooms-banner__glow")!.after(bg, scrim);
}

const empty = document.createElement("p");
empty.className = "grid__empty";
empty.textContent = "Ningún juego coincide con la búsqueda.";
empty.style.display = "none";

function applyFilters(): void {
  const term = searchInput.value.trim().toLowerCase();
  let visible = 0;
  grid.querySelectorAll<HTMLAnchorElement>(".game-card").forEach((card) => {
    const matchesCategory =
      activeCategory === "Todos" ||
      card.dataset.category === activeCategory ||
      card.dataset.category === "*";
    const matchesTerm = !term || (card.dataset.search ?? "").includes(term);
    const show = matchesCategory && matchesTerm;
    card.style.display = show ? "" : "none";
    if (show) visible++;
  });
  empty.style.display = visible === 0 ? "" : "none";
}

searchInput.addEventListener("input", applyFilters);

// ---------- Footer ----------

const footer = document.createElement("footer");
footer.className = "site-footer";
footer.innerHTML = `
  <div class="site-footer__strip"></div>
  <div class="site-footer__ghost" aria-hidden="true">JUEGACHOS</div>
  <div class="site-footer__main">
    <div class="site-footer__left">
      <img class="site-footer__logo" src="/juegachos.png" alt="JUEGACHOS" />
      <p class="site-footer__blurb">
        Minijuegos arcade para el navegador: jugá solo por el récord
        o armá una sala y competí con amigos.
      </p>
      <div class="site-footer__meta">
        <div class="site-footer__coin"><span class="site-footer__coin-dot"></span>HECHO PARA JUGAR</div>
        <a href="https://github.com/Facu-Basualdo/MiniGames" target="_blank" rel="noopener noreferrer" class="site-footer__git" aria-label="GitHub Repository">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          <span>GITHUB</span>
        </a>
      </div>
    </div>
    <nav class="site-footer__links" aria-label="Navegación del pie">
      <span class="site-footer__links-title">Navegar</span>
      <a href="/">Juegos<span class="site-footer__arrow">&rarr;</span></a>
      ${roomsOn ? `<a href="/rooms/">Salas<span class="site-footer__arrow">&rarr;</span></a>` : ""}
    </nav>
  </div>
  <div class="site-footer__bottom">
    <span>© ${new Date().getFullYear()} JUEGACHOS</span>
    <span class="site-footer__score">${games.length} JUEGOS Y CONTANDO</span>
  </div>
`;

const main = document.createElement("main");
main.className = "page";
main.append(hero, filtersBar);
if (roomsOn) main.append(roomsBanner);
main.append(grid, empty);

app.append(nav, main, footer);

// Reordena las cards segun el modo actual: mueve los nodos existentes al nuevo
// orden (no los recrea) y refresca el stagger `--i`.
function applyOrder(): void {
  orderedGames().forEach((game, i) => {
    const card = cardById.get(game.id);
    if (!card) return;
    card.style.setProperty("--i", String(i));
    grid.append(card); // re-inserta el nodo existente en la nueva posicion
  });
}

// Trae los conteos reales de Supabase; si el orden activo es por popularidad,
// reordena con los datos frescos. No-op sin credenciales.
void fetchPlayCounts().then((counts) => {
  playCounts = counts;
  if (sortMode === "popular") applyOrder();
});

// ---------- Ranking modal (solo lectura) ----------

const modalPanel = new LeaderboardPanel();
let modalEl: HTMLDivElement | null = null;

function buildModal(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "rank-modal";

  const box = document.createElement("div");
  box.className = "rank-modal__box";

  const head = document.createElement("div");
  head.className = "rank-modal__head";

  const titleEl = document.createElement("h3");
  titleEl.className = "rank-modal__title";

  const closeBtn = document.createElement("button");
  closeBtn.className = "rank-modal__close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Cerrar");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeRankingModal);

  head.append(titleEl, closeBtn);

  const variantBar = document.createElement("div");
  variantBar.className = "rank-modal__variants";

  box.append(head, variantBar);
  modalPanel.mount(box);
  overlay.append(box);

  // Cerrar al hacer clic fuera de la caja.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeRankingModal();
  });

  document.body.append(overlay);
  return overlay;
}

function openRankingModal(game: GameEntry): void {
  if (!modalEl) modalEl = buildModal();

  const titleEl = modalEl.querySelector<HTMLElement>(".rank-modal__title")!;
  const variantBar = modalEl.querySelector<HTMLElement>(".rank-modal__variants")!;
  titleEl.textContent = game.title;

  const scoring = getScoring(game.id);
  variantBar.innerHTML = "";

  if (scoring.variants && scoring.variants.length > 1) {
    variantBar.style.display = "flex";
    scoring.variants.forEach((variant, idx) => {
      const btn = document.createElement("button");
      btn.className = "rank-modal__variant" + (idx === 0 ? " is-active" : "");
      btn.type = "button";
      btn.textContent = scoring.variantLabel ? scoring.variantLabel(variant) : variant;
      btn.addEventListener("click", () => {
        variantBar.querySelectorAll(".rank-modal__variant").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        void modalPanel.render(game.id, { variant });
      });
      variantBar.append(btn);
    });
    void modalPanel.render(game.id, { variant: scoring.variants[0] });
  } else {
    // Sin variantes, o una sola (p.ej. memory-match "solo"): sin barra de tabs.
    variantBar.style.display = "none";
    void modalPanel.render(game.id, { variant: scoring.variants?.[0] });
  }

  modalEl.classList.add("is-open");
  document.addEventListener("keydown", onModalKeydown);
}

function closeRankingModal(): void {
  if (!modalEl) return;
  modalEl.classList.remove("is-open");
  document.removeEventListener("keydown", onModalKeydown);
}

function onModalKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeRankingModal();
}
