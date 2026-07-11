/**
 * Contrato de transporte con el game server (namespace `/basta`). Los tipos
 * espejan `server/src/protocol.ts`; por la regla de decoupling del repo no se
 * comparte modulo entre `src/` y `server/`, asi que si cambia el protocolo hay
 * que tocar los dos lados.
 */

export type BtCategoryId =
  | "nombre"
  | "apellido"
  | "lugar"
  | "color"
  | "comida"
  | "animal"
  | "cosa";

export type BtPhase = "waiting" | "filling" | "grace" | "voting" | "reveal" | "over";

export interface BtPlayerView {
  nickname: string;
  connected: boolean;
  filledCount: number;
  total: number;
}

export type BtCellStatus = "unique" | "repeated" | "rejected" | "empty";

export interface BtCell {
  player: string;
  category: BtCategoryId;
  text: string;
  status: BtCellStatus | null;
  points: number | null;
}

export interface BtVote {
  voter: string;
  target: string;
  category: BtCategoryId;
}

export interface BtState {
  phase: BtPhase;
  letter: string | null;
  letterIndex: number;
  totalLetters: number;
  deadline: number | null;
  /** Ms restantes de la fase al broadcast; se anclan a performance.now() para animar
   *  el reloj sin drift de reloj. Ver server/src/protocol.ts. */
  clockMs: number | null;
  clockTotalMs: number | null;
  players: BtPlayerView[];
  bastaBy: string | null;
  cells: BtCell[] | null;
  votes: BtVote[] | null;
  letterScores: { player: string; points: number }[] | null;
}

export interface BtGameover {
  ranking: { nickname: string; place: number; total: number }[];
}

export interface BastaTransport {
  onState(cb: (state: BtState) => void): void;
  /** Dirigido: el server devuelve la hoja propia al (re)conectar durante el llenado. */
  onYou(cb: (answers: Partial<Record<BtCategoryId, string>>) => void): void;
  onGameover(cb: (result: BtGameover) => void): void;
  sendFill(answers: Partial<Record<BtCategoryId, string>>): void;
  sendBasta(): void;
  sendVote(target: string, category: BtCategoryId): void;
  dispose(): void;
}
