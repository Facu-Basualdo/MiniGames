import type { CardDef, TileDef } from "./types";

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA!"];
export const COUNTDOWN_STEP = 0.8; // segundos por etiqueta

export const GAME_ID = "monopoly-mundial";
export const BEST_KEY = "mg:monopoly-mundial:best";

export const STARTING_MONEY = 1500;
export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const JAIL_POS = 10;
export const MAX_PLAYERS = 6;

/** Tope por decision en modo online: el host auto-juega al que se cuelga. */
export const TURN_TIMEOUT_MS = 30000;

/** Fichas: color + sigla que se dibuja en el disco/ficha 3D. Maximo 6 jugadores. */
export const TOKENS = [
  { name: "Balon de Oro", abbr: "BA", color: "#f2c94c" },
  { name: "Botin", abbr: "BO", color: "#42b8e8" },
  { name: "Copa", abbr: "CO", color: "#eb5757" },
  { name: "Guante", abbr: "GU", color: "#5ecb7e" },
  { name: "Silbato", abbr: "SI", color: "#b06bd9" },
  { name: "Camiseta 10", abbr: "10", color: "#f2994a" },
] as const;

export const BOT_NAMES = ["Tata", "Loco", "Mister", "Profe", "Vasco"];

export const GROUP_COLORS: Record<string, string> = {
  marron: "#8d5b3f",
  celeste: "#7fd4e8",
  rosa: "#e05a9d",
  naranja: "#f2994a",
  rojo: "#e04040",
  amarillo: "#f2d34c",
  verde: "#3fae5c",
  azul: "#2f5fd0",
};

/**
 * Tablero de 40 casillas, layout clasico con tematica Mundial 2026:
 * calles = selecciones por grupo de color, ferrocarriles = estadios sede,
 * servicios = VAR y Transmision TV, carcel = Vestuario (suspension).
 * Rentas y precios identicos al Monopoly clasico.
 */
export const TILES: TileDef[] = [
  { kind: "go", name: "Saque Inicial", short: "SAQUE" },
  { kind: "street", name: "Nueva Zelanda", short: "N. Zelanda", price: 60, group: "marron", houseCost: 50, rents: [2, 10, 30, 90, 160, 250] },
  { kind: "fifa", name: "Tarjeta FIFA", short: "FIFA" },
  { kind: "street", name: "Panama", short: "Panama", price: 60, group: "marron", houseCost: 50, rents: [4, 20, 60, 180, 320, 450] },
  { kind: "tax", name: "Tasa FIFA", short: "TASA FIFA", tax: 200 },
  { kind: "stadium", name: "Estadio Azteca", short: "Azteca", price: 200 },
  { kind: "street", name: "Japon", short: "Japon", price: 100, group: "celeste", houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { kind: "var", name: "Tarjeta VAR", short: "VAR" },
  { kind: "street", name: "Corea del Sur", short: "Corea", price: 100, group: "celeste", houseCost: 50, rents: [6, 30, 90, 270, 400, 550] },
  { kind: "street", name: "Australia", short: "Australia", price: 120, group: "celeste", houseCost: 50, rents: [8, 40, 100, 300, 450, 600] },
  { kind: "jail", name: "Vestuario", short: "VESTUARIO" },
  { kind: "street", name: "Marruecos", short: "Marruecos", price: 140, group: "rosa", houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { kind: "utility", name: "Cabina VAR", short: "CABINA VAR", price: 150 },
  { kind: "street", name: "Senegal", short: "Senegal", price: 140, group: "rosa", houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { kind: "street", name: "Egipto", short: "Egipto", price: 160, group: "rosa", houseCost: 100, rents: [12, 60, 180, 500, 700, 900] },
  { kind: "stadium", name: "SoFi Stadium", short: "SoFi", price: 200 },
  { kind: "street", name: "Canada", short: "Canada", price: 180, group: "naranja", houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { kind: "fifa", name: "Tarjeta FIFA", short: "FIFA" },
  { kind: "street", name: "Mexico", short: "Mexico", price: 180, group: "naranja", houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { kind: "street", name: "Estados Unidos", short: "EE. UU.", price: 200, group: "naranja", houseCost: 100, rents: [16, 80, 220, 600, 800, 1000] },
  { kind: "fanfest", name: "Fan Fest", short: "FAN FEST" },
  { kind: "street", name: "Uruguay", short: "Uruguay", price: 220, group: "rojo", houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { kind: "var", name: "Tarjeta VAR", short: "VAR" },
  { kind: "street", name: "Colombia", short: "Colombia", price: 220, group: "rojo", houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { kind: "street", name: "Ecuador", short: "Ecuador", price: 240, group: "rojo", houseCost: 150, rents: [20, 100, 300, 750, 925, 1100] },
  { kind: "stadium", name: "AT&T Stadium", short: "AT&T", price: 200 },
  { kind: "street", name: "Portugal", short: "Portugal", price: 260, group: "amarillo", houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { kind: "street", name: "Paises Bajos", short: "P. Bajos", price: 260, group: "amarillo", houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { kind: "utility", name: "Transmision TV", short: "TV", price: 150 },
  { kind: "street", name: "Italia", short: "Italia", price: 280, group: "amarillo", houseCost: 150, rents: [24, 120, 360, 850, 1025, 1200] },
  { kind: "gotojail", name: "Tarjeta Roja", short: "ROJA" },
  { kind: "street", name: "Inglaterra", short: "Inglaterra", price: 300, group: "verde", houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { kind: "street", name: "Alemania", short: "Alemania", price: 300, group: "verde", houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { kind: "fifa", name: "Tarjeta FIFA", short: "FIFA" },
  { kind: "street", name: "Espana", short: "Espana", price: 320, group: "verde", houseCost: 200, rents: [28, 150, 450, 1000, 1200, 1400] },
  { kind: "stadium", name: "MetLife (Final)", short: "MetLife", price: 200 },
  { kind: "var", name: "Tarjeta VAR", short: "VAR" },
  { kind: "street", name: "Brasil", short: "Brasil", price: 350, group: "azul", houseCost: 200, rents: [35, 175, 500, 1100, 1300, 1500] },
  { kind: "tax", name: "Fichaje Galactico", short: "FICHAJE", tax: 100 },
  { kind: "street", name: "Argentina", short: "Argentina", price: 400, group: "azul", houseCost: 200, rents: [50, 200, 600, 1400, 1700, 2000] },
];

/** Indices de casilla por grupo de color (derivado de TILES). */
export const GROUP_TILES: Record<string, number[]> = {};
TILES.forEach((t, i) => {
  if (t.kind === "street" && t.group) {
    (GROUP_TILES[t.group] ??= []).push(i);
  }
});

export const STADIUM_TILES = TILES.flatMap((t, i) => (t.kind === "stadium" ? [i] : []));
export const UTILITY_TILES = TILES.flatMap((t, i) => (t.kind === "utility" ? [i] : []));

/**
 * Mazo Tarjeta VAR (equivale a Suerte): cargado a traslados por el tablero y
 * golpes de fortuna. Guinos al Mundial 2026 y al album Panini.
 */
export const VAR_CARDS: CardDef[] = [
  { text: "El VAR convalida tu gol de mitad de cancha. Avanza hasta el Saque Inicial y cobra $200.", effect: { type: "goto", tile: 0 } },
  { text: "Te convocan a la Albiceleste para la gran final. Avanza hasta Argentina.", effect: { type: "goto", tile: 39 } },
  { text: "Gira de amistosos con la Azzurra. Avanza hasta Italia. Si pasas por el Saque Inicial cobra $200.", effect: { type: "goto", tile: 29 } },
  { text: "Partido inaugural en el Azteca. Avanza hasta Mexico. Si pasas por el Saque Inicial cobra $200.", effect: { type: "goto", tile: 18 } },
  { text: "Clasificas al Mundial con Marruecos. Avanza hasta Marruecos.", effect: { type: "goto", tile: 11 } },
  { text: "Te llevan a la gran final. Avanza hasta el MetLife.", effect: { type: "goto", tile: 35 } },
  { text: "Corre la banda: avanza hasta el estadio sede mas cercano. Si tiene dueno, paga el doble de la entrada.", effect: { type: "nearest", kind: "stadium" } },
  { text: "Vas a la sala VAR: avanza hasta el servicio mas cercano (Cabina VAR o Transmision TV). Si tiene dueno, paga 10 veces los dados.", effect: { type: "nearest", kind: "utility" } },
  { text: "Fuera de juego milimetrico marcado por las lineas del VAR: retrocede 3 casillas.", effect: { type: "back", steps: 3 } },
  { text: "Entrada criminal de planchazo. Tarjeta roja directa: ve al Vestuario sin pasar por el Saque Inicial.", effect: { type: "gotojail" } },
  { text: "Apelacion ganada ante el Tribunal de Disciplina. Conserva esta tarjeta para salir del Vestuario gratis.", effect: { type: "pardon" } },
  { text: "Multa de la FIFA por protestar al arbitro: paga $15.", effect: { type: "money", amount: -15 } },
  { text: "Ganas la tanda de penales y el premio de la fecha: cobra $50.", effect: { type: "money", amount: 50 } },
  { text: "Mantenimiento de tus canchas antes del Mundial: paga $25 por tribuna y $100 por estadio.", effect: { type: "repairs", perHouse: 25, perHotel: 100 } },
  { text: "Te nombran capitan y pagas el asado del plantel: dale $50 a cada jugador.", effect: { type: "each", amount: -50 } },
  { text: "Sos la figura de la fecha: cada rival te paga $20 de admiracion.", effect: { type: "each", amount: 20 } },
  { text: "Firmas contrato con un sponsor deportivo: cobra $150.", effect: { type: "money", amount: 150 } },
  { text: "Encuentras el cromo dorado de la estrella, edicion limitada del album: cobra $100.", effect: { type: "money", amount: 100 } },
  { text: "Amonestacion por perder tiempo: paga $25.", effect: { type: "money", amount: -25 } },
  { text: "Premio a la valla menos vencida del torneo: cobra $75.", effect: { type: "money", amount: 75 } },
  { text: "Te lesionas y pagas la rehabilitacion: paga $100.", effect: { type: "money", amount: -100 } },
  { text: "Subasta de tu camiseta usada en la final: cobra $120.", effect: { type: "money", amount: 120 } },
  { text: "Bono por clasificar a octavos: cobra $40.", effect: { type: "money", amount: 40 } },
  { text: "Bronca en el tunel del vestuario: retrocede 3 casillas.", effect: { type: "back", steps: 3 } },
];

/**
 * Mazo Tarjeta FIFA (equivale a Arca Comunal): mas cargado a premios, multas y
 * gestion del club/seleccion.
 */
export const FIFA_CARDS: CardDef[] = [
  { text: "La FIFA revisa el fixture: avanza hasta el Saque Inicial y cobra $200.", effect: { type: "goto", tile: 0 } },
  { text: "Error del banco de fichajes a tu favor: cobra $200.", effect: { type: "money", amount: 200 } },
  { text: "Pagas la inscripcion de la escuelita de futbol: paga $50.", effect: { type: "money", amount: -50 } },
  { text: "Venta record de camisetas de tu seleccion: cobra $50.", effect: { type: "money", amount: 50 } },
  { text: "Apelacion ganada ante la FIFA. Conserva esta tarjeta para salir del Vestuario gratis.", effect: { type: "pardon" } },
  { text: "Doping positivo por el mate del utilero. Ve al Vestuario sin pasar por el Saque Inicial.", effect: { type: "gotojail" } },
  { text: "Dia de cobro de premios FIFA: cobra $100.", effect: { type: "money", amount: 100 } },
  { text: "Devolucion de impuestos de la federacion: cobra $20.", effect: { type: "money", amount: 20 } },
  { text: "Es tu cumpleanos y todo el plantel colabora: cada jugador te da $10.", effect: { type: "each", amount: 10 } },
  { text: "Vence el seguro medico del plantel: paga $100.", effect: { type: "money", amount: -100 } },
  { text: "Completas el album del Mundial y ganas el gran concurso: cobra $100.", effect: { type: "money", amount: 100 } },
  { text: "Gastos de clinica tras una entrada dura: paga $50.", effect: { type: "money", amount: -50 } },
  { text: "Reparaciones en tus estadios: paga $40 por tribuna y $115 por estadio.", effect: { type: "repairs", perHouse: 40, perHotel: 115 } },
  { text: "Tu gol gana el premio al mejor de la fecha: cobra $10.", effect: { type: "money", amount: 10 } },
  { text: "Derechos de television repartidos entre clubes: cobra $150.", effect: { type: "money", amount: 150 } },
  { text: "Multa por indisciplina del plantel: paga $40.", effect: { type: "money", amount: -40 } },
  { text: "Ganas el sorteo del palco VIP en la final: cobra $60.", effect: { type: "money", amount: 60 } },
  { text: "El fisco te descubre un bono no declarado: paga $75.", effect: { type: "money", amount: -75 } },
  { text: "Homenaje de los hinchas: cada jugador te regala $15.", effect: { type: "each", amount: 15 } },
  { text: "Renovas contrato con prima de fichaje: cobra $130.", effect: { type: "money", amount: 130 } },
  { text: "Suspenden un partido por la lluvia y perdes la taquilla: paga $60.", effect: { type: "money", amount: -60 } },
  { text: "Premio Fair Play de la FIFA: cobra $80.", effect: { type: "money", amount: 80 } },
];
