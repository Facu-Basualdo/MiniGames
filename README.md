# MiniGames

Una colección de minijuegos para el navegador, cada uno jugable por separado, con una landing para elegir cuál jugar. Ranking global, portadas y un modo multijugador por salas para jugar con amigos.

**Jugá online:** https://juegachos.com

Hecho con **Vite + TypeScript** (sin framework) y desplegado como sitio estático en Vercel. Los juegos 3D usan **Three.js**; el ranking global y las salas usan **Supabase**.

## Juegos

| Juego | Categoría | De qué va |
|---|---|---|
| Neon Vortex | Arcade | Esquivá las porciones que giran alrededor del cilindro neón. |
| Flappy Bird | Arcade | Aleteá y cruzá la mayor cantidad de tubos sin chocar. |
| Torre Infinita | Precisión | Soltá cada bloque en el momento justo y apilá la torre más alta. |
| Beat Fever | Ritmo | Tocá las notas justo al cruzar la línea y encadená combos. |
| Bounce Rush | Arcade | Saltá entre plataformas y cambiá de carril a tiempo. |
| Reflex | Reflejos | Poné a prueba tus reflejos en 5 rondas de tiempo de reacción. |
| Skyline | Precisión | Levantá el rascacielos más alto sin perder el equilibrio. |
| Numerix | Puzzle | Ordená los números deslizando filas o columnas. |
| Asteroides | Arcade | El clásico: navegá con inercia y dispará a las rocas. |
| Cruce Mortal | Arcade | Cruzá calles y ríos saltando sobre troncos flotantes. |
| Neon Drift | Carreras | Carrera 2D en circuitos neón con los autos de todos en vivo. |
| Odd One Out | Reflejos | Encontrá la ficha con el tono distinto antes de que se acabe el tiempo. |
| Memoria | Puzzle | Encontrá los pares: contrarreloj en solitario o por turnos en salas. |
| Kunai Strike | Precisión | Clavá kunais en el tronco que gira sin que se golpeen entre sí. |
| Keepers! | Reflejos | Sos el arquero en una tanda infinita de penales. |
| Rocket SpaceX | Carreras | Fútbol de autos 3D estilo Rocket League. |
| Crono Ciego | Precisión | Detené el cronómetro a ciegas lo más cerca del objetivo. |
| El Trile | Reflejos | Seguí con la mirada el vaso que oculta la moneda. |

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
2. Registralo en [`src/games.ts`](src/games.ts).
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
