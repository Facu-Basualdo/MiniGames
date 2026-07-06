import {
  BOMB_PENALTY,
  EMERGE_HEIGHT,
  FALL_TIME,
  FEINT_PEEK,
  FEINT_TIME,
  GOLDEN_POINTS,
  MOLE_RADIUS,
  NORMAL_POINTS,
  RISE_TIME,
  type MoleType,
} from "./constants";

type Phase = "feint" | "rising" | "holding" | "falling" | "gone";

/**
 * Un topo asomando por un agujero. Sube (`rising`), se queda arriba
 * (`holding`) y baja (`falling`). `offset` va de 0 (escondido) a 1 (totalmente
 * afuera) y se usa para posicionarlo verticalmente y recortarlo contra el suelo.
 */
export class Mole {
  phase: Phase;
  offset = 0;
  whacked = false;
  /** Animacion de golpe (0..1) al ser aplastado, para el efecto de estrellitas. */
  hitFlash = 0;

  readonly hole: number;
  readonly cx: number;
  readonly cy: number;
  readonly type: MoleType;

  private readonly holdDuration: number;
  private t = 0;

  constructor(hole: number, cx: number, cy: number, type: MoleType, holdDuration: number) {
    this.hole = hole;
    this.cx = cx;
    this.cy = cy;
    this.type = type;
    this.holdDuration = holdDuration;
    // La bomba disfrazada arranca con la finta (un topo asoma y se esconde);
    // el resto sube directo.
    this.phase = type === "disguised" ? "feint" : "rising";
  }

  get points(): number {
    if (this.type === "golden") return GOLDEN_POINTS;
    if (this.type === "bomb" || this.type === "disguised") return -BOMB_PENALTY;
    return NORMAL_POINTS;
  }

  /** Durante la finta se muestra como topo normal (todavia no revela la bomba). */
  get feinting(): boolean {
    return this.phase === "feint";
  }

  /** Se le puede pegar: visible, subiendo o arriba, y sin haber sido golpeado.
   *  La finta no cuenta: no se puede golpear el amague. */
  get whackable(): boolean {
    return (
      !this.whacked &&
      (this.phase === "rising" || this.phase === "holding") &&
      this.offset > 0.35
    );
  }

  get done(): boolean {
    return this.phase === "gone";
  }

  update(dt: number): void {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.t += dt;

    if (this.phase === "feint") {
      // Asoma y se esconde con un medio arco de seno; se queda por debajo del
      // umbral golpeable para que el amague no se pueda pegar.
      this.offset = Math.sin(Math.min(1, this.t / FEINT_TIME) * Math.PI) * FEINT_PEEK;
      if (this.t >= FEINT_TIME) {
        this.phase = "rising";
        this.offset = 0;
        this.t = 0;
      }
    } else if (this.phase === "rising") {
      this.offset = Math.min(1, this.t / RISE_TIME);
      if (this.t >= RISE_TIME) {
        this.phase = "holding";
        this.t = 0;
      }
    } else if (this.phase === "holding") {
      this.offset = 1;
      if (this.t >= this.holdDuration) {
        this.phase = "falling";
        this.t = 0;
      }
    } else if (this.phase === "falling") {
      this.offset = Math.max(0, 1 - this.t / FALL_TIME);
      if (this.offset <= 0) this.phase = "gone";
    }
  }

  /** Golpeado: se hunde de golpe. */
  whack(): void {
    this.whacked = true;
    this.hitFlash = 1;
    this.phase = "falling";
    this.t = 0;
  }

  /** Centro vertical actual segun cuanto asoma. */
  centerY(): number {
    return this.cy + MOLE_RADIUS - this.offset * (MOLE_RADIUS + EMERGE_HEIGHT);
  }

  /** Test de click en coordenadas de vista. */
  hitTest(x: number, y: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.centerY();
    return dx * dx + dy * dy <= MOLE_RADIUS * MOLE_RADIUS;
  }
}
