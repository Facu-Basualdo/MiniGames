// Publisher id de Google AdSense. Es un valor PUBLICO (aparece en el HTML de cada
// pagina), por eso va commiteado como constante y no en una env var secreta.
// La env var VITE_ADSENSE_CLIENT puede sobreescribirlo (ver ads.ts).
//
// Modulo sin imports a proposito: lo consume tanto el runtime (ads.ts) como el
// build (vite.config.ts, para inyectar el loader en el <head> de cada pagina).
export const ADSENSE_CLIENT = "ca-pub-8146905674317442";
