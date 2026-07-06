export const GAME_DURATION = 30; // seconds of typing sprint
export const BEST_KEY = "typing-race:best";

/** How many upcoming words to render in the stream (the current one plus context). */
export const VISIBLE_WORDS = 36;

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75; // seconds
export const MAX_DT = 0.1; // capping delta time to avoid jumps on tab blur

/**
 * Common Spanish words without diacritics, so any keyboard layout can type them
 * comfortably. The stream is drawn at random from this pool.
 */
export const WORD_POOL: readonly string[] = [
  "el", "la", "de", "que", "y", "en", "un", "por", "con", "no", "una", "su",
  "para", "es", "al", "lo", "como", "mas", "pero", "sus", "le", "ya", "este",
  "casa", "tiempo", "vida", "mundo", "dia", "cosa", "mano", "parte", "gente",
  "agua", "lugar", "trabajo", "noche", "puerta", "cielo", "calle", "cuerpo",
  "camino", "palabra", "fuego", "tierra", "viento", "sombra", "verdad",
  "amor", "libro", "musica", "color", "arbol", "flor", "campo", "ciudad",
  "playa", "montana", "rio", "mar", "sol", "luna", "estrella", "nube",
  "lluvia", "nieve", "invierno", "verano", "otono", "manana", "tarde",
  "correr", "saltar", "comer", "beber", "dormir", "pensar", "hablar", "mirar",
  "jugar", "cantar", "bailar", "escribir", "leer", "vivir", "sentir", "crear",
  "buscar", "encontrar", "abrir", "cerrar", "empezar", "terminar", "ganar",
  "grande", "pequeno", "rapido", "lento", "fuerte", "suave", "claro", "oscuro",
  "nuevo", "viejo", "alto", "bajo", "largo", "corto", "feliz", "triste",
  "perro", "gato", "pajaro", "pez", "caballo", "leon", "tigre", "oso", "lobo",
  "verde", "azul", "rojo", "blanco", "negro", "amarillo", "dorado", "plata",
  "amigo", "familia", "nino", "mujer", "hombre", "persona", "grupo", "equipo",
  "numero", "letra", "punto", "linea", "forma", "idea", "sueno", "fuerza",
  "manzana", "pan", "leche", "cafe", "azucar", "sal", "fruta", "carne", "sopa",
  "coche", "tren", "avion", "barco", "bici", "rueda", "motor", "viaje", "ruta",
  "mesa", "silla", "cama", "ventana", "techo", "suelo", "muro", "reloj", "vela",
];
