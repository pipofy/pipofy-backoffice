# API faltante para borrar lo dummy

Fecha: 2026-09-03 · Frente: `pipofy-backoffice` · Backend: `pipofy-backend` (NestJS + Prisma)

Inventario de lo que todavía es maqueta/dummy en el backoffice y el endpoint que hace falta
para conectarlo. Ordenado por lo que hay que borrar, no por lo que hay que construir.

Convención: todo id sale como **string** (ya hay polyfill de `BigInt.prototype.toJSON`) y toda
fecha en **ISO**. El front NO quiere strings preformateados (`'Lun'`, `'01/07'`, `'hace 2 días'`):
eso ya lo resuelve `@domain/local-date`.

---

## Resumen

| # | Qué es dummy | Endpoint que falta | Qué se borra |
|---|---|---|---|
| 1 | ~~Toda la pantalla `/grupos`~~ **⚠️ CONECTADO (2026-09-10), verificación en vivo pendiente**: roster derivado de `/schedules` + `/class-sessions` | — (no hizo falta `GET /groups` ni `.../roster`) | ~~`groups.seed.ts`, `in-memory-groups.repository.ts`~~ borrados |
| 2 | ~~La asistencia no se puede releer~~ **CERRADO (2026-09-10)**: `listReservations` aplana `attendanceStatus` | — | ~~el union cerrado~~ quedó, pero ahora `asistenciaTomada()` lo justifica |
| 3 | ~~Clases canceladas sólo en memoria~~ **CERRADO**: `GET /class-sessions` ya embebe `classSessionStatus` | — | ~~el `Set _cancelled`~~ borrado |
| 4 | Badges de la sidebar en 0 | contadores de alertas y pagos | `nav-badges.service.ts` |
| 5 | KPIs e ítems del dashboard que se cayeron | ~~contador de espera~~ (ya viene en `/class-sessions`) + módulo de pagos | ~~N+1 de `fetchWaitingCounts`~~ borrado |
| 6 | `/comercial` en construcción | módulo `payments` entero | `EnConstruccionComponent` en esa ruta |
| 7 | `/plantillas` en construcción | `wa-templates` + `scheduled-reminders` | idem |
| 8 | Ajuste manual de créditos (sólo en la maqueta) | `credit-ledger` | — (feature nueva) |
| 9 | ~~Filtros de borrados en cliente~~ **CERRADO**: los `list()` del backend ya filtran | queda `class-sessions/:id/reservations` y `students/:id/plans` | ~~7 `.filter()`~~ borrados |
| 10 | Varios chicos | ver §10 | 3 `@if` en modales, 2 `sort()` en facades |

---

## 1. Grupos · ⚠️ CONECTADO (2026-09-10), verificación en vivo pendiente

**Lo que se hizo:** el front quedó conectado a datos reales. Se borraron
`core/data/repositories/groups.seed.ts`, `in-memory-groups.repository.ts` (+ sus 2 specs) y los
dos carteles *"Datos de demostración"*; `GRUPOS_PROVIDERS` pasa a `useClass:
HttpGroupsRepository`. El "grupo" de la maqueta salió de `ScheduleTemplate` (`GET /schedules`) y
sus sesiones de `GET /class-sessions` agrupadas por `scheduleTemplateId` — campo que ya venía en
la fila cruda de Prisma y sólo faltaba declararlo en el DTO del front, el mismo patrón que §2,
§3 y §5 de este documento. **No se crearon `GET /groups` ni `GET /schedules/:id/roster`**, que
es lo que esta sección proponía más abajo (quedó en el `<details>` sin tocar, como diagnóstico
original): se eligió **(a) roster derivado** de las reservas confirmadas, no **(b) tabla nueva
`enrollment`**. La suite de tests pasa entera — pero corre contra dobles, ver el punto
siguiente.

**Lo que quedó pendiente, y es bloqueante para dar la entrega por buena:** nadie probó contra
una respuesta real del backend levantado que los dos campos que el front ahora declara
efectivamente vienen: `scheduleTemplateId` en `GET /class-sessions`, y
`student.{firstName,lastName,categoryId}` en `GET /class-sessions/:id/reservations`. Los dos se
dieron por presentes **leyendo el código de NestJS** (`class-sessions.service.ts`), no una
respuesta real — y los tests no lo cubren porque corren contra dobles, que devuelven lo que el
test les pide, no lo que el backend manda de verdad. Importa más de lo habitual: si alguno de
los dos falta, el `v.parse` de valibot no descarta sólo ese campo — **tira la pantalla entera,
y no es sólo la de acá** (ver el párrafo siguiente).
El intento de verificarlo en vivo quedó bloqueado por el clasificador de riesgo del entorno de
desarrollo (no por el backend, que arriba y responde), detallado en
`.superpowers/sdd/2026-09-10-grupos-conectados/task-5-report.md`. Dato para quien lo reintente:
`prisma/seed.ts` del backend sólo siembra los 16 catálogos (`class_session_status`,
`reservation_status`, etc.) — **no crea usuarios**, así que no hay credenciales de prueba ahí.

**El alcance de ese riesgo es más grande que "esta pantalla".** Los dos campos no se declararon
en un DTO exclusivo de `/grupos`: se declararon en los DTOs compartidos que ya venían parseando
otras dos pantallas. `scheduleTemplateId` lo declara `ClassSessionDtoSchema`, y ese schema lo
parsea `HttpClassSessionsRepository.list()` — el mismo método que usa `HttpDashboardRepository`
para el **dashboard** y `ReservasFacade` para la grilla de **`/reservas`** — además de
`listRange()`, que es el que agrega `/grupos`. `student.{firstName,lastName,categoryId}` lo
declara `SessionReservationDtoSchema`, y ese schema lo parsea
`HttpClassSessionsRepository.reservations()`, que usa `SesionFacade` para el roster y la
planilla de asistencia del **modal de `/reservas`**, además del roster de `/grupos`. Si el
diagnóstico por lectura de código de NestJS resultara estar mal, el `v.parse` no rompe sólo la
pantalla nueva: rompe también el dashboard y `/reservas`, dos pantallas que hoy andan.

**Queda explícitamente abierto, y esta entrega no lo resolvió:** la tabla `enrollment`. Sin ella
no hay créditos ni % de asistencia **por inscripción** — son `creditsRemaining` y
`attendanceRate`, las dos columnas que tenía el roster de la maqueta y que se borraron al
conectar (el roster derivado no tiene de dónde sacarlas: no existe la inscripción como entidad).
Sigue en pie la decisión (a) derivado / (b) `enrollment` que este documento planteaba para ese
problema puntual.

<details><summary>Diagnóstico original</summary>

**Estado hoy:** `GRUPOS_PROVIDERS` bindea `GroupsRepository` → `InMemoryGroupsRepository`, que
parsea `GROUPS_SEED` (6 grupos inventados de `index-v2.html:1658`). Las dos páginas muestran un
cartel *"Datos de demostración"* (`grupos-list-page.component.html:8`,
`grupo-detail-page.component.html:15`).

**El problema de modelo, antes que el de endpoint:** en Prisma **no existe la inscripción a un
grupo**. `Reservation` es por `ClassSession`. El "grupo" de la maqueta es un `ScheduleTemplate`
(club + cancha + profe + categoryGroup + weekday + hora + capacity), y su *roster* hoy sólo se
puede **derivar** de las reservas de sus sesiones. Hay que decidir:

- **(a) Derivado** — roster = alumnos con reserva `confirmed` en las próximas N sesiones del
  template. Cero migración; el roster "parpadea" según quién reservó.
- **(b) Tabla nueva `enrollment`** (`schedule_template_id`, `student_id`, `student_plan_id`,
  `joined_at`, `left_at`). Es lo que la maqueta modela de verdad (créditos y % de asistencia son
  *por inscripción*, ver la nota del grupo 5 de la semilla). Requiere migración.

Recomendación: **(b)**, y mientras tanto (a) alcanza para borrar la semilla.

**Endpoints:**

```
GET /schedules/:id/roster        → inscriptos del grupo
GET /schedules/:id/sessions      → sesiones del grupo (pasadas + futuras)
GET /schedules/:id/waiting-list  → lista de espera del grupo
```

o, si se prefiere una sola llamada (es lo que el contrato actual `GroupsRepository.getGroups()`
ya asume — un snapshot con todos los grupos):

```
GET /groups        → [{ id, name, categoryGroupId, coach, court, weekday, startTime, capacity,
                        roster: [...], waitlist: [...], sessions: [...] }]
GET /groups/:id
```

Forma esperada por `@domain/entities/group.ts`, con los tipos que el front realmente quiere:

```jsonc
{
  "id": "12",
  "name": "7ma+8va · Lunes PM",
  "category": "7ma+8va",          // categoryGroup.name
  "coach": { "id": "3", "displayName": "Diego A." },
  "court": { "id": "1", "name": "Cancha 1" },
  "weekday": 1,                   // 0-6, el front formatea (weekday-label.ts ya existe)
  "startTime": "18:00",
  "capacity": 4,
  "roster": [{
    "id": "45",                   // id de la INSCRIPCIÓN (no del alumno)
    "studentId": "88",
    "name": "Lucía Pereyra",
    "category": "7ma",
    "creditsRemaining": 6,        // studentPlan.creditsRemaining
    "attendanceRate": 92          // 0..100, ver abajo
  }],
  "waitlist": [{ "id": "7", "studentId": "91", "name": "Julián Vera", "requestedAt": "2026-09-01T12:00:00Z" }],
  "sessions": [{
    "id": "301",
    "startAt": "2026-07-01T21:00:00Z",
    "courtName": "Cancha 1",
    "status": "programada",       // name crudo de class_session_status
    "attendance": [{ "reservationId": "500", "studentId": "88", "status": "asistio" }]
  }]
}
```

Notas:
- `initials` las calcula el front (ya lo hace `grupos-format.ts`), no las mande el backend.
- `attendanceRate` = `attendance.status='asistio'` / sesiones `completada` del alumno en ese
  grupo. Si sale caro, mandalo `null` y el front muestra `—`; no vale bloquear el slice por esto.
- `since` de la lista de espera: mandá `requestedAt` ISO, no `"hace 2 días"`.

**Escritura de asistencia:** ya existe `POST /class-sessions/:id/attendance`. El conflicto es que
el dominio de grupos **descuenta créditos al tomar asistencia** (`apply-attendance.use-case.ts`)
y `AttendanceService` **no toca créditos** (los descuenta al reservar). Definir cuál gana:
- si gana el backend → borrar el descuento de `applyAttendance` y el checkbox
  "descontar ausentes" del modal;
- si gana la maqueta → `AttendanceService` tiene que escribir `credit_ledger` y
  `studentPlan.creditsRemaining` dentro de la misma transacción.

**Al conectar se borra:** `core/data/repositories/groups.seed.ts`,
`in-memory-groups.repository.ts` (+ sus 2 specs), los dos carteles "Datos de demostración",
y `GRUPOS_PROVIDERS` pasa a `useClass: HttpGroupsRepository`.

</details>

---

## 2. Lectura de asistencia · ✅ HECHO (2026-09-10)

**Resuelto** tocando el backend: `listReservations` hace `include: { attendances }` y las
aplana a `attendanceStatus: {id, name} | null`. El front lo lee crudo en
`SessionReservation.attendanceStatus` y lo estrecha con `asistenciaTomada()`; la planilla
muestra lo ya guardado y `tomarAsistencia()` relee siempre. Ver
[`conexiones-disponibles.md` §9](./conexiones-disponibles.md).

Difiere de lo que proponía esta sección en dos puntos, los dos a propósito: se manda
`attendanceStatus` aplanado y no el objeto `attendance` entero (nadie usa `respondedVia` /
`respondedAt`), y **no** apareció `sessionAttendanceStatusLabel()` con los 5 valores — los
tres de WhatsApp caen a null porque son la respuesta del alumno, no asistencia tomada.

<details><summary>Diagnóstico original</summary>

**Estado hoy:** la asistencia sólo se **escribe**. `GET /class-sessions/:id/reservations`
(`class-sessions.service.ts:38`) hace `include: { student, reservationStatus }` — sin
`attendance`. Consecuencia: el panel de asistencia de `/reservas` no puede rehidratar lo ya
marcado (un F5 muestra la planilla en blanco), y `SessionAttendanceStatus` está cerrado en
`'asistio' | 'ausente'` a sabiendas de que la tabla ya tiene `'confirmo_si'`, `'confirmo_no'` y
`'sin_respuesta'` puestos por WhatsApp.

**Lo más barato:** agregar `attendance` al include que ya existe.

```jsonc
// GET /class-sessions/:id/reservations
[{ "id": "500", "studentId": "88", "studentPlanId": "12", "status": "confirmed",
   "holdExpiresAt": null,
   "attendance": { "status": "asistio", "respondedVia": "panel", "respondedAt": "..." } }]
```

**Al conectar se borra:** el `ponytail` de `session-attendance.ts:13` y aparece
`sessionAttendanceStatusLabel()` con los 5 valores reales.

</details>

---

## 3. Catálogo de estados de clase · ✅ CERRADO (2026-09-10)

**Resuelto por la alternativa que esta misma sección proponía**: `GET /class-sessions` ya
devolvía `classSessionStatus: {id, name}` embebido — el front no lo declaraba en el DTO y
valibot lo descartaba. `_cancelled` borrado. No hizo falta ningún catálogo nuevo, y los otros
cuatro que lista el cierre siguen sin consumidor (ver `conexiones-disponibles.md` §3).

<details><summary>Diagnóstico original</summary>

**Estado hoy:** `ReservasFacade` guarda en un `Set` en memoria las clases canceladas en esta
sesión del navegador (`reservas.facade.ts:24`), porque `GET /class-sessions` devuelve
`classSessionStatusId` y no hay forma de traducirlo. Un F5 muestra las canceladas como
programadas.

```
GET /catalogs/class-session-statuses   → [{ id, name }]
```

Alternativa mejor y sin catálogo nuevo: que `GET /class-sessions` devuelva
`classSessionStatus: { id, name }` embebido, como ya hace `listReservations` con
`reservationStatus`.

**Al conectar se borra:** `_cancelled` / `cancelled` de `ReservasFacade` y su lógica de pintado.

Mismo criterio, si algún día hacen falta: `attendance-statuses`, `waiting-list-statuses`,
`payment-statuses`, `credit-reasons`. Ninguno es bloqueante hoy.

</details>

---

## 4. Badges de la sidebar · **P1**

**Estado hoy:** `NavBadgesService` devuelve `{ alerts: 0, payments: 0 }` fijo — antes eran las
constantes inventadas 6 y 3 de la maqueta. El markup del badge ya está y funciona.

```
GET /dashboard/alerts-count    → { alerts: number }
GET /payments?status=pendiente → el .length sirve de contador
```

`alerts` no tiene definición todavía: hay que decidir qué cuenta (¿holds por vencer + clases sin
profe + transferencias sin conciliar?). Hasta entonces, dejarlo en 0 es correcto.

---

## 5. Dashboard · **P1**

**Estado hoy:** `HttpDashboardRepository` compone el snapshot con 5 llamadas en paralelo. Faltan,
respecto de la maqueta (`index-v2.html:844-900`):

| Ítem de la maqueta | Estado | Qué falta |
|---|---|---|
| KPI "Sesiones hoy" / "Ocupación" | ✅ conectado | — |
| KPI "Holds activos" | ❌ no está en el front | **nada de API**: `GET /reservations?status=held` ya existe e incluye `student` + `classSession`. Es trabajo de front. |
| KPI "Ingresos hoy" | ❌ | `GET /payments?from=&to=&status=confirmado` → suma de `amount` (§6) |
| Rail "Holds por vencer" | ❌ | idem holds: ya hay endpoint, falta el componente |
| Rail "Lista de espera activa" | ⚠️ sin acciones | §8 (ofrecer / aprobar) |
| Rail "Transferencias pendientes" | ❌ | `GET /payments?status=pendiente` (§6) |
| Pádel / Tenis en la leyenda de canchas | ❌ imposible | `SurfaceType` es **material de piso**, no deporte. Falta `court.sport` o `club.sports` |

**~~Además, el N+1~~** · ✅ CERRADO (2026-09-10): `GET /class-sessions` **ya devolvía**
`waitingCount` junto a `availableSpots` — exactamente el campo que esta sección pedía. El DTO
del front no lo declaraba y valibot lo descartaba, así que `fetchWaitingCounts` seguía pidiendo
`waiting-list` una vez por sesión llena. Se declaró el campo y se borró el método entero.

**Al conectar se borra:** `HttpDashboardRepository.fetchWaitingCounts()` entero.

Un `GET /dashboard` agregador sería lo ideal pero **no es necesario**: con `waitingCount` el
dashboard queda en 5 llamadas planas y eso ya es aceptable.

---

## 6. Comercial y Pagos — módulo entero · **P2**

**Estado hoy:** `/comercial` renderiza `EnConstruccionComponent`. En el backend, el modelo
`Payment` **existe** (`schema.prisma:746`, con `aliasUsed`, `reference`, `receiptData`,
`confirmedByUserId`, `confirmedAt`) pero **no hay ningún controlador de pagos**: lo único que
escribe `payment` es `POST /reservations/:id/confirm-payment`.

La maqueta pide dos cosas (`index-v2.html:981-1002`): *conciliación de transferencias* y *gestor
de planes* (esto último ya está hecho en `/configuracion/planes`).

```
GET    /payments?status=&from=&to=&studentId=   → lista con student, plan, método, monto, comprobante
GET    /payments/:id
GET    /payments/:id/receipt                    → el receiptData (Bytes) como imagen
POST   /payments/:id/confirm  { reference? }    → confirmedByUserId + confirmedAt del JWT
POST   /payments/:id/reject   { reason }
POST   /payments             { studentId, planId?, amount, paymentMethodId, ... }  → cobro suelto
GET    /catalogs/payment-statuses
```

---

## 7. Plantillas y WhatsApp · **P2**

**Estado hoy:** `/plantillas` en construcción. En el backend existen `WaTemplate`,
`WaMessage`, `ScheduledReminder`, `ReminderType`, `ConversationState` — **ninguno con
controlador**; el único endpoint de WhatsApp es el webhook de Meta.

```
GET/POST/PATCH/DELETE /wa-templates
GET    /scheduled-reminders?from=&to=&status=
POST   /scheduled-reminders/:id/cancel
GET    /catalogs/reminder-types
GET    /wa-messages?studentId=          → el hilo, para "Ejemplos de conversación"
```

La sección "Calendario base" de esa vista es `schedule_template`, que **ya está conectada** en
`/configuracion/horarios`. No la dupliques.

---

## 8. Lista de espera: ofrecer y aprobar · **P2**

**Estado hoy:** `WaitingListOfferService.offerNext()` existe pero **sólo se dispara desde
`DELETE /reservations/:id`** con `offerToWaitingList: true`. No hay forma de ofrecer un cupo a
mano, que es exactamente lo que hacen los botones "Ofrecer" y "Aprobar" del rail de la maqueta.

```
POST /class-sessions/:id/waiting-list/offer   → dispara offerNext() a mano
POST /waiting-list/:id/accept                 → promueve a Reservation (ya hay held/confirmed)
```

---

## 9. Ajuste manual de créditos · **P2**

**Estado hoy:** el modal existe sólo en la maqueta (`index-v2.html:1254`, "Ajuste manual de
créditos", con motivo obligatorio *"para dejar registro auditable"*). `CreditLedger` y
`CreditReason` existen en Prisma; **sin controlador**.

```
POST /students/:id/credits  { studentPlanId, change, creditReasonId, notes }  → escribe ledger + saldo
GET  /students/:id/credits                                                    → historial
GET  /catalogs/credit-reasons
```

---

## 10. Menores, pero cada uno borra código · **P3**

| Qué | Dónde duele hoy | Qué falta en la API |
|---|---|---|
| ~~**Soft-delete server-side**~~ ✅ **CERRADO (2026-09-10)** | — | Los `list()` de Nest **ya tenían** `where: { deletedAt: null, clubId }`; el diagnóstico estaba vencido. Se borraron los 7 `.filter()`, sus comentarios y el campo `deletedAt` de los 7 DTO de lectura. Quedan los 2 `findMany` que de verdad no filtran: `class-sessions/:id/reservations` y `students/:id/plans` |
| **FK a null en PATCH** | `BigInt(null)` revienta con 500, así que los mappers **omiten** el campo en vez de mandar `null` → no se puede *limpiar* una categoría/superficie/plan ya asignada | aceptar `null` explícito en los `Update*Dto`. Borra los `@if` de `cancha-form-modal.ts:44`, `plan-form-modal.ts:58`, `alumno-form-modal.ts:70` |
| **Sin ORDER BY** | `coaches.service.list()` y `class-sessions.service.list()` devuelven el orden físico del heap; el front ordena a mano | `orderBy` en el service. Borra `ProfesoresFacade.sorted` y `ReservasFacade.sorted` |
| **Baja de profesor** | `ProfesoresFacade` no tiene `remove()` | `DELETE /coaches/:id` (soft) |
| **Alta de profesor** | va por `POST /users` con rol `'profesor'`, y **no es atómica**: un fallo de SMTP devuelve 500 con el usuario ya creado (`users.service.ts`) | `POST /coaches`, o al menos envolver `createUser` en transacción y mandar el mail después con `try/catch` |
| **`GET /clubs/:id`** | `http-club.repository.ts:45`: `getById()` re-pide `/clubs/me` e ignora el id | `GET /clubs/:id` (o dejarlo así — es multi-tenant, `/me` alcanza) |
| **Deporte de la cancha** | la leyenda Pádel/Tenis de la maqueta no se puede pintar | campo `sport` en `court` |
| **Links del footer** | `site-footer.component.ts:25`: los tres sin handler | nada de API — son páginas estáticas |

---

## Orden sugerido

1. ~~**§2**~~ ✅ hecho — `attendances` en el include, aplanado a `attendanceStatus`.
2. ~~**§3**~~ ✅ cerrado — `classSessionStatus` ya venía embebido; faltaba declararlo en el DTO.
3. ~~**§5** (el N+1)~~ ✅ cerrado — `waitingCount` ya venía; faltaba declararlo.
4. ~~**§10** soft-delete~~ ✅ cerrado — los `list()` ya filtraban. **Queda el ORDER BY** y el
   FK a null en los PATCH.
5. ~~**§1** Grupos — el grande. Decidir antes (a) vs (b).~~ **⚠️ conectado (2026-09-10)**: se
   decidió (a) derivado. **Bloqueante antes de dar la entrega por buena:** confirmar contra el
   backend levantado que `scheduleTemplateId` y `student` vienen de verdad (§1 arriba). Sigue
   abierta la tabla `enrollment` para créditos/asistencia por inscripción.
6. **§6** Pagos → destraba `/comercial`, el KPI de ingresos y el badge de la sidebar.
7. **§7** Plantillas, **§8** lista de espera, **§9** créditos.

> Los tres primeros resultaron ser **diagnósticos vencidos**: el backend ya servía el dato y el
> front no lo declaraba. Antes de pedir endpoint nuevo, conviene mirar qué devuelve el que ya
> hay — ver `conexiones-disponibles.md`. El §1 de grupos es el mismo patrón, pero a diferencia
> de los otros tres **no está confirmado en vivo todavía** — no cerrarlo como hecho hasta que lo
> esté.
