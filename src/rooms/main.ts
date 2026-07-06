import "./style.css";
import { games, coverUrl } from "../games";
import { isLeaderboardEnabled } from "../shared/supabase";
import { getNickname, setNickname, NICKNAME_MAX } from "../shared/nickname";
import {
  createRoom,
  fetchRoomState,
  joinRoom,
  kickPlayer,
  sanitizeCode,
  startRound,
  startTimeVote,
  updateSettings,
} from "../shared/room/api";
import { RoomChannel } from "../shared/room/channel";
import {
  computeRoundDeadline,
  randomGameId,
  roomGameUrl,
  timeVoteOptionIds,
  VOTE_SECONDS,
} from "../shared/room/roomMode";
import {
  DEFAULT_ROUND_TIME_LIMIT,
  DEFAULT_TOTAL_ROUNDS,
  formatRoundTimeLimit,
  MAX_ROOM_PLAYERS,
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

// ---------- Home: nombre + unirse + boton para crear ----------

function renderHome(joinProblem?: string): void {
  stack.innerHTML = "";
  main.classList.remove("rooms--wide");

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

  // Boton para pasar a la pantalla de crear una sala.
  const createPanel = document.createElement("div");
  createPanel.className = "panel";
  createPanel.innerHTML = `
    <div class="panel__title">Crear una sala</div>
    <p class="hint">Armá una sala nueva y compartí el código con tus amigos.</p>
  `;
  const createBtn = document.createElement("button");
  createBtn.className = "btn btn--primary";
  createBtn.type = "button";
  createBtn.textContent = "Crear sala";
  createBtn.addEventListener("click", () => {
    const player = requireName();
    if (!player) return;
    renderCreate();
  });
  createPanel.append(createBtn);

  stack.append(namePanel, joinPanel, createPanel);
  if (prefillCode) codeInput.focus();
}

// ---------- Crear una sala: ajustes + crear ----------

function renderCreate(): void {
  stack.innerHTML = "";
  main.classList.remove("rooms--wide");

  const createPanel = document.createElement("div");
  createPanel.className = "panel";
  createPanel.innerHTML = `<div class="panel__title">Crear una sala</div>`;

  let settings: RoomSettings = {
    totalRounds: DEFAULT_TOTAL_ROUNDS,
    playlist: null,
    roundTimeLimitSec: DEFAULT_ROUND_TIME_LIMIT,
    timeVote: false,
  };
  const settingsForm = buildSettingsForm(settings, (s) => (settings = s));

  const actions = document.createElement("div");
  actions.className = "panel__row rooms__create-actions";
  const backBtn = document.createElement("button");
  backBtn.className = "btn";
  backBtn.type = "button";
  backBtn.textContent = "Volver";
  backBtn.addEventListener("click", () => renderHome());
  const createBtn = document.createElement("button");
  createBtn.className = "btn btn--primary";
  createBtn.type = "button";
  createBtn.textContent = "Crear sala";
  actions.append(backBtn, createBtn);

  const createError = document.createElement("div");
  createError.className = "error";

  createBtn.addEventListener("click", () => {
    void (async () => {
      createError.textContent = "";
      const player = getNickname();
      if (!player) {
        renderHome();
        return;
      }
      // O elegís todos los juegos de la lista, o ninguno (se votan al azar).
      if (settings.playlist && settings.playlist.length !== settings.totalRounds) {
        createError.textContent = `Elegí ${settings.totalRounds} juegos o ninguno.`;
        return;
      }
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

  createPanel.append(settingsForm, actions, createError);
  stack.append(createPanel);
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
  let timeVote: boolean = initial.timeVote ?? false;
  const playlist: string[] = initial.playlist ? [...initial.playlist] : [];

  // La cantidad elegida arriba manda: es el tope de juegos que se pueden
  // seleccionar. Con la lista completa (== totalRounds) salen esos en orden;
  // vacia, se votan al azar. Parcial se bloquea al crear.
  const emit = (): void => {
    onChange({
      totalRounds,
      playlist: playlist.length > 0 ? [...playlist] : null,
      roundTimeLimitSec: timeLimit,
      timeVote,
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
      // Si ya se habian elegido mas juegos que el nuevo tope, recortar.
      if (playlist.length > totalRounds) playlist.length = totalRounds;
      refreshPlaylistUI();
      emit();
    },
  );

  // Votar el tope de tiempo antes de cada juego (en vez de un tope fijo).
  const timeVoteLabel = document.createElement("div");
  timeVoteLabel.className = "panel__label";
  timeVoteLabel.textContent = "Votar el tiempo antes de cada juego";
  const timeVoteChoices = buildChoices(
    [
      { value: 0, label: "No" },
      { value: 1, label: "Si" },
    ],
    timeVote ? 1 : 0,
    (v) => {
      timeVote = v === 1;
      applyTimeVoteUI();
      emit();
    },
  );

  // Selector de tope fijo, solo cuando NO se vota el tiempo.
  const timeSelector = document.createElement("div");
  const timeLabel = document.createElement("div");
  timeLabel.className = "panel__label";
  timeLabel.textContent = "Tope de tiempo por juego";
  const timeChoices = buildChoices(
    ROUND_TIME_LIMIT_OPTIONS.map((n) => ({ value: n, label: formatRoundTimeLimit(n) })),
    timeLimit,
    (v) => {
      timeLimit = v;
      emit();
    },
  );
  timeSelector.append(timeLabel, timeChoices);

  const timeVoteHint = document.createElement("p");
  timeVoteHint.className = "hint";
  timeVoteHint.textContent =
    "Antes de cada juego los jugadores votan el tope entre 1 y 5 minutos o sin limite.";

  const applyTimeVoteUI = (): void => {
    timeSelector.style.display = timeVote ? "none" : "";
    timeVoteHint.style.display = timeVote ? "" : "none";
  };
  applyTimeVoteUI();

  const playlistLabel = document.createElement("div");
  playlistLabel.className = "panel__label";
  playlistLabel.textContent = "Elegir los juegos (opcional)";
  const playlistGrid = document.createElement("div");
  playlistGrid.className = "playlist";

  const refreshPlaylistUI = (): void => {
    const atCap = playlist.length >= totalRounds;
    playlistGrid.querySelectorAll<HTMLButtonElement>(".playlist__item").forEach((btn) => {
      const idx = playlist.indexOf(btn.dataset.id!);
      const picked = idx >= 0;
      btn.classList.toggle("is-picked", picked);
      // Al llegar al tope no se pueden agregar mas; los ya elegidos siguen
      // clickeables para poder sacarlos.
      btn.classList.toggle("is-disabled", !picked && atCap);
      const badge = btn.querySelector<HTMLElement>(".playlist__order")!;
      badge.style.display = picked ? "" : "none";
      badge.textContent = String(idx + 1);
    });
    playlistLabel.textContent =
      playlist.length > 0
        ? `Elegir los juegos (${playlist.length}/${totalRounds})`
        : "Elegir los juegos (opcional)";
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
      if (idx >= 0) {
        playlist.splice(idx, 1);
      } else {
        // No permitir elegir mas juegos que la cantidad marcada arriba.
        if (playlist.length >= totalRounds) return;
        playlist.push(game.id);
      }
      refreshPlaylistUI();
      emit();
    });
    playlistGrid.append(btn);
  }
  refreshPlaylistUI();

  const playlistHint = document.createElement("p");
  playlistHint.className = "hint";
  playlistHint.textContent =
    "Elegi en orden la misma cantidad de juegos que marcaste arriba. Si no elegis ninguno, despues de cada juego se vota el siguiente entre 3 al azar.";

  wrap.append(
    roundsLabel,
    roundsChoices,
    timeVoteLabel,
    timeVoteChoices,
    timeSelector,
    timeVoteHint,
    playlistLabel,
    playlistGrid,
    playlistHint,
  );
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
  const registered = state.players.includes(player);
  // Una sala terminada sigue viva ("Jugar otra vez"): los registrados pueden
  // reentrar al tablero final; los nuevos esperan a que vuelva al lobby.
  if (state.room.status === "finished" && !registered) {
    return "Esa sala ya termino.";
  }
  // Partida en curso y jugador nuevo: entra como espectador (no se registra ni
  // ocupa slot), solo mira hasta que termine. Va directo a la ronda vigente.
  if (state.room.status !== "lobby" && state.room.status !== "finished" && !registered) {
    if (state.room.current_game) {
      location.href = roomGameUrl(state.room.current_game, code);
      return null;
    }
    return "La partida ya empezo.";
  }
  // Tope de jugadores: solo bloquea a los nuevos en el lobby; los ya registrados
  // reingresan y los espectadores no cuentan (ya se resolvieron arriba).
  if (!registered && state.players.length >= MAX_ROOM_PLAYERS) {
    return `La sala esta llena (maximo ${MAX_ROOM_PLAYERS}).`;
  }

  // Nick ya registrado: es rejoin valido solo si nadie mas esta conectado con
  // ese nombre (presence). Dos amigos con igual nick serian la misma identidad.
  if ((opts.presenceCheck ?? true) && registered) {
    const online = await probePresence(code, player);
    if (online.includes(player)) {
      return "Ese nombre ya esta conectado en la sala. Elegi otro.";
    }
  }

  const result = await joinRoom(code, player);
  if (result === "not-found") return "La sala no existe.";
  if (result === "finished") return "Esa sala ya termino.";
  if (result === "spectator") {
    // La sala arranco entre el fetch y el join: entrar como espectador.
    if (state.room.current_game) {
      location.href = roomGameUrl(state.room.current_game, code);
      return null;
    }
    return "La partida ya empezo.";
  }
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

  panel.append(codeEl, copyRow);

  // Panel de ajustes editable (solo el host). Se arma una sola vez cuando se
  // detecta que este jugador es el anfitrion, para no pisar sus cambios en cada
  // refresco. Los cambios se guardan al vuelo con updateSettings + ping asi el
  // resto ve el resumen actualizado.
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "panel";
  settingsPanel.style.display = "none";
  settingsPanel.innerHTML = `<div class="panel__title">Ajustes</div>`;
  const settingsFormWrap = document.createElement("div");
  const settingsError = document.createElement("div");
  settingsError.className = "error";
  settingsPanel.append(settingsFormWrap, settingsError);

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

  // Dos columnas para el host: ajustes a la izquierda, codigo + jugadores a la
  // derecha. Los invitados ven una sola columna (codigo + jugadores).
  const columns = document.createElement("div");
  columns.className = "lobby__columns";
  const colLeft = document.createElement("div");
  colLeft.className = "lobby__col";
  const colRight = document.createElement("div");
  colRight.className = "lobby__col";
  colLeft.append(settingsPanel);
  colRight.append(panel, playersPanel);
  columns.append(colLeft, colRight);
  stack.append(columns);

  const channel = new RoomChannel(code, player);
  let state: RoomState | null = null;
  let starting = false;
  // Ajustes que edita el host en el lobby (autoritativos mientras edita).
  let hostSettings: RoomSettings | null = null;
  let hostFormBuilt = false;

  const buildHostForm = (initial: RoomSettings): void => {
    hostSettings = { ...initial };
    const form = buildSettingsForm(initial, (s) => {
      hostSettings = s;
      settingsError.textContent = "";
      void updateSettings(code, s).then((ok) => {
        if (ok) channel.ping();
      });
    });
    settingsFormWrap.append(form);
    settingsPanel.style.display = "";
    hostFormBuilt = true;
  };

  const render = (): void => {
    if (!state) return;
    const room = state.room;
    const settings = room.settings;
    const present = channel.presentPlayers();
    const isHost = room.host === player;

    if (isHost) {
      // El host edita en su propio formulario; ocultar el resumen de lectura.
      if (!hostFormBuilt) buildHostForm(settings);
      main.classList.add("rooms--wide");
      columns.classList.remove("lobby__columns--solo");
      colLeft.style.display = "";
    } else {
      // Invitado: solo codigo + jugadores en una columna.
      main.classList.remove("rooms--wide");
      columns.classList.add("lobby__columns--solo");
      colLeft.style.display = "none";
    }

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
      } else if (isHost) {
        // El anfitrion puede expulsar a cualquier otro jugador de la sala.
        const kickBtn = document.createElement("button");
        kickBtn.className = "lobby__kick";
        kickBtn.type = "button";
        kickBtn.textContent = "Expulsar";
        kickBtn.title = `Expulsar a ${p}`;
        kickBtn.addEventListener("click", () => {
          kickBtn.disabled = true;
          void kickPlayer(code, p).then((ok) => {
            if (ok) channel.ping();
            void refresh();
          });
        });
        li.append(kickBtn);
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
    // El anfitrion me expulso: ya no estoy en la sala, vuelvo al inicio.
    if (!fresh.players.includes(player)) {
      window.clearInterval(pollId);
      channel.dispose();
      renderHome("El anfitrion te saco de la sala.");
      return;
    }
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
  const pollId = window.setInterval(() => void refresh(), 5000);
  void refresh();

  startBtn.addEventListener("click", () => {
    void (async () => {
      if (!state || starting) return;
      const isHost = state.room.host === player;
      // Si el host edito ajustes en el lobby, esos mandan (todavia no
      // refrescados en state); sino, los de la sala.
      const settings = isHost && hostSettings ? hostSettings : state.room.settings;
      // O playlist completa o vacia (igual que al crear).
      if (settings.playlist && settings.playlist.length !== settings.totalRounds) {
        settingsError.textContent = `Elegí ${settings.totalRounds} juegos o ninguno.`;
        return;
      }
      starting = true;
      render();
      // Persistir por las dudas antes de arrancar (el guardado al vuelo pudo
      // no haber terminado el round-trip).
      if (isHost && hostSettings) await updateSettings(code, hostSettings);
      const firstGame = settings.playlist ? settings.playlist[0] : randomGameId();
      // Con votacion de tiempo habilitada, la primera ronda tambien vota el tope:
      // se pasa a 'time_voting' y la votacion corre ya en la pagina del juego.
      const ok = settings.timeVote
        ? await startTimeVote(
            code,
            1,
            firstGame,
            timeVoteOptionIds(),
            new Date(Date.now() + VOTE_SECONDS * 1000),
          )
        : await startRound(code, 1, firstGame, computeRoundDeadline(settings.roundTimeLimitSec));
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
