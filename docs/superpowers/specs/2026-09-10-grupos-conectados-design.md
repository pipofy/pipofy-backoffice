# Grupos y clases conectados — diseño

Fecha: 2026-09-10
Estado: aprobado, listo para plan de implementación

Cierra `docs/api-faltantes.md` §1, la última pantalla 100% dummy del backoffice.

## 1. Contexto

`/grupos` y `/grupos/:id` corren contra `InMemoryGroupsRepository`, que parsea `GROUPS_SEED`:
seis grupos inventados copiados de `index-v2.html:1658`. Las dos páginas muestran un cartel
*"Datos de demostración"*.

El slice está modelado **para la semilla, no para una API**. `groups.dto.ts` pide `day: 'Lun'`,
`date: '01/07'`, `since: 'hace 2 días'`, `initials` y un status `prog|done|canc`, todo en
snake_case. Ningún backend real devuelve eso, y el propio `api-faltantes.md` lo dice en su
convención de entrada: *"El front NO quiere strings preformateados"*. Conectar esto no es
cambiar un binding: es reescribir DTO, mapper y buena parte de la entidad.

**El problema de modelo, antes que el de endpoint:** en Prisma no existe la inscripción a un
grupo. `Reservation` cuelga de `ClassSession`. El "grupo" de la maqueta es un `ScheduleTemplate`
—club + cancha + profe + categoryGroup + weekday + hora + capacity— y su roster sólo se puede
**derivar** de las reservas de sus sesiones.

**Lo que sí está y el front no usa.** Repitiendo la lección de las tres entregas del 2026-09-10
—los tres diagnósticos estaban vencidos: el backend ya servía el dato y el front no lo
declaraba— se revisó endpoint por endpoint antes de pedir nada nuevo:

| Dato | Sale de | Falta |
|---|---|---|
| El grupo (día, hora, cancha, profe, categoría, cupo) | `GET /schedules` → `ScheduleTemplate` crudo | nada |
| Sesiones de un grupo | `GET /class-sessions?from&to` **ya devuelve `scheduleTemplateId`** | declararlo en el DTO |
| Estado, ocupación y espera por sesión | misma respuesta: `classSessionStatus`, `availableSpots`, `waitingCount` | nada |
| Quién está en una sesión, y si ya se le tomó asistencia | `GET /class-sessions/:id/reservations` (con `attendanceStatus` desde el 2026-09-10) | nada |
| Lista de espera de una sesión | `GET /class-sessions/:id/waiting-list` | nada |
| Escribir asistencia | `POST /class-sessions/:id/attendance` | nada |

`scheduleTemplateId` es **exactamente el mismo bug** que `waitingCount` y `classSessionStatus`:
`ClassSessionsService.list()` hace `...session` sobre la fila cruda de Prisma, el campo viaja,
y `ClassSessionDtoSchema` no lo declara, así que valibot lo descarta.

## 2. Alcance

**Adentro:** las dos pantallas de `/grupos` contra datos reales, con roster **derivado** de la
próxima sesión programada del template, y toma de asistencia contra el endpoint que ya existe.

**Afuera, y por qué:**

- **La tabla `enrollment`.** Es lo que la maqueta modela de verdad —créditos y % de asistencia
  son *por inscripción*— y requiere migración de Prisma, módulo Nest y endpoints nuevos. Se
  difiere a propósito: el roster derivado borra la semilla hoy, sin tocar el repo hermano.
  Ver §3.1.
- **Tocar `pipofy-backend`.** Toda la entrega sale de endpoints existentes. Es la restricción
  que define el diseño, no una consecuencia de él.
- **Créditos.** El backend los descuenta al reservar y los devuelve al cancelar. La maqueta los
  descontaba al tomar asistencia. Gana el backend. Ver §3.5.
- **`attendanceRate` y `creditsRemaining` en el roster.** Ver §3.6.
- **Alta/baja de inscriptos desde la pantalla.** Sin `enrollment` no hay qué escribir: hoy se
  entra a un grupo reservando su clase, desde `/reservas`.
- **Filtro por grupo en `/reservas`.** Otra pantalla, otra entrega.

## 3. Decisiones y sus techos

### 3.1 Roster derivado de la próxima sesión programada

El roster de un grupo son los alumnos con lugar tomado en su **próxima sesión programada**.

Se descartaron dos alternativas:

1. **Unión de las últimas N sesiones**, con créditos y % de asistencia. Da un roster estable,
   pero cuesta una llamada de reservas por sesión y una de planes por alumno: ~20 requests al
   abrir un grupo, y el porcentaje pasa a depender de qué ventana eligió el front.
2. **Tabla `enrollment`**. Es el modelo correcto y es la salida de este techo, pero son semanas
   en los dos repos antes de ver pantalla, con la semilla todavía adentro.

**Techo:** el roster parpadea. Quien no reservó la próxima clase no aparece, aunque venga hace
un año; un grupo sin próxima sesión programada muestra roster vacío.
**Salida:** `enrollment` (`schedule_template_id`, `student_id`, `student_plan_id`, `joined_at`,
`left_at`), y `listGroups()` pasa a leerla en vez de derivarla.

Se marca con un comentario `ponytail:` en el mapper que hace la derivación.

### 3.2 La ventana es de ±28 días, fija

`GET /class-sessions` exige `from` y `to`; no hay filtro por `scheduleTemplateId`. Se pide
**una sola vez** la ventana `hoy−28d … hoy+28d` y se agrupan las sesiones por template en el
cliente. Una llamada cubre la lista entera y el detalle de cualquier grupo.

El backend arma la ventana con `new Date(\`${from}T00:00:00Z\`)` —la Z es literal, ya
documentado en `http-class-sessions.repository.ts`— así que se pide un día de más de cada lado.
A diferencia de `list(dateKey)`, **no se recorta el resultado**: en una ventana de 56 días,
unas horas de más en los bordes no cambian nada, y filtrar costaría un `isOnLocalDate` por fila
para nada.

**Techo:** una sesión fuera de la ventana no se ve. Un grupo en receso de más de un mes se
muestra sin sesiones.
**Salida:** `?scheduleTemplateId=` en `GET /class-sessions`, y la ventana desaparece.

### 3.3 El contrato queda en UN método

Este es el cambio más grande respecto de lo que se venía suponiendo, y va en la dirección de
borrar código.

`ClassSessionsRepository` **ya tiene** `reservations(sessionId)`, `waitingList(sessionId)` y
`markAttendance(sessionId, marks)`, cada uno con su DTO, su mapper y sus tests. `SchedulesRepository`
ya tiene `list()`, que devuelve `Schedule` con `weekday`, `startTime` en `'HH:mm'` y `capacity`
ya normalizados. Envolverlos en métodos de `GroupsRepository` que sólo reenvían es una capa que
no hace nada.

Entonces:

```ts
export abstract class GroupsRepository {
  abstract listGroups(): Promise<Group[]>;
}
```

Lo único que no existe es la **derivación**: cruzar templates con sesiones y calcular ocupación.
Eso es `HttpGroupsRepository`, que compone —no reimplementa— los repositorios que ya están,
igual que `HttpDashboardRepository`:

```
SchedulesRepository.list()          → los grupos
ClassSessionsRepository.listRange() → sus sesiones  (método nuevo, §5.1)
CourtsRepository.list()             ┐
CoachesRepository.list()            ├ nombres
CategoryGroupsRepository.list()     ┘
```

`clubId` desaparece de la firma: lo pone `tenantInterceptor` con `X-Tenant-Id`. Hoy `getGroups(clubId)`
lo recibe sólo porque el repositorio en memoria tenía que elegir semilla.

`GruposFacade` inyecta `GroupsRepository` para la lista y `ClassSessionsRepository` para roster,
lista de espera y asistencia. Precedente exacto: `HorariosFacade` inyecta cinco contratos.

### 3.4 Un solo modal de asistencia, no dos modos

Hoy el modal deriva su modo de `session.status`: `'scheduled'` → tomar, `'completed'` → ver/editar.
**Eso no se puede sostener contra el backend real:** `AttendanceService.markBulk()` escribe la
tabla `attendance` y no toca `classSessionStatus`. Una clase a la que se le tomó asistencia sigue
`programada` para siempre. El `status` nunca va a decir si se tomó.

El modal pasa a ser **uno solo**, habilitado cuando `startAt < ahora`, que al abrirse pide
`reservations(sessionId)` y prellena con el `attendanceStatus` que ya viene en esa respuesta.
Es exactamente lo que hace `/reservas` desde el 2026-09-10.

Con eso desaparece la invariante `attendance !== null ⟺ status === 'completed'` de
`entities/group.ts`, su guard en el mapper y los dos modos del componente. La asistencia deja de
viajar embebida en la sesión: se pide de la sesión que se va a marcar, que es la única que la
necesita.

**Techo:** desde la tabla no se ve si una sesión ya tiene asistencia tomada sin abrirla.
**Salida:** que `markBulk` pase la clase a `completada`, o un contador en `GET /class-sessions`.

### 3.5 Los créditos los gana el backend

`applyAttendance` (`domain/use-cases/`) descuenta un crédito por presente, y otro por ausente si
el checkbox de política está activo. El backend descuenta al **reservar**
(`class-sessions.service.ts`, camino `whatsapp`) y devuelve al **cancelar**; `AttendanceService`
no toca créditos ni cupo ni el estado de la reserva.

Sostener las dos reglas descuenta dos veces. Gana el backend, que es el que tiene la base.

Se borran: `apply-attendance.use-case.ts` y su spec, `creditsToDiscount`, el checkbox
*"Descontar crédito por inasistencia"*, el aviso *"cada presente descuenta 1 crédito"* y el
contador *"Clases a computar"*. Todo eso sería copy falso: el POST no descuenta nada.

`SaveAttendanceRequest.discountAbsences` desaparece del dominio.

### 3.6 Créditos y % de asistencia salen de la tabla de roster

`creditsRemaining` necesita `GET /students/:id/plans` por alumno; `attendanceRate` necesita
recorrer las reservas de cada sesión pasada. Ninguno de los dos existe agregado.

Se borran las dos columnas. La tabla queda **Alumno + Categoría**. Una columna de guiones es
peor que no tener la columna: ocupa ancho, invita a preguntar por qué está vacía, y su valor
real —créditos y asistencia **por inscripción**— sólo existe cuando exista `enrollment`.

Por el mismo criterio, la columna `Asist. 3/4` de la tabla de sesiones se reemplaza por
`Inscriptos 4/4`, que sale gratis de `availableSpots`.

### 3.7 `enrolled` cuenta lo mismo que el backend; el modal, menos

`enrolled = capacity − availableSpots`, o sea `confirmed + held vigentes`: la definición de
"lugar ocupado" del backend (`occupiedSpotsWhere`), la misma que ya usa `occupiedSpots()` en
`entities/class-session.ts`. Contar distinto que el backend haría que la pantalla ofrezca cupos
que `reserve()` rechaza.

El roster lista los dos estados, así el `4/4` del cupo coincide con las filas de la tabla. El
**modal de asistencia lista sólo las `confirmed`**: `AttendanceService.mark()` tira 400 sobre
cualquier otro estado. Los `held` se muestran en el roster con su distintivo de hold, sin
controles de asistencia.

## 4. Entidades

`GroupsSnapshot` desaparece: nadie usa su `clubId`.

```ts
/** Un ScheduleTemplate con sus sesiones. El id ES el del template. */
export interface Group {
  readonly id: string;
  readonly category: string;      // categoryGroup.name
  readonly teacher: string;       // coach.displayName
  readonly courtName: string;
  readonly weekday: number | null;   // 0 = Domingo. Formatea la pantalla.
  readonly startTime: string | null; // 'HH:mm', ya recortado por toSchedule()
  readonly capacity: number;
  /** De la próxima sesión programada. 0 si no hay ninguna (§3.1). */
  readonly enrolled: number;
  readonly waiting: number;
  /** Id de la próxima sesión programada, o null. De acá cuelgan roster y lista de espera. */
  readonly nextSessionId: string | null;
  /** Orden cronológico ASCENDENTE. */
  readonly sessions: readonly GroupSession[];
}

export interface GroupSession {
  readonly id: string;
  readonly startAt: string | null;   // ISO crudo; formatea la pantalla con @domain/local-date
  readonly courtName: string;
  readonly status: string;           // nombre del catálogo: 'programada'|'cancelada'|'completada'
  readonly enrolled: number;
  readonly capacity: number;
  readonly waiting: number;
}

/** Una fila del roster. El id ES el de la RESERVA: es lo que pide el POST de asistencia. */
export interface RosterMember {
  readonly id: string;
  readonly studentId: string;
  readonly name: string;
  readonly category: string;
  /** 'confirmed' | 'held'. El modal de asistencia sólo ofrece las confirmed (§3.7). */
  readonly status: string;
  /** 'asistio' | 'ausente' | null. Prellena el modal (§3.4). */
  readonly attendanceStatus: string | null;
}

export interface GroupWaitlistEntry {
  readonly id: string;
  readonly studentId: string;
  readonly name: string;
  readonly requestedAt: string | null;   // ISO
}
```

**`Group` no lleva `name`.** El título —*"7ma+8va · Lunes 18:00"*— se arma con `weekdayLabel()`,
que es presentación y vive en `@shared` (§7): `core/data` **no puede importar `@shared`**
(`eslint-plugin-boundaries`: data sólo ve domain y data). Derivarlo en el mapper es error de
lint, no una preferencia. Se arma en `grupos-format.ts`, del lado de la feature, con
`groupTitle(group)`.

Se van: `SessionStatus` (el union `scheduled|completed|cancelled` — el nombre del catálogo viaja
crudo, igual que en `ClassSession`), `AttendanceMark`, `SaveAttendanceRequest`, `GroupsSnapshot`,
`RosterMember.initials`, `.credits`, `.attendanceRate`, `WaitlistEntry.since`.

Las marcas de asistencia reusan `SessionAttendanceMark` (`entities/session-attendance.ts`), que
ya es `{ reservationId, status: 'asistio' | 'ausente' }`.

## 5. Capa de datos

### 5.1 `ClassSessionsRepository.listRange(fromKey, toKey)`

Método nuevo junto a `list(dateKey)`. Pide `from−1d … to+1d` por la ventana UTC del backend y
**no filtra** (§3.2). `list(dateKey)` se queda como está: su recorte por día local exacto sigue
siendo lo que quiere el dashboard.

`ClassSession` gana `scheduleTemplateId: string | null` —nullable en Prisma; una sesión suelta
no tiene template— y `ClassSessionDtoSchema` lo declara.

Es uno de los dos cambios de DTO de la entrega; el otro es `student` en
`SessionReservationDtoSchema` (§5.3). Los dos son campos que el backend **ya manda** y valibot
venía descartando, como `waitingCount` y `classSessionStatus` antes del 2026-09-10.

### 5.2 `HttpGroupsRepository`

`extends GroupsRepository`, en `core/data/repositories/`, componiendo los cinco repositorios de
§3.3 en un `Promise.all`. Si cualquiera falla, falla la lista entera: media pantalla de grupos
es peor que un error, mismo criterio que `HttpDashboardRepository`.

La derivación vive en `mappers/groups.mapper.ts`, reescrito, como función pura
`toGroups({ schedules, sessions, courts, coaches, categoryGroups })`:

1. Descarta los templates con `active === false`: no generan sesiones.
2. Agrupa las sesiones por `scheduleTemplateId`, ignorando las que lo tienen en `null`.
3. Ordena las sesiones de cada grupo por `startAt` ascendente.
4. Próxima sesión programada = la primera con `status === 'programada'` y `startAt` futuro.
   De ella salen `enrolled`, `waiting` y `nextSessionId`.
5. Resuelve nombres por id contra los tres lookups; el que no matchea cae a `'—'`.

Un template sin sesiones en la ventana se muestra igual, con `sessions: []` y `enrolled: 0`:
existe y ocupa una fila en `/configuracion/horarios`; esconderlo haría parecer que se perdió.

### 5.3 Roster y lista de espera

No hay repositorio nuevo. `GruposFacade` compone, en la página de detalle:

```
ClassSessionsRepository.reservations(nextSessionId)
ClassSessionsRepository.waitingList(nextSessionId)    → id, studentId, requestedAt
```

`reservations()` ya descarta los borrados dentro del repositorio, pero devuelve **todos** los
estados, holds vencidos incluidos: nada expira los holds en la base y el recorte por vencimiento
es de la pantalla, como dice el contrato. El roster aplica exactamente la definición del backend
—`confirmed`, o `held` con `holdExpiresAt` futuro— para que su largo coincida con `enrolled` (§3.7).

**El nombre no necesita el padrón.** `ClassSessionsService.listReservations()` hace
`include: { student: true, ... }`: `firstName`, `lastName` y `categoryId` ya viajan en esa misma
respuesta, y `SessionReservationDtoSchema` no los declara —lo dice su propio comentario, que
asume que el consumidor tiene el padrón en memoria porque el único consumidor hasta hoy lo tenía—.
Se agrega al DTO:

```ts
student: v.object({
  firstName: v.string(),
  lastName: v.string(),
  categoryId: v.nullable(v.string()),
}),
```

y `SessionReservation` gana `studentName` y `studentCategoryId`. Es aditivo: `/reservas` sigue
resolviendo por padrón como hoy, sin tocar nada.

Queda una sola lectura auxiliar, `CategoriesRepository.list()`, para el nombre de la categoría,
que la **página** carga una vez y pasa hacia abajo — el patrón literal de
`reservas-page.component.ts`.

La lista de espera sí necesita el padrón: `waitingList()` devuelve `studentId` pelado y su
`findMany` no incluye `student`. Se resuelve con `StudentsRepository.list()`, cargado por la
página igual que las categorías.

Las iniciales las calcula un helper de presentación en `grupos-format.ts`, no el backend.

## 6. Facade

`GruposFacade` sigue extendiendo `SignalStore<Group[], DomainError>`:

- `load()` → `run(repo.listGroups(), toDomainError)`. El `effect` de aislamiento por tenant se
  queda tal cual.
- `roster` / `waitlist` / `sessionRoster`: signals propias, con su `loading` propio. **No** pasan
  por `run()`.
- `saveAttendance(sessionId, marks)` → `ClassSessionsRepository.markAttendance()`, **sin
  relectura**. Es la excepción a la convención "la escritura devuelve void y la facade re-lee", y
  el propio contrato ya la documenta: `markBulk` escribe la tabla `attendance` y no toca cupo, ni
  créditos, ni el estado de la reserva, ni el de la clase. Nada de lo que la pantalla muestra
  cambia, y el resultado por ítem no se puede releer de ningún lado. Conserva las dos trampas
  gemelas ya documentadas en `grupos.facade.ts`: no toca
  `loading()` ni `error()` y **deja propagar** el error, porque el modal vive dentro de la rama
  `data()` del template y `run()` lo desmontaría con el usuario adentro, además de tragarse el
  fallo y disparar el toast de éxito. Ese comentario se conserva palabra por palabra.
- El resultado por ítem de `markAttendance` se usa como hoy lo usa `/reservas`: se reporta
  cuántos se guardaron y cuáles fallaron. **No** es atómico (`markBulk` itera con un try por
  ítem), y reintentar es seguro porque el upsert es idempotente.

## 7. Presentación

| Componente | Cambio |
|---|---|
| `grupos-list-page` | Fuera el cartel *"Datos de demostración"*. `Cupo` usa `g.enrolled`, no `roster.length`. `Día y hora` usa `weekdayLabel(g.weekday)` + `g.startTime`. El chip de espera usa `g.waiting`. Iniciales calculadas. |
| `grupo-detail-page` | Fuera el cartel. Roster y lista de espera se cargan aparte, con su propio placeholder de carga. *"Próxima sesión"* formatea `startAt` con `@domain/local-date`. |
| `roster-table` | Columnas `Alumno` + `Categoría` (§3.6). Distintivo de hold en las no confirmadas (§3.7). Fuera `attendanceState`. |
| `sessions-table` | `Fecha`/`Hora` formateadas desde `startAt`. `Asist.` → `Inscriptos`. Estado desde el nombre del catálogo. Un solo botón, habilitado si la sesión ya pasó y no está cancelada (§3.4). |
| `attendance-modal` | Un solo modo. Recibe el roster **de esa sesión**, prellenado. Fuera el checkbox, el aviso y el contador de créditos (§3.5). Se conserva el guard de doble-submit. |
| `cupo-cell` | Sin cambios. |
| `grupos-format.ts` | Gana `groupTitle(g)` y `initials(name)`. Pierde `formatAttendance`, `attendanceState` y `nextSessionDate` (la próxima sesión ya viene resuelta en `nextSessionId`). |
| `weekday-label.ts` | **Se muda** de `features/configuracion/horarios/` a `@shared/`: `features/grupos` no puede importar de otra feature (`eslint-plugin-boundaries`). No depende de nada, así que entra en `shared` sin conflicto. |
| `grupos.providers.ts` | `{ provide: GroupsRepository, useClass: HttpGroupsRepository }`, más los bindings de schedules, class-sessions, courts, coaches, category-groups, students y categories. |

## 8. Se borra

`core/data/repositories/groups.seed.ts` · `in-memory-groups.repository.ts` y su spec ·
`core/domain/use-cases/apply-attendance.use-case.ts` y su spec · `formatAttendance` y
`attendanceState` de `grupos-format.ts` · el guard de invariante de `groups.mapper.ts` · los dos
carteles *"Datos de demostración"* · `GroupSessionNotFoundError` y `SessionCancelledError` de
`core/domain/errors.ts` · `nextSessionDate` de `grupos-format.ts`.

**`errors.ts` no corre riesgo:** los dos son subclases de `DomainRuleError`, no `kind` nuevos de
la unión, así que el `switch` exhaustivo de `domainErrorMessage()` ni se entera. Salen las dos
clases y nada más.

## 9. Errores

Nada nuevo. `HttpGroupsRepository` normaliza con `toDomainError` en un `try/catch` que cubre
tanto el error HTTP como el `ValiError` que `v.parse` tira fuera del observable — aunque acá el
parseo lo hacen los repositorios compuestos, el catch se queda por el mismo motivo que en
`HttpDashboardRepository`.

Los dos errores de dominio que se borran (§8) los tiraba `applyAttendance`, que ya no existe.

## 10. Tests

Vitest + `TestBed` + `provideZonelessChangeDetection()`. Sin librería de mocks: dobles planos
casteados al contrato, con un array `calls`.

- **`groups.mapper.spec.ts`** (reescrito, es el núcleo): agrupación por `scheduleTemplateId`;
  sesiones con `scheduleTemplateId: null` ignoradas; templates `active: false` descartados;
  orden ascendente por `startAt`; próxima sesión programada elegida entre una pasada, una
  cancelada y dos futuras; `enrolled`/`waiting` tomados de ESA sesión; template sin sesiones →
  `enrolled: 0`, `nextSessionId: null`; nombre no encontrado → `'—'`.
- **`http-groups.repository.spec.ts`**: los cinco repositorios se llaman una vez; si uno rechaza,
  rechaza el conjunto.
- **`http-class-sessions.repository.spec.ts`**: `listRange` pide `from−1d … to+1d` y no filtra.
- **`grupos.facade.spec.ts`**: `saveAttendance` no toca `loading()` ni `error()` y propaga el
  rechazo; NO relee después de guardar (§6); el `effect` de tenant sigue limpiando.
- **Componentes**: `roster-table` con una fila `held`; `sessions-table` con el botón
  deshabilitado en una sesión futura y en una cancelada; `attendance-modal` prellenado desde
  `attendanceStatus`.

Se borran los specs de §8.

## 11. Techos, en una lista

Cada uno lleva su comentario `ponytail:` en el código, nombrando techo y salida.

| # | Techo | Salida |
|---|---|---|
| 1 | Roster = próxima sesión programada; parpadea, y un grupo sin próxima sesión lo muestra vacío | tabla `enrollment` |
| 2 | Ventana fija de ±28 días | `?scheduleTemplateId=` en `GET /class-sessions` |
| 3 | Desde la tabla no se ve si una sesión ya tiene asistencia tomada | que `markBulk` pase la clase a `completada` |
| 4 | Sin créditos ni % de asistencia en el roster | `enrollment` (son datos POR INSCRIPCIÓN) |
| 5 | Padrón completo en memoria para los nombres de la lista de espera | `include: { student }` en `WaitingListService.list()` — una línea del lado del backend, la misma que resolvió §9 de `conexiones-disponibles.md` |
