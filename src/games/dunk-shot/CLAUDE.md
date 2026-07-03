# Dunk Shot

Encestar la pelota de aro en aro arrastrando estilo gomera (slingshot). Canvas 2D a resolución lógica 480x760 escalada al viewport, mundo en píxeles con cámara que sube.

## Mecánica

- La pelota descansa dentro del aro actual. Arrastrar en cualquier parte del canvas y soltar la lanza en dirección opuesta al arrastre (velocidad = largo del arrastre * `LAUNCH_POWER`, con tope `MAX_LAUNCH_SPEED`; arrastres menores a `MIN_DRAG` se cancelan). Mientras se apunta se dibuja la trayectoria prevista con puntos (misma integración que la física, incluye rebote en paredes).
- Física: gravedad, rebote en las paredes laterales (`WALL_RESTITUTION`) y en los dos extremos del aro, que son círculos sólidos de radio `RIM_END_RADIUS` (`RIM_RESTITUTION`). No hay techo ni tablero.
- Enceste: la pelota cruza la línea del aro hacia abajo (`velY > 0`) con el centro dentro de la abertura (`RIM_RADIUS - 12`). Se detecta contra ambos aros: volver a caer en el aro propio simplemente reposiciona la pelota sin puntos.
- Puntaje: canasta normal = 1 punto y corta la racha. Canasta perfecta (sin tocar ningún extremo de aro en todo el vuelo; los rebotes en pared no la rompen) suma `1 + racha` puntos con racha creciente (2, 3, 4...).
- Tras encestar, el aro destino pasa a ser el actual y se genera uno nuevo en la mitad opuesta de la pantalla, entre `HOOP_MIN_RISE` y `HOOP_MAX_RISE` px más arriba. La cámara se acomoda con easing para dejar el aro actual en `CAMERA_HOOP_VIEW_Y`.
- Aros móviles: a partir de `HOOP_MOVE_START` canastas los aros nuevos oscilan horizontalmente alrededor de `baseX` (seno con fase aleatoria), con amplitud y velocidad que suben linealmente durante `HOOP_MOVE_RAMP` canastas hasta `HOOP_MOVE_AMP_MAX` / `HOOP_MOVE_SPEED_MAX`. La amplitud se recorta para que el swing completo (aro incluido) quede dentro de las paredes. La pelota en reposo acompaña a su aro; los aros con `amp > 0` se dibujan con glow para que el peligro se lea de un vistazo.
- Derrota: la pelota cae por debajo del borde inferior de la vista (+80 px de margen).

## Decisiones no obvias

- La física corre en subpasos de 1/120 s (`PHYSICS_STEP`) para que las colisiones con los extremos del aro y la detección de cruce no tunneleen a velocidad máxima.
- El aro no tiene colisión en su línea horizontal: solo los dos extremos son sólidos, igual que el juego original; la red es puramente decorativa.
- El dibujo intercala mitades del aro (parte trasera de la elipse debajo de la pelota, parte delantera encima) para que la pelota parezca estar dentro del aro.
- Enter/Espacio solo inician desde los menús; durante el juego el único input es el arrastre (pointerdown en el canvas, move/up en window para poder arrastrar fuera del canvas).
- Sonidos sintetizados con Web Audio en `SoundEffects.ts` (sin assets); el tono del enceste perfecto sube con la racha.
- Countdown 3/2/1/YA obligatorio, ranking global (`hud.showRanking("dunk-shot", score)`) y modo sala (`initRoomMode("dunk-shot", ...)`) cableados según el patrón del repo.
