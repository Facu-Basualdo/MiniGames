import * as THREE from "three";

/**
 * Fichas 3D de los jugadores: overlay de canvas transparente sobre el tablero.
 * Cada ficha es un peon (base + cuerpo + cabeza) del color del jugador, inclinado
 * hacia el frente para que se lea como pieza 3D vista casi desde arriba, con
 * sombra de contacto. Mismo espiritu que Dice3D (Three.js, sin assets), pero en
 * "espacio de pixeles del tablero": la camara ortografica mapea el mundo 1:1 a
 * los pixeles del tablero, asi las fichas caen exactas sobre cada casilla aunque
 * la grilla no sea uniforme (las esquinas son mas grandes).
 *
 * Alineacion: el motor/HUD pasa el centro en pixeles de la casilla de cada
 * jugador; la base de la ficha queda ahi. La altura del cuerpo va hacia arriba
 * en pantalla (rotacion del mesh, no de la camara), lo que da el look 3D sin
 * romper la alineacion.
 */

const BASE_CELL = 56;
const LEAN = 0.32;
const HOP_DUR = 0.42;

export interface TokenView {
  color: string;
  /** Centro de la casilla, en pixeles relativos al tablero. */
  x: number;
  y: number;
  current: boolean;
  bankrupt: boolean;
}

interface TokenBody {
  group: THREE.Group;
  body: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  shadow: THREE.Mesh;
  /** Posicion dibujada y objetivo (px). */
  x: number;
  y: number;
  tx: number;
  ty: number;
  hop: number;
  current: boolean;
  phase: number;
}

function shadowTexture(): THREE.Texture {
  const s = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(20,10,0,0.5)");
  g.addColorStop(1, "rgba(20,10,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

export class Tokens3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly tokens: TokenBody[] = [];
  private readonly shadowTex = shadowTexture();
  private readonly clock = new THREE.Clock();
  private w = 1;
  private h = 1;
  private running = false;
  private scale = 1;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);

    // Camara top-down en espacio de pixeles: mundo (px, 0, py) -> pantalla (px, py).
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
    this.camera.up.set(0, 0, -1);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xfff3d8, 1.4);
    key.position.set(-0.4, 1, 0.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.4);
    rim.position.set(0.6, 0.6, -0.6);
    this.scene.add(rim);
  }

  /** Ajusta el canvas al tamano del tablero y recoloca la camara. */
  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.scale = Math.max(0.55, Math.min(1.4, w / (11.2 * BASE_CELL)));
    this.renderer.setSize(this.w, this.h, false);
    const cam = this.camera;
    cam.left = -this.w / 2;
    cam.right = this.w / 2;
    cam.top = this.h / 2;
    cam.bottom = -this.h / 2;
    cam.position.set(this.w / 2, 2000, this.h / 2);
    cam.lookAt(this.w / 2, 0, this.h / 2);
    cam.updateProjectionMatrix();
    for (const t of this.tokens) t.group.scale.setScalar(this.scale);
    this.renderOnce();
  }

  /** (Re)crea las fichas con los colores dados. */
  setTokens(colors: string[]): void {
    for (const t of this.tokens) this.scene.remove(t.group, t.shadow);
    this.tokens.length = 0;

    for (const color of colors) {
      const group = new THREE.Group();
      const c = new THREE.Color(color);

      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1206, roughness: 0.6, metalness: 0.2 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(17, 20, 6, 28), baseMat);
      base.position.y = 3;

      const bodyMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.15 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 14, 24, 24), bodyMat);
      body.position.y = 17;

      const headMat = new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.25,
        metalness: 0.2,
        emissive: c,
        emissiveIntensity: 0,
      });
      const head = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 18), headMat);
      head.position.y = 33;

      // Aro metalico bajo la cabeza (detalle Panini/copa).
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(9, 2.2, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.3, metalness: 0.8 }),
      );
      ring.position.y = 25;
      ring.rotation.x = Math.PI / 2;

      const lean = new THREE.Group();
      lean.add(base, body, head, ring);
      lean.rotation.x = LEAN;
      group.add(lean);
      group.scale.setScalar(this.scale);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(58, 58),
        new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.4 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.5;

      this.scene.add(shadow, group);
      this.tokens.push({
        group, body: bodyMat, head: headMat, shadow,
        x: this.w / 2, y: this.h / 2, tx: this.w / 2, ty: this.h / 2,
        hop: 0, current: false, phase: Math.random() * 6.28,
      });
    }
    this.renderOnce();
  }

  /** Sincroniza posiciones/estado con el HUD. Reparte las fichas que comparten casilla. */
  sync(views: TokenView[]): void {
    // Agrupa por casilla para separar fichas apiladas.
    const byTile = new Map<string, number[]>();
    views.forEach((v, i) => {
      if (v.bankrupt) return;
      const key = `${Math.round(v.x)},${Math.round(v.y)}`;
      (byTile.get(key) ?? byTile.set(key, []).get(key)!).push(i);
    });

    views.forEach((v, i) => {
      const t = this.tokens[i];
      if (!t) return;
      if (v.bankrupt) {
        t.group.visible = false;
        t.shadow.visible = false;
        return;
      }
      t.group.visible = true;
      t.shadow.visible = true;

      const mates = byTile.get(`${Math.round(v.x)},${Math.round(v.y)}`) ?? [i];
      const slot = mates.indexOf(i);
      const [ox, oy] = spread(slot, mates.length, this.scale);
      const nx = v.x + ox;
      const ny = v.y + oy;
      if (Math.abs(nx - t.tx) > 1 || Math.abs(ny - t.ty) > 1) {
        t.tx = nx;
        t.ty = ny;
        t.hop = 1;
      }
      t.current = v.current;
    });

    this.start();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.loop();
  }

  private loop = (): void => {
    const dt = Math.min(0.05, this.clock.getDelta());
    let busy = false;

    for (const t of this.tokens) {
      if (!t.group.visible) continue;
      const k = 1 - Math.exp(-dt * 12);
      t.x += (t.tx - t.x) * k;
      t.y += (t.ty - t.y) * k;
      if (t.hop > 0) {
        t.hop = Math.max(0, t.hop - dt / HOP_DUR);
        busy = true;
      }
      // Camara top-down: la altura no se ve, asi que el "salto" y el bob se
      // simulan desplazando la ficha hacia arriba en PANTALLA (-Z del mundo).
      const hopLift = Math.sin((1 - t.hop) * Math.PI) * 30;
      t.phase += dt * 4;
      const bob = t.current ? (Math.sin(t.phase) * 0.5 + 0.5) * 4 : 0;
      const lift = hopLift + bob;
      t.group.position.set(t.x, 6, t.y - lift);
      t.shadow.position.set(t.x + 5, 0.5, t.y + 5);
      t.shadow.scale.setScalar(1 + lift * 0.02);
      (t.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.14, 0.42 - lift * 0.01);
      t.head.emissiveIntensity = t.current ? 0.35 + Math.sin(t.phase) * 0.15 : 0;
      if (t.current) busy = true;
    }

    this.renderer.render(this.scene, this.camera);
    if (busy) {
      requestAnimationFrame(this.loop);
    } else {
      this.running = false;
    }
  };

  private renderOnce(): void {
    for (const t of this.tokens) {
      if (t.group.visible) {
        t.group.position.set(t.x, 6, t.y);
        t.shadow.position.set(t.x + 5, 0.5, t.y + 5);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.running = false;
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose();
      }
    });
    this.shadowTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Desplazamiento de la ficha `slot` de `n` que comparten casilla. */
function spread(slot: number, n: number, scale: number): [number, number] {
  if (n <= 1) return [0, 0];
  const r = 16 * scale;
  const a = (slot / n) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
