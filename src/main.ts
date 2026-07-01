import "./style.css";
import { games } from "./games";

const app = document.querySelector<HTMLDivElement>("#app")!;

const header = document.createElement("header");
header.className = "menu__header";
header.innerHTML = `
  <h1 class="menu__title">MiniGames</h1>
  <p class="menu__subtitle">Elegí un juego para empezar</p>
`;

const grid = document.createElement("div");
grid.className = "menu__grid";

games.forEach((game, i) => {
  const card = document.createElement("a");
  card.className = "card";
  card.href = game.path;
  card.style.setProperty("--i", String(i));
  if (game.accent) card.style.setProperty("--accent", game.accent);
  card.innerHTML = `
    <span class="card__index">${String(i + 1).padStart(2, "0")}</span>
    <div class="card__info">
      <h2 class="card__title">${game.title}</h2>
      <p class="card__description">${game.description}</p>
      <span class="card__cta">Jugar<span class="card__arrow">&rarr;</span></span>
    </div>
  `;
  grid.append(card);
});

const footer = document.createElement("footer");
footer.className = "menu__footer";
footer.textContent = `${games.length} ${games.length === 1 ? "juego" : "juegos"} disponibles`;

app.append(header, grid, footer);
