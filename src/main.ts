import "./style.css";
import { games, coverUrl, type GameEntry } from "./games";
import { LeaderboardPanel } from "./shared/LeaderboardPanel";
import { getScoring } from "./shared/scoring";
import { isLeaderboardEnabled } from "./shared/supabase";

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

// ---------- Grilla de juegos ----------

const grid = document.createElement("div");
grid.className = "grid";

games.forEach((game, i) => {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = game.path;
  card.style.setProperty("--i", String(i));
  if (game.accent) card.style.setProperty("--accent", game.accent);
  card.dataset.category = game.category;
  card.dataset.search = `${game.title} ${game.description}`.toLowerCase();

  // El recuadro es solo la portada (con categoria y ranking como chips
  // superpuestos); el nombre del juego va debajo, fuera del recuadro.
  card.innerHTML = `
    <div class="game-card__cover">
      <div class="game-card__fallback"></div>
      <span class="game-card__tag">${game.category}</span>
    </div>
    <h2 class="game-card__name">${game.title}</h2>
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
  }

  grid.append(card);
});

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
      <div class="site-footer__coin"><span class="site-footer__coin-dot"></span>HECHO PARA JUGAR</div>
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
main.append(hero, filters);
if (roomsOn) main.append(roomsBanner);
main.append(grid, empty);
app.append(nav, main, footer);

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

  if (scoring.variants && scoring.variants.length > 0) {
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
    variantBar.style.display = "none";
    void modalPanel.render(game.id, {});
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
