# Conexiones disponibles en el backend que el front no usa

Fecha: 2026-09-10 · Front: `pipofy-backoffice` · Back: `pipofy-backend` (leído en `src/`)

Complemento inverso de [`api-faltantes.md`](./api-faltantes.md): ahí está lo que el front
necesita y el back no tiene; acá lo que el back **ya expone** y el front no consume. Varios
`ponytail:` del front están apoyados en supuestos que ya no son ciertos.

---

## Resumen

| # | Qué hay disponible | Qué se borra / desbloquea | Costo |
|---|---|---|---|
| 1 | ~~`GET /class-sessions` ya trae `waitingCount` y `classSessionStatus`~~ **HECHO** | `fetchWaitingCounts` (N+1) y el `Set _cancelled` | 2 campos en un DTO |
| 2 | ~~Los `list()` del back **ya filtran `deletedAt: null`**~~ **HECHO** | 7 `.filter()` en repos HTTP | borrar líneas |
| 3 | `GET /catalogs/:name` sirve los **16**, el front declara 6 | ⛔ nada: los 10 restantes no tienen consumidor | — |
| 4 | `GET /reservations?from&to&status` — nunca se llama | ⏸ le falta la pantalla, y a la pantalla el backend | — |
| 5 | `GET /:id` de detalle en 7 recursos | lista completa + `find()` en memoria | opcional |
| 6 | `GET /class-sessions?courtId&categoryGroupId` | filtrado en cliente de la grilla | opcional |
| 7 | `waOptIn` en students | ⏸ el backend lo escribe pero nunca lo lee | — |
| 8 | `POST /reservations/:id/attendance` (individual) | — | ninguno |
| 9 | `scheduleTemplateId` en `class-session` y `student` embebido en sus reservas | roster de grupos derivado, sin `GET /groups` nuevo | ⚠️ **declarados en el DTO, sin confirmar en vivo** — ver §10 |

---

## 1. `waitingCount` y `classSessionStatus` ya vienen embebidos · ✅ hecho (2026-09-10)

`class-sessions.service.ts:59-88` hace **dos `groupBy`** y devuelve por sesión:

```jsonc
{ "...": "fila de Prisma",
  "availableSpots": 0,
  "waitingCount": 3,
  "classSessionStatus": { "id": "2", "name": "cancelada" } }
```

`class-session.dto.ts` sólo declara `availableSpots`, así que valibot descarta los otros dos.
Consecuencias hoy:

- [http-dashboard.repository.ts:72](src/app/core/data/repositories/http-dashboard.repository.ts#L72)
  hace una llamada extra por cada sesión llena. Su comentario dice *"no se puede hacer sin tocar
  el backend"* — **ya está hecho**. `fetchWaitingCounts` entero se borra.
- [reservas.facade.ts:33](src/app/features/reservas/reservas.facade.ts#L33) guarda las clases
  canceladas en un `Set` en memoria que se pierde al recargar. Con `classSessionStatus.name` se
  lee del servidor. Esto es el item **#3 de `api-faltantes.md`, que ya no aplica**.

**Hecho:** el DTO declara los dos campos, la entidad expone `waitingCount` y `status` (+ un
`isCancelled()` para que el literal `'cancelada'` no viva en las pantallas), y se borraron
`fetchWaitingCounts`, el `Set _cancelled`, `marcarCancelada()` y el `reset()` que lo limpiaba.
`DashboardSources.waitingCounts` también desapareció: el contador viaja en la sesión.

**`waitingCount` vs `GET .../waiting-list`, verificado por lectura de código (2026-09-10):** el
detalle de un grupo muestra "En lista de espera" con el `waitingCount` de `GET /class-sessions`
en el hero, y debajo lista los nombres desde `GET /class-sessions/:id/waiting-list` — dos
fuentes para el mismo número en la misma pantalla. Leyendo las dos queries del backend:
`class-sessions.service.ts` calcula `waitingCount` con `waitingList.groupBy({ where: {
waitingListStatus: { name: 'esperando' } } })`, y `waiting-list.service.ts:list()` hace
`waitingList.findMany({ where: { classSessionId, waitingListStatus: { name: 'esperando' } } })`.
**Mismo filtro exacto**, sobre la misma tabla, sin paginado en ninguna de las dos —
estructuralmente no pueden divergir salvo por una carrera entre las dos requests (alguien se
une o se cae de la lista justo entre un `GET` y el otro). Esto es lectura de código, no una
comparación contra una respuesta real; no se cerró con datos en vivo (ver §10).

## 2. El backend ya filtra los borrados · ✅ hecho (2026-09-10)

Todos los `list()` (`students`, `courts`, `plans`, `schedules`, `categories`,
`category-groups`, `coaches`) tienen `where: { deletedAt: null, clubId }`. Los 6 `.filter()`
del front y sus comentarios son deuda vencida: item **#9 de `api-faltantes.md`, cerrado**.

Siguen haciendo falta (esos dos `findMany` no filtran):

- `GET /class-sessions/:id/reservations` → `class-sessions.service.ts:98`
- `GET /students/:id/plans` → `student-plans.service.ts:107`

**Hecho:** se borraron los 7 `.filter()` y el campo `deletedAt` de los DTO de lectura que
sólo existía para alimentarlos, junto con sus tests. Los 2 restantes quedaron con el
comentario acotado a esos dos endpoints.

## 3. Catálogos: el endpoint cubre 16, y los 10 que faltan no tienen consumidor · ⛔ no hace falta

`catalogs.controller.ts` deriva las rutas de `catalog/catalogs.const.ts`, así que `GET
/catalogs/:name` ya sirve los 16. El front declara 6. Revisados los 10 restantes **uno por
uno, buscando quién los mostraría hoy**, ninguno tiene consumidor:

| Catálogo | Por qué no se agrega |
|---|---|
| `class-session-statuses` | Lo resolvió §1: `GET /class-sessions` embebe `classSessionStatus.name`. No hay id que traducir. |
| `reservation-statuses` | `class-sessions.service.ts:98` hace `include: { reservationStatus }` — el nombre ya viene embebido. |
| `attendance-statuses` | No hay dónde mostrarlo: la asistencia **no se puede releer** (ver *Lo que sigue faltando*). El write-path manda el nombre, no el id. |
| `student-plan-statuses` | La columna está **muerta**: `student-plans.service.ts:63` y `coach-conversation.service.ts:837` son los únicos writes y los dos escriben `'activo'`. Nada transiciona a `agotado`/`vencido`/`cancelado`. La derivación por créditos+fecha de `student-plan.ts` es más fiel que el campo. |
| `waiting-list-statuses` | `waiting-list.service.ts:68` filtra a `'esperando'`: todas las filas que llegan tienen el mismo estado. |
| `payment-statuses`, `credit-reasons`, `reminder-types`, `replacement-statuses` | Sus módulos no tienen controller. No hay fila que traducir. |
| `tenant-types` | No hay endpoint de tenants ni pantalla. |

Agregarlos es una línea cada uno, pero una línea que nadie llama es una línea que después
alguien tiene que entender. **Se agrega el catálogo el día que aparece el id en pantalla**, no
antes. `CatalogsRepository` ya memoiza por nombre, así que el costo de sumarlo tarde es cero.

> Corregido de paso: `class-session.dto.ts` afirmaba que `GET /catalogs/*` no expone
> `attendance-statuses`. Sí lo expone.

## 4. `GET /reservations?from&to&status` — sigue sin consumidor · ⏸ bloqueado por diseño

`reservations.service.ts:18` devuelve las reservas del rango con `student`, `classSession` y
`reservationStatus` embebidos, filtrables por `held | confirmed | cancelled`. Existe y nadie
lo llama. **Mi propuesta anterior de usarlo para un `/comercial` mínimo estaba mal**: leída la
maqueta (`index-v2.html:981`), `/comercial` es *Conciliación de pagos* — transferencias
informadas por WhatsApp, con Confirmar/Rechazar por comprobante. Eso es la tabla `Payment`,
que no tiene controller. Una reserva `held` es un cupo reservado por vencer, **no** una
transferencia informada: poner una en el lugar de la otra sería inventar una pantalla que el
diseño no pide.

Los otros dos usos que había listado tampoco se sostienen:

- *KPIs del dashboard*: los tres (`sessionsToday`, `courtsTotal`, `occupancyPct`) ya salen
  completos de `/class-sessions` + `/courts`. No falta ninguno.
- *Badge de alertas*: la maqueta lo define como `holds + alertas + transferencias`
  (`index-v2.html:1941`). Con sólo los holds el número queda incompleto, y
  `nav-badges.service.ts` está en 0 justamente porque *"un badge con un número invita a
  hacerle caso"*.

Queda anotado como disponible. Le falta la pantalla, y la pantalla le falta el backend.

## 5–6. Detalle por id y filtros de la grilla · **P2**

Existen y no se usan: `GET /categories/:id`, `/category-groups/:id`, `/courts/:id`,
`/plans/:id`, `/schedules/:id`, `/students/:id`, `/coaches/:id`; y
`GET /class-sessions?courtId=&categoryGroupId=`. Hoy el front lista todo y busca en memoria.
Mientras el padrón sea chico eso está bien — lo que falta de verdad es **paginación y
búsqueda server-side en `/students`**, que el back tampoco tiene.

## 7. `waOptIn` del alumno · ⏸ el campo está dormido

`create-student.dto.ts` y `update-student.dto.ts` aceptan `waOptIn: boolean` y
`students.service.ts:56,92` lo persiste como `waOptInAt` + `waOptInSource: 'panel'`.

Pero **nadie lo lee**: un `grep waOptIn` sobre `pipofy-backend/src` da sólo esos dos writes.
El módulo `whatsapp` manda mensajes sin consultarlo. Así que un checkbox en el alta de alumno
hoy no cambia ningún comportamiento — es un campo de consentimiento que todavía no gatea
nada. Se agrega cuando `WhatsappService` lo respete, y ahí el checkbox importa de verdad.

## 8. Asistencia individual

`POST /reservations/:id/attendance` existe además del bulk que el front ya usa. No hace falta
hoy (la pantalla marca toda la clase de una), queda anotado para no reinventarlo.

## 9. Releer la asistencia · ✅ hecho (2026-09-10) · **tocó el backend**

Único item de esta tanda que cruzó de repo, con OK explícito. Era el de mejor relación
impacto/tamaño: la pantalla de asistencia ya existía y **perdía lo que el usuario marcaba** —
`attendance` era, en la práctica, una tabla de sólo escritura para el panel.

**Backend** (`class-sessions.service.ts:99`): `include: { attendances: true }` y un `map` que
aplana a `attendanceStatus: {id, name} | null`, por la cache de catálogos y sin join, igual que
`classSessionStatus` en `list()`. El array tiene a lo sumo un elemento (`Attendance` es
`@@unique([reservationId])`) y la fila cruda se descarta: `classSessionId`/`studentId` ya están
en la reserva y `respondedVia`/`respondedAt` no los usa nadie.

**No filtra `deletedAt`, a propósito.** El `upsert` de `AttendanceService.mark()` busca por
`reservationId` sin mirarlo, así que una fila borrada sigue siendo LA fila de esa reserva y el
writer la revive. Filtrarla en la lectura la ocultaría mientras la escritura la sigue usando.

**Front:**

- `SessionReservation.attendanceStatus` llega **crudo**, y `asistenciaTomada()` lo estrecha a
  `'asistio' | 'ausente' | null`. Los tres estados que escribe WhatsApp —`confirmo_si`,
  `confirmo_no`, `sin_respuesta`— caen a null: son la respuesta del *alumno*, no asistencia
  tomada por el profe. Pintar un `confirmo_si` como Presente afirmaría algo que nadie afirmó.
- La planilla muestra `marcas()[id] ?? asistenciaTomada(r)`. Siguen siendo **dos señales
  distintas** a propósito: `marcas()` es lo pendiente de guardar y es lo único que habilita el
  botón. Sembrarla con lo persistido dejaría "Guardar" prendido sin que nadie toque nada y
  reenviaría la clase entera en cada click.
- «Vinieron todos» sólo toca las filas en blanco: pisar con 'asistio' a alguien guardado como
  ausente no es lo que dice el botón.
- `tomarAsistencia()` ahora **relee siempre**, no sólo ante fallos per-ítem. Esa relectura es
  lo que deja la planilla marcada; su comentario decía que releer era un GET al pedo y dejó de
  ser cierto con este cambio.

Esto cierra el item **#2 de `api-faltantes.md`**.

---

## 10. `scheduleTemplateId` y `student` embebido en las reservas · ⚠️ declarados, sin confirmar en vivo (2026-09-10)

Dos conexiones más que estaban disponibles y sin usar, mismo patrón que §1: el backend ya
mandaba el dato, el front no lo declaraba.

- `class-sessions.service.ts:list()` no hace `select`: devuelve `{ ...session, ... }`, el spread
  de la fila cruda de `classSession.findMany()`. `schedule_template_id` es columna nativa de esa
  tabla, así que viaja en el spread sin necesidad de ningún `include`.
- `class-sessions.service.ts:listReservations()` agrega `include: { student: true, ... }` al
  `findMany` de reservas y devuelve `{ ...reservation, ... }` sin destructurar `student` (sí
  descarta `attendances`, que se aplana aparte — ver §9).

Con esto, `/grupos` no necesitó `GET /groups` ni `GET /schedules/:id/roster`: el grupo sale de
`GET /schedules` y sus sesiones de `GET /class-sessions` agrupadas por `scheduleTemplateId`; el
roster de cada sesión, de `student` embebido en `GET /class-sessions/:id/reservations`. Cierra
la pregunta de endpoint del item **§1 de `api-faltantes.md`**.

**Este riesgo no es sólo de `/grupos`.** Los dos campos se declararon en schemas que ya
parseaban otras pantallas, no en uno exclusivo de esta entrega. `ClassSessionDtoSchema` (que
declara `scheduleTemplateId`) la parsea `HttpClassSessionsRepository.list()`, y de ahí salen
tanto el **dashboard** (`HttpDashboardRepository.getSnapshot()`) como la grilla de
**`/reservas`** (`ReservasFacade`) — además de `listRange()`, que es el método nuevo que usa
`/grupos`. `SessionReservationDtoSchema` (que declara `student`) la parsea
`HttpClassSessionsRepository.reservations()`, que además del roster de `/grupos` es el roster y
la planilla de asistencia del **modal de `/reservas`** (`SesionFacade.loadReservations()`). Si
alguno de los dos campos no viniera de verdad en la respuesta, el `v.parse` no tira sólo
`/grupos`: tira también esas dos pantallas, que hoy funcionan.

**Sin confirmar en vivo.** Los dos campos se declararon leyendo `class-sessions.service.ts`, no
contra una respuesta real del servidor — que es exactamente el paso que faltó para §1, §2 y §9
de este mismo documento cuando se propusieron (y que en su momento tampoco se hizo con curl:
se dieron por buenos por lectura de código + la suite del front contra dobles, hasta que esta
tarea puntual —2026-09-10, ver `.superpowers/sdd/2026-09-10-grupos-conectados/task-5-brief.md`—
se propuso confirmarlo con el backend levantado). El intento de correr el `curl` real contra un
club con datos reales quedó bloqueado por el clasificador de riesgo del entorno de desarrollo,
no por el backend (que arriba y responde sin problema); detalle completo en
`.superpowers/sdd/2026-09-10-grupos-conectados/task-5-report.md`. Dato para quien lo reintente:
`prisma/seed.ts` del backend sólo siembra los 16 catálogos, **no crea usuarios** — no hay
credenciales de prueba en la semilla.

---

## Lo que sigue faltando (no cambia respecto de `api-faltantes.md`)

Modelos que están en `schema.prisma` y **no tienen controller**, así que no hay nada que
conectar todavía:

`Payment` · `CreditLedger` · `Replacement` · `WaTemplate` · `ScheduledReminder` ·
`ConversationState` · `PendingPaymentNotice`

Y las dos deudas de modelo:

- ~~**Releer la asistencia.**~~ ✅ **hecho (2026-09-10)** — se tocó el backend: `listReservations`
  ahora incluye `attendances` y las aplana a `attendanceStatus: {id, name} | null` con la misma
  cache de catálogos que `classSessionStatus`. Del lado del front, `SessionReservation` trae
  `attendanceStatus` crudo + `asistenciaTomada()` para estrecharlo, la planilla muestra lo ya
  guardado y `tomarAsistencia()` relee siempre. Detalle en `§9`.
- ~~**Roster de grupos.**~~ **Ya no es una decisión pendiente**: se eligió (a) derivado — ver
  §10. Lo que queda es un techo con salida conocida, no una elección: sin la tabla `enrollment`
  no hay créditos ni % de asistencia **por inscripción**, que es lo que la maqueta modelaba
  (`creditsRemaining` / `attendanceRate` del roster, borrados al conectar). Sigue en
  `api-faltantes.md` §1.

---

## Orden sugerido

1. ~~**§1 + §2**~~ ✅ hecho — era todo lo que se podía conectar sin decidir nada.
2. **Nada más del lado del front.** §3, §4 y §7 se revisaron uno por uno y ninguno tiene
   consumidor hoy: o los cubrió §1, o esperan una pantalla, o esperan que el backend lea el
   campo. Construirlos ahora es código que nadie llama.
3. ~~**§9** Releer la asistencia~~ ✅ hecho — tocó el backend.
4. **§10** `scheduleTemplateId` + `student` de grupos — declarado, **falta confirmar en vivo**
   antes de dar por buena la conexión de `/grupos` (ver `api-faltantes.md` §1).
5. **El cuello de botella es el backend**, no el front. Por impacto:
   1. Controller de `Payment` — desbloquea `/comercial` entero y el badge de pagos.
   2. Tabla `enrollment` — créditos y % de asistencia por inscripción en el roster de grupos
      (`/grupos` ya no es 100% dummy, pero esas dos columnas siguen sin poder calcularse).
