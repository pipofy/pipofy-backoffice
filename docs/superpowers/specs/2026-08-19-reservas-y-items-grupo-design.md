# Reservas e items de grupo de categoría — diseño

Fecha: 2026-08-19
Estado: aprobado, listo para plan de implementación

## 1. Contexto

El backend `pipofy-backend` tiene el motor de reservas completo y el backoffice no lo consume.
De los endpoints que la API expone hoy, el front no usa ninguno de estos:

| Endpoint | Estado |
|---|---|
| `POST /class-sessions/:id/reservations` | sin UI |
| `POST /reservations/:id/confirm` | sin UI |
| `DELETE /reservations/:id` | sin UI |
| `POST /class-sessions/:id/waiting-list` | sin UI (el dashboard sólo hace el GET) |
| `DELETE /waiting-list/:id` | sin UI |
| `POST /category-groups/:id/items` | sin UI |
| `DELETE /category-groups/:id/items/:categoryId` | sin UI |
| `POST /reservations/:id/confirm-payment` | bloqueado: pide `paymentMethodId`, no hay catálogo |
| `POST /students/:id/plans` | bloqueado: mismo motivo |
| `POST /users` | bloqueado: pide `roleId`, no existe `GET /roles` |

Los items de grupo no son una feature suelta: `ClassSessionsService.reserve()` y
`WaitingListService.join()` validan que la categoría del alumno pertenezca al
`categoryGroup` de la sesión, y `prisma/seed.ts` no siembra `category_group_item`. En un club
nuevo, **toda** reserva y toda alta de lista de espera devuelven 400 hasta que alguien cargue
esos items. Sin esa pantalla, `/reservas` no puede inscribir a nadie.

## 2. Alcance

**Adentro:** flujo de reserva (crear hold, confirmar, cancelar), lista de espera completa
(leer, anotar, quitar), y la carga de items de grupo de categoría.

**Afuera, y por qué:**

- `POST /plans/:id/categories` — write-only igual que los items, pero no bloquea nada. Entra
  cuando el GET de plans devuelva sus categorías.
- venta de plan, alta de profesor, `confirm-payment` — bloqueados por catálogos inexistentes.
- `/grupos`, `/comercial`, `/plantillas` — necesitan endpoints que no existen (roster de
  sesión, asistencia, pagos, WhatsApp). Cada uno es su propio ciclo de spec.

**Restricción dura del proyecto: no se toca la API.** Todo lo de acá abajo sale con el backend
tal como está hoy.

## 3. Decisiones y sus techos

| Decisión | Alternativa descartada | Techo que aceptamos |
|---|---|---|
| Pantalla propia `/reservas` | modal desde la grilla del dashboard | una feature más, y duplica el patrón de lectura de sesiones (mitigado extrayendo `ClassSessionsRepository`) |
| Hold y confirm en **dos pasos** | un botón que encadena crear+confirmar | los holds pendientes viven en memoria: salir de `/reservas` los pierde de vista aunque sigan vivos en la base |
| Items con checkbox + `localStorage` autocorrectivo | agregar/quitar a ciegas | la pista puede estar desactualizada; se corrige sola al primer click |
| Dos contratos por concepto | uno por recurso del backend (3), o uno solo (1) | `reserve` cuelga del path de class-sessions pero vive en `ReservationsRepository` |

No hay `GET /reservations`. Esa única ausencia es la que fuerza el techo de la fila 2: el front
sólo conoce el id de una reserva en el momento en que la crea.

## 4. Arquitectura

### 4.1 Dominio

```
domain/entities/class-session.ts
  ClassSession { id, courtId, coachId, categoryGroupId, startAt: string|null,
                 capacity: number, availableSpots: number }

domain/entities/reservation.ts
  Reservation      { id, holdExpiresAt: string|null }
  ReservationDraft { sessionId, studentId, studentPlanId }
  createReservationDraft(input): ReservationDraft   // tira InvalidReservationError sin plan

domain/entities/waiting-list.ts
  WaitingListEntry { id, studentId, requestedAt: string|null }

domain/contracts/class-sessions.repository.ts
  list(dateKey: string): Promise<ClassSession[]>
  waitingList(sessionId: string): Promise<WaitingListEntry[]>
  joinWaitingList(sessionId: string, studentId: string): Promise<void>
  leaveWaitingList(entryId: string): Promise<void>

domain/contracts/reservations.repository.ts
  reserve(draft: ReservationDraft): Promise<Reservation>
  confirm(id: string): Promise<void>
  cancel(id: string): Promise<void>
```

`Reservation` tiene dos campos a propósito. El nombre del alumno y los datos de la clase ya
los tiene la facade en memoria; lo único que no puede saber por su cuenta es el id y hasta
cuándo vive el hold.

`capacity` se normaliza a `0` en el mapper: en Prisma es nullable y hoy esa normalización vive
en `dashboard.mapper.ts`. Al bajarla a la entidad, los dos consumidores la heredan.

**Desvío consciente de la convención "las escrituras devuelven `void`"**: `reserve()` devuelve
`Reservation`. Es la única vía por la que el front se entera del id, y sin id no hay confirm ni
cancel. Va documentado en el contrato.

### 4.2 Data

```
dto/class-session.dto.ts        (existente) + ReservationDtoSchema
                                 + WaitingListDtoSchema pasa a validar campos
mappers/class-session.mapper.ts  DTO -> ClassSession, DTO -> WaitingListEntry
mappers/reservation.mapper.ts    DTO -> Reservation
repositories/http-class-sessions.repository.ts
repositories/http-reservations.repository.ts
```

**Segundo desvío consciente**: `WaitingListDtoSchema` hoy es `v.array(v.unknown())` y su
comentario dice que ningún consumidor lee los campos de las entradas
([class-session.dto.ts](../../../src/app/core/data/dto/class-session.dto.ts)). A partir de
esta feature sí: el modal muestra el alumno y necesita el `id` para el DELETE. Pasa a validar
`id`, `studentId` y `requestedAt`, y el comentario se actualiza.

Todos los ids llegan como string: `app.module.ts` del backend polyfillea
`BigInt.prototype.toJSON`. Las fechas llegan como ISO.

### 4.3 La ventana UTC, arreglada de raíz

`ClassSessionsService.list()` arma la ventana con ``new Date(`${filters.from}T00:00:00Z`)``.
La `Z` es literal, así que interpreta las fechas en UTC y no en la zona del club: pedir sólo
"hoy" desde Argentina pierde las clases de 21:00 a 23:59, que es prime time.

Hoy el dashboard compensa eso con la lógica repartida entre `http-dashboard.repository.ts`
(pide ±1 día) y `dashboard.mapper.ts` (`isOnLocalDate` filtra). El contrato nuevo toma **una**
fecha local y hace las dos cosas adentro:

```ts
list(dateKey: string)   // pide from=dateKey-1, to=dateKey+1 y filtra por fecha local exacta
```

Así el arreglo vive en un solo lugar y `/reservas` lo hereda sin repetirlo.

### 4.4 Feature nueva

```
features/reservas/
  reservas.routes.ts        facades y providers en la ruta, según la convención
  reservas.providers.ts
  reservas.facade.ts        sesiones de la fecha elegida
  sesion.facade.ts          lista de espera + holds pendientes de la sesión abierta
  pages/reservas-page.component.{ts,html,css}
  components/sesion-modal.component.ts
```

Dos facades y no una por el mismo motivo que
[alumno-planes.facade.ts](../../../src/app/features/alumnos/alumno-planes.facade.ts):
`SignalStore` tiene una sola tríada `data/loading/error`. Con una sola facade, abrir el modal
prendería el spinner de la tabla y un error del modal taparía el de la lista.

`reservas.providers.ts` bindea `ClassSessionsRepository`, `ReservationsRepository`,
`StudentsRepository`, `PlansRepository`, `CourtsRepository`, `CoachesRepository` y
`CategoryGroupsRepository`. Los repositorios no tienen estado, así que convivir con los
bindings de otras rutas no cuesta nada — mismo argumento ya escrito en
[alumnos.providers.ts](../../../src/app/features/alumnos/alumnos.providers.ts).

Además: `/reservas` en `app.routes.ts` (dentro del shell, bajo `authGuard`), un `NavItem` nuevo
en el grupo Operación y su `NavIcon` con el `<svg>` correspondiente en `shell.component.html`.

### 4.5 Colateral en código existente

`http-dashboard.repository.ts` deja de pegarle crudo a `/class-sessions` en sus dos métodos
privados y pasa a inyectar `ClassSessionsRepository`. Eso arrastra:

- `dashboard.providers.ts`: bindea `ClassSessionsRepository`.
- `dashboard.mapper.ts`: `toDashboardSnapshot` recibe `ClassSession[]` en vez de
  `ClassSessionDto[]`; `isOnLocalDate` se muda al repositorio.
- `dashboard.mapper.spec.ts` y `http-dashboard.repository.spec.ts`: fixtures migradas.

Es el precio de no duplicar la lectura de sesiones, y la razón por la que elegimos este corte
de contratos.

## 5. Pantalla `/reservas`

### 5.1 Lista

Un `<input type="date">` nativo arrancando en hoy, y la tabla de esa fecha:

| hora | cancha | categoría | profesor | cupo |
|---|---|---|---|---|

`cupo` es `capacity − availableSpots` sobre `capacity`. Los nombres salen de
`CourtsRepository`, `CoachesRepository` y `CategoryGroupsRepository` — cuatro lecturas en
paralelo al cargar, igual que el dashboard. Click en la fila abre el modal.

Cambiar la fecha re-lee sólo las sesiones; los tres catálogos de nombres no se vuelven a pedir.

### 5.2 Modal de sesión

**Bloque 1 — Inscribir.** Select de alumno + select de plan → `POST .../reservations`. El hold
resultante cae en el bloque 2.

El plan es **obligatorio**. `confirm` exige una reserva con plan y créditos; sin eso responde
*"Requiere pago manual, usar /reservations/:id/confirm-payment"*, y ese endpoint está bloqueado.
Reservar sin plan sería fabricar un hold que nadie puede confirmar y que se evapora en 30
minutos. El select lista sólo los planes usables hoy (`studentPlanIsUsable`), y si el alumno no
tiene ninguno el botón queda deshabilitado diciendo por qué.

Del select de alumnos se excluyen los que tienen `categoryId === null`: de esos el front sabe
con certeza que la API los va a rechazar. Los demás se muestran **todos**. El front no puede
saber qué categorías tiene un grupo (§6), así que si la API responde *"El alumno no pertenece a
la categoría de esta clase"*, ese mensaje se muestra tal cual. Se descartó usar la pista de
`localStorage` para filtrar el select: una pista desactualizada escondería alumnos válidos, y
equivocarse escondiendo es peor que equivocarse mostrando.

**Bloque 2 — Pendientes de confirmar.** Los holds creados en esta visita: alumno, cuenta
regresiva hasta `holdExpiresAt` y los botones Confirmar y Cancelar.

La cuenta regresiva es una función pura `minutosRestantes(holdExpiresAt, now)` más una señal
`now` que avanza con un `setInterval` de 30 s, limpiado en `ngOnDestroy`. 30 s y no 1 s: el
hold dura 30 minutos, el segundero no aporta nada.

Los holds viven en `SesionFacade`, provista **en la ruta**, así que cerrar y reabrir la sesión
no los pierde. Salir de `/reservas` sí. Va marcado con un comentario `ponytail:` que nombra la
salida: `GET /reservations?status=held`.

**Bloque 3 — Lista de espera.** Se lee al abrir. Cada fila con su botón quitar
(`DELETE /waiting-list/:id`), más "anotar alumno" (`POST .../waiting-list`).

### 5.3 Refrescos después de escribir

Según la convención del repo, tras escribir se re-lee en vez de parchear en memoria:

| acción | refresca |
|---|---|
| reservar | sesiones (cambió `availableSpots`) + agrega el hold local |
| confirmar | sesiones + saca el hold de pendientes |
| cancelar | sesiones **y lista de espera** |
| anotar / quitar de la lista | lista de espera |

Lo de cancelar no es obvio y es la razón de que esté escrito: `ReservationsService.cancel()`
**promueve automáticamente** al primero de la lista de espera creando un hold nuevo y marcando
la entrada como `notificado`. O sea que cancelar acorta la lista de espera sin que el usuario
haya tocado ese bloque. Ese hold promovido es invisible para el front — no hay `GET
/reservations` —, lo cual es correcto: lo maneja el canal de WhatsApp, no el panel.

## 6. Items de grupo de categoría

La API acepta las escrituras pero **ningún GET devuelve la asignación**:
`CategoryGroupsService.list()` y `getOne()` son `findMany`/`findUnique` pelados, sin `include`.

Cada fila de Grupos de Categoría gana un botón *Categorías* que abre un modal con una checkbox
por categoría del club. El tilde es optimista: se pinta al instante, se manda la escritura, y
sólo se revierte si falla de verdad.

**La idempotencia sintética vive en el repositorio, no en la facade:**

- tildar → `POST .../items`; un **409** (*"La categoría ya está en el grupo"*) retorna sin lanzar
- destildar → `DELETE .../items/:categoryId`; un **404** (*"La categoría no está en el grupo"*)
  retorna sin lanzar

En los dos casos el estado final es el que el usuario pidió, así que es éxito. El contrato lo
declara: `addItem` y `removeItem` son idempotentes. Eso es lo que hace que la vista converja a
la verdad con cada click en vez de quedarse mintiendo.

**Detalle de capas**: `ApiClient` normaliza a `DomainError` antes de que el repo vea el status,
y un 409 y un 400 llegan los dos como `{kind:'domain'}` — indistinguibles. Se evaluó abrirle un
`kind:'conflict'` a `DomainError`, pero
[http-auth.repository.ts](../../../src/app/core/data/repositories/http-auth.repository.ts) ya
fijó la regla contraria y la dejó escrita: *"el significado de un código HTTP depende del
endpoint, por eso el mapeo específico vive acá y to-domain-error.ts no se toca"*. Estos dos
métodos hablan con `HttpClient` directo, igual que hace todo `HttpAuthRepository`.

**Estado local**: `grupo-items-store.ts`, `localStorage`, clave `PipoFy:grupo-items:v1`
siguiendo la de sesión, shape `Record<groupId, categoryId[]>`. Borrar un grupo limpia su
entrada. El modal lleva al pie una línea honesta: la API no devuelve la asignación y esta vista
recuerda lo cargado desde este navegador.

Se calca la forma de
[onboarding-persistence.service.ts](../../../src/app/features/onboarding/onboarding-persistence.service.ts).

## 7. Errores

**`to-domain-error.ts` y `domainErrorMessage()` no se tocan en todo el plan.**

`toDomainError` ya mapea 400 y 409 a `{kind:'domain', message}` con el texto del backend, y
`domainErrorMessage()` lo devuelve sin tocar. Así que *"No hay cupo disponible"*, *"El hold
expiró"*, *"La reserva no está en estado held"*, *"El alumno no pertenece a la categoría de
esta clase"* y *"El alumno ya está en la lista de espera de esta clase"* llegan a la pantalla
como copy útil sin agregar un solo `kind` — que es justo lo que evita romper el `switch`
exhaustivo.

Hay **una** invariante síncrona nueva: no se reserva sin plan. Va como
`createReservationDraft()` en la entidad, tirando `InvalidReservationError` — otra subclase de
`DomainRuleError` en `errors.ts`, junto a las demás. La facade la llama *dentro* de la promesa
de `run()`, igual que `createCourtDraft`, para que salga normalizada por la misma vía que un
fallo del repo. La UI ya deshabilita el botón; la entidad no confía en la UI.

## 8. Tests

Vitest + `TestBed`, specs colocados junto al archivo, dobles como objetos planos casteados al
contrato, `provideZonelessChangeDetection()` siempre.

- **mappers**: nullables de `startAt`; `capacity` null → 0
- **`HttpClassSessionsRepository.list()`**: pide ±1 día y filtra por fecha local. El test que
  hoy justifica el workaround en el dashboard se muda acá
- **`addItem` / `removeItem`**: 409 y 404 **no lanzan**; cualquier otro status sí. Es el test
  más importante de los nuevos: es la única defensa de la idempotencia sintética
- **`SesionFacade`**: reservar deja el hold en pendientes; confirmar lo saca; **cancelar
  refresca sesiones y lista de espera**
- **`minutosRestantes`**: función pura, sin timers ni relojes
- **`grupo-items-store`**: round-trip y limpieza al borrar un grupo
- **migración**: fixtures de `dashboard.mapper.spec.ts` y `http-dashboard.repository.spec.ts`
  de DTO a entidad

## 9. Techos, con su salida

Todos van con comentario `ponytail:` en el código:

| Techo | Salida |
|---|---|
| Los holds pendientes se pierden al salir de `/reservas` | `GET /reservations?status=held` |
| La asignación de items no se puede leer | `include: { items: { include: { category: true } } }` en el list y el getOne de category-groups |
| No se puede inscribir a un alumno sin plan | `GET /catalogs/payment-methods` habilita `confirm-payment` |
| El select de alumnos no filtra por categoría del grupo | el mismo `include` de la fila 2 |
| Cuatro lecturas en paralelo por carga de pantalla | un endpoint agregador, el mismo que le falta al dashboard |
