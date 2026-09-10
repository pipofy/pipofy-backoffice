# Checklist de revisión visual — lo único que ningún test cubre

Todo lo demás del plan está verificado por tests, lint, greps o matemática de contraste.
Esto no: hay que abrir el navegador. Consolidado de los 16 reportes de tarea.

```bash
npm start   # el proxy /api apunta a localhost:3000
```

## 1. La marca (Tasks 1-4)

- [ ] **Sidebar del shell (244px de ancho)** — el logo horizontal tiene ratio 3.45:1;
      confirmar que entra sin desbordar ni recortarse.
- [ ] **Masthead de `/login` y header de `/onboarding`** — el mismo brandmark en
      superficies distintas.
- [ ] **Columnas de números del dashboard** (`.mono`, `.count`) — tienen que quedar
      alineadas en columna. Si no lo están, `--font-mono` no quedó monoespaciada.
- [ ] **Favicon** — la pestaña tiene que mostrar el isotipo de Pipofy, no el de Angular.
      Si no cambia, forzar recarga dura (el navegador cachea favicons con ganas).

## 2. La paleta, y el punto que más me preocupa (Task 2)

- [ ] **Los 17 consumidores de `--color-accent-*`.** Eran verdes y ahora son azules.
      El riesgo concreto: **"ok" y "primario" pasaron a ser el mismo azul**, así que un
      badge "confirmado" ya no se distingue de un botón primario. Está documentado con un
      `ponytail:` en `tokens.css` y es la consecuencia aceptada de "todo azul" — pero es
      lo primero que hay que mirar, porque si molesta, la salida ya está escrita ahí.
      Mirar: dashboard (badges de sesión), `.sess.open`, barras de ocupación.
- [ ] **Contraste sobre fondos claros.** Los 17 ratios están calculados y verificados por
      código; esto es sólo confirmar que no hay azul sobre azul ilegible en algún lugar
      que la matemática no previó.

## 3. Los placeholders (Tasks 5, 9-15)

- [ ] **Las cuatro ilustraciones** — abrir una pantalla de cada tono:
      `empty` (una lista vacía), `error` (cortar el backend y recargar),
      `loading` (se ve un instante; con red lenta simulada se ve mejor),
      `wip` (`/comercial` o `/plantillas`).
- [ ] **La pelota del estado de carga gira**, y **deja de girar** con "reducir
      movimiento" activado en el sistema.
- [ ] **`size="page"` dentro y fuera del shell.** `shell.component.css` redefine la escala
      `--text-*` en su `:host`, así que el mismo primitivo renderiza **más denso adentro**.
      Comparar `/asdf` (404, dentro del shell) contra `/login` con credenciales malas
      (fuera). Los dos tienen que verse bien, no necesariamente iguales.
- [ ] **Placeholder dentro de un `<td colspan>`** — buscar un grupo inexistente en
      `/grupos` para forzar el vacío de búsqueda dentro de la tabla.
- [ ] **Placeholder dentro del `.rail` angosto** de `waitlist-card` en el dashboard
      (breakpoint ≥1280px).
- [ ] **Los tres vacíos del modal de sesión** en `/reservas` — abrir una clase sin
      anotados.

## 4. El espaciado — donde estuvo el bug más sutil (Tasks 10, 15)

- [ ] **Modales con error de validación** — guardar un formulario incompleto en cualquier
      modal de configuración. Tiene que haber **una** separación entre el aviso rojo y los
      campos, no cero y no doble. Ahí vivía la regla `.form-error` que absorbí en el
      primitivo.
- [ ] **Las 5 pantallas de auth** — mismo chequeo. Acá el `.card` usa `flex` con `gap`, y
      el gap y el margen **se suman**; hay un override de una línea que lo neutraliza.
      Si ves doble separación, ese override no está funcionando.
- [ ] **Banners de página** (arriba de las tablas de configuración) — ganaron 16px de
      separación que antes no tenían. Fue una decisión, no un accidente.

## 5. Colores de estado (Task 6 en adelante)

- [ ] **Los errores ahora son rojos, no amarillos.** 30 pantallas. Antes un error de red
      se veía igual que un aviso de cupo.
- [ ] **Las advertencias legítimas siguen amarillas** — el aviso de "se van a generar N
      clases" en el modal de generar clases de `/configuracion/horarios` es el caso a
      mirar: quedó a propósito como `.notice hold` crudo.

## 6. Detalles menores

- [ ] El botón **Reintentar** de `/configuracion/club` (cortar el backend) — se proyecta
      dentro del placeholder.
- [ ] El link **"Volver a la lista"** en `/grupos/<id-inexistente>`.
- [ ] El `.hint` de la sección de asistencia en `/reservas` — se borró una regla local
      duplicada; tiene que verse igual que antes.
- [ ] El párrafo informativo de `/configuracion/profesores` — volvió a `.a-body` después
      de un rodeo.
