# MiniGames

Una colección de minijuegos para el navegador, cada uno jugable por separado, con una landing para elegir cuál jugar. Ranking global, portadas y un modo multijugador por salas para jugar con amigos.

**Jugá online:** https://juegachos.com

Hecho con **Vite + TypeScript** (sin framework) y desplegado como sitio estático en Vercel. Los juegos 3D usan **Three.js**; el ranking global y las salas usan **Supabase**.

## Juegos

| Juego | Categoría | De qué va | Creado por |
|---|---|---|---|
| Neon Vortex | Arcade | Esquivá las porciones que giran alrededor del cilindro neón. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Flappy Bird | Arcade | Aleteá y cruzá la mayor cantidad de tubos sin chocar. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Torre Infinita | Precisión | Soltá cada bloque en el momento justo y apilá la torre más alta. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Beat Fever | Ritmo | Tocá las notas justo al cruzar la línea y encadená combos. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Bounce Rush | Arcade | Saltá entre plataformas y cambiá de carril a tiempo. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Reflex | Reflejos | Poné a prueba tus reflejos en 5 rondas de tiempo de reacción. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Skyline | Precisión | Levantá el rascacielos más alto sin perder el equilibrio. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Numerix | Puzzle | Ordená los números deslizando filas o columnas. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Asteroides | Arcade | El clásico: navegá con inercia y dispará a las rocas. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Cruce Mortal | Arcade | Cruzá calles y ríos saltando sobre troncos flotantes. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Neon Drift | Carreras | Carrera 2D en circuitos neón con los autos de todos en vivo. | [matiasgzlez](https://github.com/matiasgzlez) |
| Odd One Out | Reflejos | Encontrá la ficha con el tono distinto antes de que se acabe el tiempo. | [juanr8234](https://github.com/juanr8234) |
| Dunk Shot | Precisión | Estirá, apuntá y encestá encadenando canastas perfectas. | [juanr8234](https://github.com/juanr8234) |
| Memoria | Puzzle | Encontrá los pares: contrarreloj en solitario o por turnos en salas. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Kunai Strike | Precisión | Clavá kunais en el tronco que gira sin que se golpeen entre sí. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Keepers! | Reflejos | Sos el arquero en una tanda infinita de penales. | [emi1i0](https://github.com/emi1i0) |
| Rocket SpaceX | Carreras | Fútbol de autos 3D estilo Rocket League. | [matiasgzlez](https://github.com/matiasgzlez) |
| Western Shoot | Precisión | Dispará a los blancos para sumar puntos y a los bandidos para que no te eliminen. | [juanidrose11](https://github.com/juanidrose11) |
| Barra Libre | Arcade | Atendé las cuatro barras: llená jarras, servílas deslizando y atajá los vasos vacíos. | [emi1i0](https://github.com/emi1i0) |
| Crono Ciego | Precisión | Detené el cronómetro a ciegas lo más cerca del tiempo objetivo. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| El Trile | Reflejos | Seguí con la mirada el vaso que oculta la moneda. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| PONG | Arcade | Pong clásico de un jugador: devolvé la pelota, la velocidad sube y tenés una sola vida. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |
| Block Paddle | Arcade | Moví la barra para que la pelota no caiga; cada rebote suma y acelera. | [Facu-Basualdo](https://github.com/Facu-Basualdo) |

## Empezar

```bash
npm install
npm run dev      # servidor de desarrollo: landing en /, cada juego en /games/<id>/
npm run build    # type-check con tsc + build de producción
npm run preview  # sirve el build de producción localmente
```

El ranking global y las salas multijugador son **opcionales**: sin credenciales de Supabase los juegos funcionan igual (los récords locales se guardan en el navegador), solo que no aparece la UI de ranking ni de salas. Para habilitarlos, copiá `.env.example` a `.env` y completá tus credenciales.

## Contribuí con tu propio juego

**Este proyecto está pensado para crecer con la comunidad, y tu juego es bienvenido.** Si tenés una idea para un minijuego —por más simple que sea— animate a sumarla. Es una forma buenísima de practicar, de que tu juego lo pruebe gente de verdad, y de dejar tu nombre en un proyecto vivo.

Cada juego es **independiente**: no compartís código de motor con los demás, así que podés hacer el tuyo a tu manera sin romper nada. Los pasos completos para agregar uno están en [`CLAUDE.md`](CLAUDE.md) (sección "Adding a new minigame"), pero el resumen es:

1. Creá tu juego en `src/games/<id>/` y su HTML en `games/<id>/index.html`.
2. Registralo creando `src/games/<id>/meta.ts` con `export const meta: GameEntry` (mirá [`src/games/blind-time/meta.ts`](src/games/blind-time/meta.ts) como ejemplo). No hace falta tocar [`src/games.ts`](src/games.ts): descubre los juegos solo.
3. Sumá el countdown 3 / 2 / 1 / YA al empezar (patrón compartido, obligatorio).
4. Enganchá el ranking global y, si querés, el modo salas.
5. Corré `npm run build` para confirmar que tu juego se descubre.

Mirá cualquier carpeta de `src/games/<id>/` como referencia: cada una trae su propio `CLAUDE.md` explicando la mecánica y las decisiones no obvias.

### Cómo colaborar

1. Hacé un **fork** del repo.
2. Creá una rama para tu juego (`git checkout -b mi-juego`).
3. Desarrollá, probá con `npm run build` y hacé commit.
4. Abrí un **Pull Request** describiendo tu juego.

¿Dudas o ideas? Abrí un **Issue** para charlarlo antes de arrancar. Toda contribución suma. ¡Gracias por jugar y por construir!

### Convenciones

- Sin emojis en código, UI, comentarios ni commits.
- Mantené los `CLAUDE.md` actualizados cuando cambies estructura o convenciones.

## Licencia

[MIT](LICENSE) — usá, modificá y compartí libremente.
