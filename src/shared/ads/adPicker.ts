// Selector visual de ubicaciones de anuncios. Herramienta SOLO de desarrollo:
// nunca se incluye en el build de produccion (la inyecta el plugin de Vite
// injectGameAds solo cuando corre el dev server, y ademas esta guardada por
// import.meta.env.DEV).
//
// Uso: abrir cualquier pagina con ?adpick=1 (ej. http://localhost:5173/?adpick=1).
// Dos modos:
//   - "Anclar a elemento": clic en un elemento del DOM y el anuncio se coloca
//     antes/despues/dentro de el (ideal para el landing y las salas).
//   - "Banner flotante": agrega un banner vertical que se arrastra a la izquierda
//     o derecha donde uno quiera (ideal para los gutters de los juegos canvas).
// La lista persiste al navegar entre paginas (sessionStorage). "Copiar JSON" la
// copia al portapapeles para pegarla y que se cableen los anuncios.

type Position = "before" | "after" | "prepend" | "append";
type Side = "left" | "right";

interface AnchorPick {
  id: string;
  kind: "anchor";
  page: string;
  gameId: string | null;
  selector: string;
  tag: string;
  classes: string;
  text: string;
  position: Position;
  size: string;
}

interface FloatPick {
  id: string;
  kind: "float";
  page: string;
  gameId: string | null;
  format: string; // formato de createAdSlot (vertical/horizontal/rectangle)
  size: string; // etiqueta legible de la forma
  side: Side; // borde horizontal mas cercano (util para anclar rieles)
  left: number; // px desde la izquierda del viewport
  top: number; // px desde arriba
  edgeGap: number; // px desde el borde 'side'
  width: number;
  height: number;
}

// Formas estandar de anuncio. El usuario elige una como punto de partida y luego
// puede redimensionar el recuadro a gusto.
const SHAPES: Array<{ key: string; label: string; w: number; h: number; format: string }> = [
  { key: "vertical", label: "Rascacielos vertical", w: 160, h: 600, format: "vertical" },
  { key: "wide-skyscraper", label: "Rascacielos ancho", w: 300, h: 600, format: "vertical" },
  { key: "horizontal", label: "Banner horizontal", w: 728, h: 90, format: "horizontal" },
  { key: "large-leaderboard", label: "Banner grande", w: 970, h: 90, format: "horizontal" },
  { key: "rectangle", label: "Rectangulo mediano", w: 300, h: 250, format: "rectangle" },
  { key: "large-rectangle", label: "Rectangulo grande", w: 336, h: 280, format: "rectangle" },
  { key: "square", label: "Cuadrado", w: 250, h: 250, format: "rectangle" },
];

type Pick = AnchorPick | FloatPick;
type Mode = "anchor" | "float";

const PARAM = "adpick";
const ON_KEY = "mg:adpick-on";
const PICKS_KEY = "mg:adpicks";
const MIN_KEY = "mg:adpick-min";

function isActive(): boolean {
  try {
    if (new URLSearchParams(location.search).has(PARAM)) {
      sessionStorage.setItem(ON_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(ON_KEY) === "1";
  } catch {
    return new URLSearchParams(location.search).has(PARAM);
  }
}

function loadPicks(): Pick[] {
  try {
    return JSON.parse(sessionStorage.getItem(PICKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function savePicks(picks: Pick[]): void {
  try {
    sessionStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  } catch {
    // ignore
  }
}

function gameIdFromPath(): string | null {
  const m = location.pathname.match(/\/games\/([^/]+)\//);
  return m ? m[1] : null;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Camino CSS razonablemente unico hasta el elemento, para ubicarlo en el codigo.
function cssPath(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let sel = node.tagName.toLowerCase();
    const cls = [...node.classList].find((c) => !c.startsWith("adpick"));
    if (cls) sel += `.${CSS.escape(cls)}`;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = [...parent.children].filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function describeAnchor(el: Element): AnchorPick {
  return {
    id: newId(),
    kind: "anchor",
    page: location.pathname,
    gameId: gameIdFromPath(),
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    classes: [...el.classList].filter((c) => !c.startsWith("adpick")).join(" "),
    text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
    position: "after",
    size: "Banner horizontal",
  };
}

const POSITIONS: Array<{ v: Position; label: string }> = [
  { v: "before", label: "Antes de este elemento" },
  { v: "after", label: "Despues de este elemento" },
  { v: "prepend", label: "Dentro, al principio" },
  { v: "append", label: "Dentro, al final" },
];

const SIZES = ["Banner horizontal", "Rectangulo", "Rascacielos vertical", "Automatico (responsivo)"];

function injectCss(): void {
  const style = document.createElement("style");
  style.textContent = `
    .adpick-root { position: fixed; z-index: 2147483001; font: 13px/1.4 "Archivo", system-ui, sans-serif; color: #111; }
    .adpick-catcher { position: fixed; inset: 0; z-index: 2147483000; cursor: crosshair; background: transparent; }
    .adpick-hl { position: fixed; z-index: 2147483000; pointer-events: none; border: 2px solid #2b6cff; background: rgba(43,108,255,0.12); border-radius: 4px; }
    .adpick-hl__tag { position: absolute; top: -22px; left: 0; background: #2b6cff; color: #fff; font: 600 11px/1 "Archivo", system-ui, sans-serif; padding: 4px 6px; border-radius: 4px; white-space: nowrap; }
    .adpick-panel { position: fixed; top: 12px; right: 12px; width: 320px; max-height: calc(100vh - 24px); overflow: auto; z-index: 2147483003; background: #f4f2e6; border: 2px solid #111; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.35); padding: 12px; }
    .adpick-panel p { margin: 0 0 10px; font-size: 12px; color: #555; }
    .adpick-head { display: flex; align-items: center; gap: 8px; cursor: move; margin: -12px -12px 8px; padding: 10px 12px; border-bottom: 1px solid rgba(17,17,17,0.15); }
    .adpick-title { flex: 1; font-size: 14px; font-weight: 800; }
    .adpick-min { cursor: pointer; border: 2px solid #111; background: transparent; color: #111; border-radius: 8px; width: 26px; height: 26px; font: 800 15px/1 "Archivo", system-ui, sans-serif; flex: none; }
    .adpick-panel--min { width: auto; overflow: visible; }
    .adpick-panel--min .adpick-head { margin-bottom: -12px; border-bottom: none; }
    .adpick-panel--min .adpick-body { display: none; }
    .adpick-modes { display: flex; gap: 6px; margin-bottom: 8px; }
    .adpick-mode { flex: 1; cursor: pointer; border: 2px solid #111; border-radius: 999px; padding: 6px; font: 700 11px "Archivo", system-ui, sans-serif; background: transparent; color: #111; }
    .adpick-mode.is-active { background: #111; color: #f4f2e6; }
    .adpick-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .adpick-item { border: 1px solid rgba(17,17,17,0.35); border-radius: 8px; padding: 6px 8px; background: #fff; font-size: 12px; position: relative; }
    .adpick-item b { display: block; font-size: 11px; color: #2b6cff; }
    .adpick-item span { color: #444; }
    .adpick-item__rm { position: absolute; top: 4px; right: 6px; cursor: pointer; border: none; background: none; font-size: 16px; line-height: 1; color: #b00; }
    .adpick-empty { font-size: 12px; color: #888; font-style: italic; margin-bottom: 10px; }
    .adpick-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .adpick-btn { cursor: pointer; border: 2px solid #111; border-radius: 999px; padding: 7px 12px; font: 700 12px "Archivo", system-ui, sans-serif; background: #111; color: #f4f2e6; }
    .adpick-btn--ghost { background: transparent; color: #111; }
    .adpick-btn--wide { width: 100%; margin-bottom: 10px; }
    .adpick-shape-row { display: flex; gap: 6px; margin-bottom: 10px; }
    .adpick-shape { flex: 1; min-width: 0; padding: 6px; border: 1px solid #111; border-radius: 8px; background: #fff; font: 12px "Archivo", system-ui, sans-serif; }
    .adpick-form { position: fixed; z-index: 2147483004; background: #f4f2e6; border: 2px solid #111; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.4); padding: 14px; width: 300px; }
    .adpick-form h4 { margin: 0 0 4px; font-size: 14px; font-weight: 800; }
    .adpick-form .adpick-target { font-size: 11px; color: #2b6cff; word-break: break-all; margin-bottom: 10px; }
    .adpick-form label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 8px 0 3px; }
    .adpick-form select { width: 100%; padding: 6px; border: 1px solid #111; border-radius: 8px; background: #fff; font: 13px "Archivo", system-ui, sans-serif; }
    .adpick-form .adpick-actions { margin-top: 12px; }
    .adpick-copybox { width: 100%; height: 120px; margin-top: 8px; font: 11px monospace; border: 1px solid #111; border-radius: 8px; padding: 6px; }
    .adpick-float { position: fixed; z-index: 2147483002; box-sizing: border-box; border: 2px dashed #2b6cff; background: rgba(43,108,255,0.16); border-radius: 8px; cursor: move; user-select: none; display: flex; flex-direction: column; }
    .adpick-float__label { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font: 800 12px "Archivo", system-ui, sans-serif; color: #1b47b3; letter-spacing: 1px; padding: 6px; }
    .adpick-float__bar { display: flex; align-items: center; gap: 4px; padding: 4px; background: #2b6cff; border-radius: 0 0 5px 5px; }
    .adpick-float__side { flex: 1; font: 800 10px "Archivo", system-ui, sans-serif; color: #fff; letter-spacing: 1px; }
    .adpick-float__bar button { cursor: pointer; border: none; border-radius: 6px; padding: 4px 7px; font: 700 11px "Archivo", system-ui, sans-serif; }
    .adpick-float__save { background: #fff; color: #1b47b3; }
    .adpick-float__del { background: rgba(255,255,255,0.25); color: #fff; }
    .adpick-float__resize { position: absolute; right: 0; bottom: 26px; width: 16px; height: 16px; cursor: nwse-resize; background:
      linear-gradient(135deg, transparent 50%, #2b6cff 50%); border-radius: 0 0 6px 0; }
  `;
  document.head.append(style);
}

function run(): void {
  injectCss();
  let picks = loadPicks();
  let mode: Mode = "anchor";
  let minimized = false;
  try {
    minimized = sessionStorage.getItem(MIN_KEY) === "1";
  } catch {
    // ignore
  }
  const floatBoxes = new Set<HTMLElement>();

  const catcher = document.createElement("div");
  catcher.className = "adpick-catcher";

  const hl = document.createElement("div");
  hl.className = "adpick-hl";
  hl.style.display = "none";
  hl.innerHTML = `<div class="adpick-hl__tag"></div>`;
  const hlTag = hl.querySelector<HTMLElement>(".adpick-hl__tag")!;

  const panel = document.createElement("div");
  panel.className = "adpick-panel adpick-root";

  document.body.append(catcher, hl, panel);

  let formEl: HTMLElement | null = null;

  // Arrastrar el panel desde su encabezado (para correrlo si tapa donde vas a
  // colocar un anuncio). Al arrastrar pasa a posicionarse por left/top.
  function startPanelDrag(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest(".adpick-min")) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    panel.style.right = "auto";
    function move(ev: MouseEvent): void {
      panel.style.left = `${Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - panel.offsetWidth))}px`;
      panel.style.top = `${Math.max(0, Math.min(ev.clientY - dy, window.innerHeight - 40))}px`;
    }
    function up(): void {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function elementUnder(x: number, y: number): Element | null {
    catcher.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    catcher.style.pointerEvents = "";
    if (!el) return null;
    if (el.closest(".adpick-root, .adpick-form, .adpick-hl, .adpick-catcher, .adpick-float")) return null;
    return el;
  }

  function onMove(e: MouseEvent): void {
    if (mode !== "anchor" || formEl) {
      hl.style.display = "none";
      return;
    }
    const el = elementUnder(e.clientX, e.clientY);
    if (!el) {
      hl.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = `${r.left}px`;
    hl.style.top = `${r.top}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    const first = [...el.classList][0];
    hlTag.textContent = el.tagName.toLowerCase() + (first ? "." + first : "");
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "anchor" || formEl) return;
    const el = elementUnder(e.clientX, e.clientY);
    if (!el) return;
    openAnchorForm(describeAnchor(el), e.clientX, e.clientY);
  }

  catcher.addEventListener("mousemove", onMove);
  catcher.addEventListener("click", onClick, true);

  // ---- Modo anclar: formulario ----
  function openAnchorForm(pick: AnchorPick, x: number, y: number): void {
    hl.style.display = "none";
    catcher.style.pointerEvents = "none";
    formEl = document.createElement("div");
    formEl.className = "adpick-form adpick-root";
    formEl.innerHTML = `
      <h4>Nuevo anuncio</h4>
      <div class="adpick-target">${pick.selector}</div>
      <label>Posicion</label>
      <select class="adpick-pos">${POSITIONS.map((p) => `<option value="${p.v}"${p.v === pick.position ? " selected" : ""}>${p.label}</option>`).join("")}</select>
      <label>Tamano del anuncio</label>
      <select class="adpick-size">${SIZES.map((s) => `<option${s === pick.size ? " selected" : ""}>${s}</option>`).join("")}</select>
      <div class="adpick-actions">
        <button class="adpick-btn adpick-add">Agregar</button>
        <button class="adpick-btn adpick-btn--ghost adpick-cancel">Cancelar</button>
      </div>
    `;
    formEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 320))}px`;
    formEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 260))}px`;
    document.body.append(formEl);

    const posSel = formEl.querySelector<HTMLSelectElement>(".adpick-pos")!;
    const sizeSel = formEl.querySelector<HTMLSelectElement>(".adpick-size")!;
    formEl.querySelector<HTMLButtonElement>(".adpick-add")!.addEventListener("click", () => {
      pick.position = posSel.value as Position;
      pick.size = sizeSel.value;
      picks.push(pick);
      savePicks(picks);
      closeForm();
      renderList();
    });
    formEl.querySelector<HTMLButtonElement>(".adpick-cancel")!.addEventListener("click", closeForm);
  }

  function closeForm(): void {
    formEl?.remove();
    formEl = null;
    catcher.style.pointerEvents = "";
  }

  // ---- Modo flotante: recuadro de anuncio arrastrable de cualquier forma ----
  function addFloatBox(shapeKey: string): void {
    const shape = SHAPES.find((s) => s.key === shapeKey) ?? SHAPES[0];
    const box = document.createElement("div");
    box.className = "adpick-float";
    box.dataset.format = shape.format;
    box.dataset.size = shape.label;
    // Arranca centrado, sin pasarse del viewport.
    const w = Math.min(shape.w, window.innerWidth - 24);
    const h = Math.min(shape.h, window.innerHeight - 24);
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    box.style.left = `${Math.max(12, (window.innerWidth - w) / 2)}px`;
    box.style.top = `${Math.max(12, (window.innerHeight - h) / 2)}px`;
    box.innerHTML = `
      <div class="adpick-float__label">${shape.label.toUpperCase()}<br>arrastrame</div>
      <div class="adpick-float__resize"></div>
      <div class="adpick-float__bar">
        <span class="adpick-float__side">IZQUIERDA</span>
        <button class="adpick-float__save">Guardar</button>
        <button class="adpick-float__del" title="Descartar">&times;</button>
      </div>
    `;
    document.body.append(box);
    floatBoxes.add(box);
    const sideLabel = box.querySelector<HTMLElement>(".adpick-float__side")!;

    function currentSide(): Side {
      const r = box.getBoundingClientRect();
      return r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right";
    }
    function refreshSide(): void {
      sideLabel.textContent = currentSide() === "left" ? "IZQUIERDA" : "DERECHA";
    }

    // Arrastrar para mover (desde cualquier parte menos botones/resize).
    box.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".adpick-float__bar") || t.classList.contains("adpick-float__resize")) return;
      e.preventDefault();
      const r = box.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      function move(ev: MouseEvent): void {
        box.style.left = `${Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - box.offsetWidth))}px`;
        box.style.top = `${Math.max(0, Math.min(ev.clientY - dy, window.innerHeight - box.offsetHeight))}px`;
        refreshSide();
      }
      function up(): void {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      }
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });

    // Redimensionar desde la esquina.
    box.querySelector<HTMLElement>(".adpick-float__resize")!.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = box.getBoundingClientRect();
      function move(ev: MouseEvent): void {
        box.style.width = `${Math.max(80, ev.clientX - r.left)}px`;
        box.style.height = `${Math.max(120, ev.clientY - r.top)}px`;
      }
      function up(): void {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      }
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });

    box.querySelector<HTMLButtonElement>(".adpick-float__del")!.addEventListener("click", () => {
      floatBoxes.delete(box);
      box.remove();
    });

    box.querySelector<HTMLButtonElement>(".adpick-float__save")!.addEventListener("click", () => {
      const r = box.getBoundingClientRect();
      const side = currentSide();
      const pick: FloatPick = {
        id: newId(),
        kind: "float",
        page: location.pathname,
        gameId: gameIdFromPath(),
        format: box.dataset.format ?? "auto",
        size: box.dataset.size ?? "Anuncio",
        side,
        left: Math.round(r.left),
        top: Math.round(r.top),
        edgeGap: Math.round(side === "left" ? r.left : window.innerWidth - r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
      picks.push(pick);
      savePicks(picks);
      floatBoxes.delete(box);
      box.remove();
      renderList();
    });

    refreshSide();
  }

  function setMode(m: Mode): void {
    mode = m;
    hl.style.display = "none";
    renderList();
  }

  // ---- Panel ----
  function pickLine(p: Pick): string {
    if (p.kind === "float") {
      return `<span>${p.size} &middot; ${p.side === "left" ? "izquierda" : "derecha"} &middot; ${p.width}&times;${p.height}</span>`;
    }
    return `<span>${p.size} &middot; ${POSITIONS.find((q) => q.v === p.position)?.label ?? p.position}</span><br><span style="color:#888">${p.selector}</span>`;
  }

  const floatControls = `
    <div class="adpick-shape-row">
      <select class="adpick-shape">${SHAPES.map((s) => `<option value="${s.key}">${s.label} (${s.w}x${s.h})</option>`).join("")}</select>
      <button class="adpick-btn adpick-newfloat">Agregar</button>
    </div>`;

  function renderList(): void {
    const items = picks.length
      ? `<div class="adpick-list">${picks
          .map(
            (p) => `
        <div class="adpick-item">
          <button class="adpick-item__rm" data-id="${p.id}" title="Quitar">&times;</button>
          <b>${p.gameId ? "juego: " + p.gameId : p.page} &middot; ${p.kind === "float" ? "flotante" : "anclado"}</b>
          ${pickLine(p)}
        </div>`,
          )
          .join("")}</div>`
      : `<div class="adpick-empty">Todavia no marcaste ningun lugar.</div>`;

    const instruction =
      mode === "anchor"
        ? "Hace clic en el elemento donde queres un anuncio."
        : "Elegi una forma, agregala y arrastrala donde quieras (podes redimensionarla). 'Guardar' la registra.";

    panel.classList.toggle("adpick-panel--min", minimized);
    panel.innerHTML = `
      <div class="adpick-head">
        <span class="adpick-title">Anuncios (${picks.length})</span>
        <button class="adpick-min" title="${minimized ? "Expandir" : "Minimizar"}">${minimized ? "+" : "−"}</button>
      </div>
      <div class="adpick-body">
        <div class="adpick-modes">
          <button class="adpick-mode${mode === "anchor" ? " is-active" : ""}" data-mode="anchor">Anclar a elemento</button>
          <button class="adpick-mode${mode === "float" ? " is-active" : ""}" data-mode="float">Flotante</button>
        </div>
        <p>${instruction}</p>
        ${mode === "float" ? floatControls : ""}
        ${items}
        <div class="adpick-actions">
          <button class="adpick-btn adpick-copy">Copiar JSON</button>
          <button class="adpick-btn adpick-btn--ghost adpick-clear">Limpiar</button>
          <button class="adpick-btn adpick-btn--ghost adpick-exit">Salir</button>
        </div>
      </div>
    `;

    const minBtn = panel.querySelector<HTMLButtonElement>(".adpick-min")!;
    minBtn.addEventListener("click", () => {
      minimized = !minimized;
      try {
        sessionStorage.setItem(MIN_KEY, minimized ? "1" : "0");
      } catch {
        // ignore
      }
      renderList();
    });
    panel.querySelector<HTMLElement>(".adpick-head")!.addEventListener("mousedown", startPanelDrag);
    panel.querySelectorAll<HTMLButtonElement>(".adpick-mode").forEach((b) =>
      b.addEventListener("click", () => setMode(b.dataset.mode as Mode)),
    );
    panel.querySelector<HTMLButtonElement>(".adpick-newfloat")?.addEventListener("click", () => {
      const shapeSel = panel.querySelector<HTMLSelectElement>(".adpick-shape");
      addFloatBox(shapeSel?.value ?? "vertical");
    });
    panel.querySelectorAll<HTMLButtonElement>(".adpick-item__rm").forEach((b) =>
      b.addEventListener("click", () => {
        picks = picks.filter((p) => p.id !== b.dataset.id);
        savePicks(picks);
        renderList();
      }),
    );
    panel.querySelector<HTMLButtonElement>(".adpick-copy")!.addEventListener("click", copyJson);
    panel.querySelector<HTMLButtonElement>(".adpick-clear")!.addEventListener("click", () => {
      picks = [];
      savePicks(picks);
      renderList();
    });
    panel.querySelector<HTMLButtonElement>(".adpick-exit")!.addEventListener("click", exit);
  }

  function copyJson(): void {
    const json = JSON.stringify(picks, null, 2);
    // eslint-disable-next-line no-console
    console.log("[adpick] seleccion:\n" + json);
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    const box = document.createElement("textarea");
    box.className = "adpick-copybox";
    box.value = json;
    box.readOnly = true;
    panel.append(box);
    box.select();
  }

  function exit(): void {
    try {
      sessionStorage.removeItem(ON_KEY);
    } catch {
      // ignore
    }
    catcher.remove();
    hl.remove();
    panel.remove();
    formEl?.remove();
    floatBoxes.forEach((b) => b.remove());
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && formEl) closeForm();
  });

  renderList();
}

if (import.meta.env.DEV && isActive()) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}
