import "./style.css";
import { games, coverUrl } from "../games";
import { isLeaderboardEnabled } from "../shared/supabase";
import { getNickname, setNickname, NICKNAME_MAX } from "../shared/nickname";
import {
  createRoom,
  fetchRoomState,
  joinRoom,
  sanitizeCode,
  startRound,
  updateSettings,
} from "../shared/room/api";
import { RoomChannel } from "../shared/room/channel";
import { computeRoundDeadline, randomGameId, roomGameUrl } from "../shared/room/roomMode";
import {
  DEFAULT_ROUND_TIME_LIMIT,
  DEFAULT_TOTAL_ROUNDS,
  ROUND_TIME_LIMIT_OPTIONS,
  TOTAL_ROUNDS_OPTIONS,
  type RoomSettings,
  type RoomState,
} from "../shared/room/types";

/**
 * Pagina de salas: elegir nombre, crear una sala (ajustes) o unirse por codigo
 * o link (/rooms/?code=XXXXXX), y el lobby previo a la primera ronda. Cuando el
 * host arranca, todos navegan a /games/<id>/?room=CODE y el resto del flujo lo
 * maneja src/shared/room/roomMode.ts dentro de cada juego.
 */

const app = document.querySelector<HTMLDivElement>("#app")!;

const topbar = document.createElement("nav");
topbar.className = "topbar";
topbar.innerHTML = `
  <a class="topbar__logo" href="/"><img src="/juegachos.png" alt="JUEGACHOS" /></a>
  <div class="topbar__links">
    <a href="/">Juegos</a>
    <a href="/rooms/" class="is-active">Salas</a>
  </div>
`;

const header = document.createElement("header");
header.className = "rooms__header";
header.innerHTML = `
  <span class="rooms__kicker">Modo salas</span>
  <h1 class="rooms__title">Jugá con amigos</h1>
  <p class="rooms__subtitle">Mismos juegos, misma sala, un solo ganador.</p>
`;

const stack = document.createElement("div");
stack.className = "rooms__stack";

const main = document.createElement("main");
main.className = "rooms";
main.append(header, stack);

app.append(topbar, main);

const prefillCode = sanitizeCode(new URLSearchParams(location.search).get("code") ?? "");

if (!isLeaderboardEnabled()) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="panel__title">No disponible</div>
    <p class="hint">Las salas necesitan la configuracion de Supabase (las mismas credenciales del ranking global). Sin eso, los juegos siguen funcionando solos desde el menu.</p>
  `;
  stack.append(panel);
} else if (prefillCode && getNickname()) {
  // Llegada con codigo y nombre ya elegido (link compartido, rejoin, o vuelta
  // al lobby tras "Jugar otra vez"): entrar directo sin apretar Unirse.
  void autoJoin(prefillCode, getNickname()!);
} else {
  renderHome();
}

async function autoJoin(code: string, player: string): Promise<void> {
  stack.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="panel__title">Sala ${code}</div>
    <p class="hint">Entrando a la sala...</p>
  `;
  stack.append(panel);

  // Sin chequeo de presence: el redirect viene de la propia sala y la
  // presencia vieja de la pagina anterior tarda unos segundos en caerse.
  const problem = await joinFlow(code, player, { presenceCheck: false });
  if (problem) renderHome(problem);
}

// ---------- Home: nombre + crear / unirse ----------

function renderHome(joinProblem?: string): void {
  stack.innerHTML = "";

  // Nombre del jugador (mismo nickname del ranking global).
  const namePanel = document.createElement("div");
  namePanel.className = "panel";
  namePanel.innerHTML = `<div class="panel__title">Tu nombre</div>`;
  const nameRow = document.createElement("div");
  nameRow.className = "panel__row";
  const nameInput = document.createElement("input");
  nameInput.className = "input";
  nameInput.type = "text";
  nameInput.maxLength = NICKNAME_MAX;
  nameInput.placeholder = "Tu nombre (1-12)";
  nameInput.autocomplete = "off";
  nameInput.value = getNickname() ?? "";
  nameRow.append(nameInput);
  namePanel.append(nameRow);

  const requireName = (): string | null => {
    const saved = setNickname(nameInput.value);
    if (!saved) nameInput.focus();
    return saved;
  };

  // Unirse a una sala existente.
  const joinPanel = document.createElement("div");
  joinPanel.className = "panel";
  joinPanel.innerHTML = `<div class="panel__title">Unirse a una sala</div>`;
  const joinRow = document.createElement("div");
  joinRow.className = "panel__row";
  const codeInput = document.createElement("input");
  codeInput.className = "input input--code";
  codeInput.type = "text";
  codeInput.maxLength = 6;
  codeInput.placeholder = "CODIGO";
  codeInput.autocomplete = "off";
  if (prefillCode) codeInput.value = prefillCode;
  const joinBtn = document.createElement("button");
  joinBtn.className = "btn";
  joinBtn.type = "button";
  joinBtn.textContent = "Unirse";
  joinRow.append(codeInput, joinBtn);
  const joinError = document.createElement("div");
  joinError.className = "error";
  if (joinProblem) joinError.textContent = joinProblem;
  joinPanel.append(joinRow, joinError);

  const tryJoin = async (): Promise<void> => {
    joinError.textContent = "";
    const player = requireName();
    if (!player) return;
    const code = sanitizeCode(codeInput.value);
    if (!code) {
      joinError.textContent = "Codigo invalido (6 letras/numeros).";
      return;
    }
    joinBtn.disabled = true;
    const problem = await joinFlow(code, player);
    joinBtn.disabled = false;
    if (problem) joinError.textContent = problem;
  };
  joinBtn.addEventListener("click", () => void tryJoin());
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void tryJoin();
  });

  // Crear una sala nueva.
  const createPanel = document.createElement("div");
  createPanel.className = "panel";
  createPanel.innerHTML = `<div class="panel__title">Crear una sala</div>`;

  let settings: RoomSettings = {
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    playlist: null,
    roundTimeLimitSec: DEFAULT_ROUND_TIME_LIMIT,
  };
  const settingsForm = buildSettingsForm(settings, (s) => (settings = s));

  const createBtn = document.createElement("button");
  createBtn.className = "btn btn--primary";
  createBtn.type = "button";
  createBtn.textContent = "Crear sala";
  const createError = document.createElement("div");
  createError.className = "error";

  createBtn.addEventListener("click", () => {
    void (async () => {
      createError.textContent = "";
      const player = requireName();
      if (!player) return;
      createBtn.disabled = true;
      const code = await createRoom(player, settings);
      createBtn.disabled = false;
      if (!code) {
        createError.textContent = "No se pudo crear la sala. Proba de nuevo.";
        return;
      }
      renderLobby(code, player);
    })();
  });

  createPanel.append(settingsForm, createBtn, createError);

  stack.append(namePanel, joinPanel, createPanel);
  if (prefillCode) codeInput.focus();
}

/**
 * Formulario de ajustes de sala (rondas / tope de tiempo / playlist opcional).
 * Reutilizado al crear y en el lobby (el host puede cambiar los juegos antes
 * de cada partida, incluida la revancha). Emite settings ya normalizados:
 * con playlist, totalRounds = playlist.length.
 */
function buildSettingsForm(
  initial: RoomSettings,
  onChange: (settings: RoomSettings) => void,
): HTMLDivElement {
  const wrap = document.createElement("div");

  let totalRounds: number = (TOTAL_ROUNDS_OPTIONS as readonly number[]).includes(
    initial.totalRounds,
  )
    ? initial.totalRounds
    : DEFAULT_TOTAL_ROUNDS;
  let timeLimit: number = initial.roundTimeLimitSec;
  const playlist: string[] = initial.playlist ? [...initial.playlist] : [];

  const emit = (): void => {
    onChange({
      totalRounds: playlist.length > 0 ? playlist.length : totalRounds,
      playlist: playlist.length > 0 ? [...playlist] : null,
      roundTimeLimitSec: timeLimit,
    });
  };

  const roundsLabel = document.createElement("div");
  roundsLabel.className = "panel__label";
  roundsLabel.textContent = "Cantidad de juegos";
  const roundsChoices = buildChoices(
    TOTAL_ROUNDS_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    totalRounds,
    (v) => {
      totalRounds = v;
      emit();
    },
  );

  const timeLabel = document.createElement("div");
  timeLabel.className = "panel__label";
  timeLabel.textContent = "Tope de tiempo por juego";
  const timeChoices = buildChoices(
    ROUND_TIME_LIMIT_OPTIONS.map((n) => ({ value: n, label: `${n / 60} min` })),
    timeLimit,
    (v) => {
      timeLimit = v;
      emit();
    },
  );

  const playlistLabel = document.createElement("div");
  playlistLabel.className = "panel__label";
  playlistLabel.textContent = "Elegir los juegos (opcional)";
  const playlistGrid = document.createElement("div");
  playlistGrid.className = "playlist";

  const refreshPlaylistUI = (): void => {
    playlistGrid.querySelectorAll<HTMLButtonElement>(".playlist__item").forEach((btn) => {
      const idx = playlist.indexOf(btn.dataset.id!);
      btn.classList.toggle("is-picked", idx >= 0);
      const badge = btn.querySelector<HTMLElement>(".playlist__order")!;
      badge.style.display = idx >= 0 ? "" : "none";
      badge.textContent = String(idx + 1);
    });
    const hasPlaylist = playlist.length > 0;
    roundsLabel.style.display = hasPlaylist ? "none" : "";
    roundsChoices.style.display = hasPlaylist ? "none" : "";
  };

  for (const game of games) {
    const btn = document.createElement("button");
    btn.className = "playlist__item";
    btn.type = "button";
    btn.dataset.id = game.id;
    if (game.accent) btn.style.setProperty("--game-accent", game.accent);
    btn.innerHTML = `
      <span class="playlist__cover">
        <span class="playlist__order" style="display:none"></span>
      </span>
      <span class="playlist__name">${game.title}</span>
    `;
    // Mini portada del juego (la misma de la landing); si falta, queda el
    // fondo con el color del juego.
    const img = document.createElement("img");
    img.src = coverUrl(game.id);
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    btn.querySelector(".playlist__cover")!.prepend(img);
    btn.addEventListener("click", () => {
      const idx = playlist.indexOf(game.id);
      if (idx >= 0) playlist.splice(idx, 1);
      else playlist.push(game.id);
      refreshPlaylistUI();
      emit();
    });
    playlistGrid.append(btn);
  }
  refreshPlaylistUI();

  const playlistHint = document.createElement("p");
  playlistHint.className = "hint";
  playlistHint.textContent =
    "Si elegis juegos, salen en ese orden. Si no elegis ninguno, despues de cada juego se vota el siguiente entre 3 al azar.";

  wrap.append(roundsLabel, roundsChoices, timeLabel, timeChoices, playlistLabel, playlistGrid, playlistHint);
  return wrap;
}

function buildChoices<T extends number>(
  options: { value: T; label: string }[],
  initial: T,
  onPick: (value: T) => void,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "choices";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "choice" + (opt.value === initial ? " is-active" : "");
    btn.type = "button";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".choice").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      onPick(opt.value);
    });
    wrap.append(btn);
  }
  return wrap;
}

// ---------- Unirse (con chequeo de nick ya conectado) ----------

/** Devuelve un mensaje de error, o null si el join siguio de largo. */
async function joinFlow(
  code: string,
  player: string,
  opts: { presenceCheck?: boolean } = {},
): Promise<string | null> {
  const state = await fetchRoomState(code);
  if (!state) return "La sala no existe.";
  // Una sala terminada sigue viva ("Jugar otra vez"): los registrados pueden
  // reentrar al tablero final; los nuevos esperan a que vuelva al lobby.
  if (state.room.status === "finished" && !state.players.includes(player)) {
    return "Esa sala ya termino.";
  }

  // Nick ya registrado: es rejoin valido solo si nadie mas esta conectado con
  // ese nombre (presence). Dos amigos con igual nick serian la misma identidad.
  if ((opts.presenceCheck ?? true) && state.players.includes(player)) {
    const online = await probePresence(code, player);
    if (online.includes(player)) {
      return "Ese nombre ya esta conectado en la sala. Elegi otro.";
    }
  }

  const result = await joinRoom(code, player);
  if (result === "not-found") return "La sala no existe.";
  if (result === "finished") return "Esa sala ya termino.";
  if (result === "error") return "No se pudo entrar. Proba de nuevo.";

  // Sala ya en juego: rejoin directo a la ronda vigente.
  if (state.room.status !== "lobby" && state.room.current_game) {
    location.href = roomGameUrl(state.room.current_game, code);
    return null;
  }
  renderLobby(code, player);
  return null;
}

/** Mira la presencia del canal sin publicarse (para detectar nicks en uso). */
function probePresence(code: string, player: string): Promise<string[]> {
  return new Promise((resolve) => {
    const probe = new RoomChannel(code, `probe:${player}`, { track: false });
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      const present = probe.presentPlayers();
      probe.dispose();
      resolve(present);
    };
    probe.onPresence(finish);
    window.setTimeout(finish, 1500);
  });
}

// ---------- Lobby ----------

function renderLobby(code: string, player: string): void {
  history.replaceState(null, "", `/rooms/?code=${code}`);
  stack.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<div class="panel__title">Sala</div>`;

  const codeEl = document.createElement("div");
  codeEl.className = "lobby__code";
  codeEl.textContent = code;

  const copyRow = document.createElement("div");
  copyRow.className = "panel__row";
  const copyBtn = document.createElement("button");
  copyBtn.className = "btn";
  copyBtn.type = "button";
  copyBtn.textContent = "Copiar link";
  copyBtn.style.margin = "0 auto";
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(`${location.origin}/rooms/?code=${code}`)
      .then(() => {
        copyBtn.textContent = "Copiado";
        window.setTimeout(() => (copyBtn.textContent = "Copiar link"), 1500);
      });
  });
  copyRow.append(copyBtn);

  const settingsEl = document.createElement("p");
  settingsEl.className = "lobby__settings";

  panel.append(codeEl, copyRow, settingsEl);

  const playersPanel = document.createElement("div");
  playersPanel.className = "panel";
  playersPanel.innerHTML = `<div class="panel__title">Jugadores</div>`;
  const playersList = document.createElement("ul");
  playersList.className = "lobby__players";
  playersPanel.append(playersList);

  const startBtn = document.createElement("button");
  startBtn.className = "btn btn--primary";
  startBtn.type = "button";
  startBtn.textContent = "Empezar";
  startBtn.style.display = "none";

  const waitingEl = document.createElement("div");
  waitingEl.className = "lobby__waiting";

  playersPanel.append(startBtn, waitingEl);
  stack.append(panel, playersPanel);

  const channel = new RoomChannel(code, player);
  let state: RoomState | null = null;
  let starting = false;
  /** Ajustes editados por el host en el lobby (mandan al apretar Empezar). */
  let localSettings: RoomSettings | null = null;
  let settingsUiBuilt = false;

  /** El host ve el formulario editable en lugar del resumen de solo lectura. */
  const buildSettingsUi = (): void => {
    if (settingsUiBuilt || !state) return;
    settingsUiBuilt = true;
    if (state.room.host !== player) return;

    settingsEl.style.display = "none";
    const form = buildSettingsForm(state.room.settings, (s) => {
      localSettings = s;
      // Compartir el cambio al instante para que los demas lo vean en vivo.
      void updateSettings(code, s).then((ok) => {
        if (ok) channel.ping();
      });
    });
    panel.append(form);
  };

  const render = (): void => {
    if (!state) return;
    const room = state.room;
    const settings = localSettings ?? room.settings;
    const present = channel.presentPlayers();
    const isHost = room.host === player;
    buildSettingsUi();

    const playlistText = settings.playlist
      ? settings.playlist
          .map((id) => games.find((g) => g.id === id)?.title ?? id)
          .join(" - ")
      : "se vota despues de cada juego";
    settingsEl.textContent =
      `${settings.totalRounds} ${settings.totalRounds === 1 ? "juego" : "juegos"}` +
      ` - ${Math.round(settings.roundTimeLimitSec / 60)} min por juego - ${playlistText}`;

    playersList.innerHTML = "";
    for (const p of state.players) {
      const li = document.createElement("li");
      li.className = "lobby__player";
      const dot = document.createElement("span");
      dot.className = "lobby__dot" + (present.includes(p) ? " is-online" : "");
      const name = document.createElement("span");
      name.textContent = p + (p === player ? " (vos)" : "");
      li.append(dot, name);
      if (p === room.host) {
        const tag = document.createElement("span");
        tag.className = "lobby__host-tag";
        tag.textContent = "anfitrion";
        li.append(tag);
      }
      playersList.append(li);
    }

    if (isHost) {
      startBtn.style.display = "";
      const enough = present.length >= 2;
      startBtn.disabled = !enough || starting;
      waitingEl.textContent = enough
        ? ""
        : "Se necesitan al menos 2 jugadores conectados para empezar";
    } else {
      startBtn.style.display = "none";
      waitingEl.textContent = "Esperando a que el anfitrion empiece...";
    }
  };

  const refresh = async (): Promise<void> => {
    const fresh = await fetchRoomState(code);
    if (!fresh) return;
    state = fresh;
    // La sala arranco (quiza desde otra pestana del host): todos adentro.
    if (fresh.room.status !== "lobby" && fresh.room.current_game) {
      location.href = roomGameUrl(fresh.room.current_game, code);
      return;
    }
    render();
  };

  channel.onSync(() => void refresh());
  channel.onPresence(render);
  window.setInterval(() => void refresh(), 5000);
  void refresh();

  startBtn.addEventListener("click", () => {
    void (async () => {
      if (!state || starting) return;
      starting = true;
      render();
      const settings = localSettings ?? state.room.settings;
      const firstGame = settings.playlist ? settings.playlist[0] : randomGameId();
      const ok = await startRound(
        code,
        1,
        firstGame,
        computeRoundDeadline(settings.roundTimeLimitSec),
      );
      if (!ok) {
        starting = false;
        render();
        return;
      }
      channel.ping();
      location.href = roomGameUrl(firstGame, code);
    })();
  });
}
