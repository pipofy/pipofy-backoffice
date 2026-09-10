# Asistencia de clase — diseño

Fecha: 2026-09-01
Estado: aprobado, listo para plan de implementación

## 1. Contexto

`SesionModalComponent` (`features/reservas/components/`) ya muestra el roster completo de una
clase: consume `GET /class-sessions/:id/reservations` a través de `SesionFacade` y lo reparte en
tres secciones (Anotados, Pendientes de confirmar, Lista de espera). Sabe quién está confirmado.
Lo que no hay es forma de decir si esa persona **vino**.

El backend sí la tiene, y hace tiempo: `AttendanceController` expone
`POST /class-sessions/:id/attendance` y `POST /reservations/:id/attendance`, y ninguno de los dos
lo consume nadie desde este repo. Es el segundo hueco del inventario de endpoints libres, después
del alta de profesor.

Marcar asistencia **no toca créditos**. `AttendanceService` escribe una sola tabla —`attendance`,
upsert por `reservationId`— y nada más: la reserva sigue `confirmed`, el cupo no cambia, la lista
de espera no cambia. Los créditos el backend los descuenta al reservar y los devuelve al cancelar
(`class-sessions.service.ts:137`, `reservations.service.ts:109`). Esto importa porque la maqueta
de `features/grupos` hace lo contrario —`applyAttendance` descuenta al tomar asistencia— y quien
lea las dos va a querer unificarlas. No se pueden: son modelos distintos.

## 2. Alcance

**Adentro:** una sección *Asistencia* en el modal de clase que lista las reservas **confirmadas**
con Presente/Ausente por fila, y un botón que manda todo junto por
`POST /class-sessions/:id/attendance`.

**Afuera, y por qué:**

- **`POST /reservations/:id/attendance`.** El bulk lo cubre con un array de un elemento.
- **Releer lo marcado.** No hay endpoint (§3.2). Es el techo de toda la entrega.
- **Tocar `features/grupos`.** Su `applyAttendance` corre sobre `InMemoryGroupsRepository` y
  descuenta créditos que este backend ya gastó en otro momento. Conectarlo es un rediseño de
  modelo, no un cambio de repositorio, y es una decisión de producto aparte.
- **Esconder la sección por rol** (§3.7).

## 3. Decisiones y sus techos

### 3.1 Bulk, no de a uno

Se marca todo el roster y se manda un solo POST. La alternativa —dos botones por fila que pegan
`POST /reservations/:id/attendance` al toque— evita el estado sin guardar, pero convierte una
clase de 6 en 6 requests y pierde el array de resultados por ítem, que es justo lo que permite
decir *cuáles* fallaron.

### 3.2 No se recuerda nada: la planilla vuelve en blanco

`ClassSessionsService.listReservations()` hace `include: { student: true, reservationStatus: true }`
y **no incluye `attendance`**. Ningún otro endpoint del backend expone la asistencia por HTTP: los
únicos dos consumidores de esa tabla son internos de WhatsApp
(`whatsapp/conversation.service.ts:880`, `whatsapp/coach-conversation.service.ts:704`). Así que no
hay forma de releer lo marcado.

Con eso, tres caminos. Se elige el tercero:

1. Recordarlo en memoria mientras dure la visita a `/reservas` — miente después de un F5.
2. Recordarlo en `localStorage` — miente más tiempo y más convencida, y nadie la invalida.
3. **Olvidarlo.** Guardado el POST, la planilla vuelve a blanco.

**Techo:** quien reabre la clase no puede saber si ya tomó asistencia.
**Salida:** `include: { attendance: true }` en `listReservations` del backend.

Mitigación que no contradice la decisión: el POST devuelve el `status` por ítem en el éxito, así
que se muestra el conteo de lo que se acaba de guardar («Asistencia guardada: 5 presentes, 1
ausente»). No recuerda nada — reporta lo que acaba de hacer, y le da al mostrador un número
chequeable contra la gente que tiene enfrente.

### 3.3 Guardar PISA lo que el alumno contestó por WhatsApp

`conversation.service.ts` escribe `confirmo_si` / `confirmo_no` en **la misma fila** de
`attendance`, con el mismo `reservationId`. El upsert del panel las reemplaza. Y dos personas del
club marcando la misma clase se pisan entre sí sin que nadie lo vea, porque no hay relectura que
lo detecte.

No se mitiga más allá del conteo de §3.2. **Techo:** se puede perder dato, en silencio; no se
puede perder plata (créditos, cupo y estado de la reserva quedan intactos, §1).
**Salida:** la misma que §3.2 — si el roster trajera la asistencia, la pantalla podría mostrar lo
que ya hay antes de pisarlo.

### 3.4 El body se construye desde el roster, no desde lo marcado

Es el borde que se lleva la entrega si se hace al revés. Las marcas viven en el componente y
sobreviven a las relecturas del roster; entre marcar y guardar, la reserva de alguien puede dejar
de estar `confirmed` — se confirma un hold y el roster se relee, o el alumno manda «no puedo» por
WhatsApp y `conversation.service.ts` la pasa a `cancelled`.

Si el body se serializa desde el mapa de marcas, esa marca muerta viaja igual, el backend la
rechaza per-ítem, y como el éxito parcial **no** limpia la planilla (§3.6) el reintento falla para
siempre: la persona queda en loop con un error que nunca va a poder resolver.

Por eso el body se arma recorriendo las **filas confirmadas de ahora** y tomando su marca, si
tiene. El mapa de marcas es una consulta, nunca la fuente. Es lo mismo que hace el `markList` del
modal hermano (`features/grupos/components/attendance-modal.component.ts`), cuyo comentario ya
dice que descartar marcas huérfanas «no es un error».

### 3.5 `markBulk` no es atómico, y el mensaje de falla puede ser jerga

`AttendanceService.markBulk()` no abre transacción: itera, hace un upsert por ítem y captura la
excepción de cada uno en un `try` propio. Consecuencias, las dos verificadas leyendo el service:

- **Si el ítem 3 de 10 falla, los dos primeros ya están escritos.** Reintentar es seguro igual
  —el upsert es idempotente y no toca nada más que su fila— pero el spec lo nombra para que
  nadie asuma un todo-o-nada que no existe.
- **El `catch (err: any) { error: err.message }` atrapa cualquier excepción**, no sólo las
  `BadRequestException` escritas para humanos. Además de los tres mensajes de dominio en
  castellano, por ese canal pueden salir `"Cannot convert abc to a BigInt"` (mensaje de V8) y
  `"attendance_status 'asistio' no está sembrado — correr prisma:seed"` (jerga de infra, y en ese
  caso sale en **todas** las filas a la vez).

Se muestra el mensaje crudo igual. Es el criterio explícito del repo —`to-domain-error.ts`: «en un
CRUD el mensaje del backend ES el feedback útil»— y traducirlo con un mapa sería peor: un string
que el mapa no cubra quedaría mudo. Lo que sí se hace es **agrupar los fallidos por mensaje**
(«Rita Pérez, Juan Gómez: Solo se puede marcar asistencia sobre reservas confirmadas») en vez de
una línea por alumno: si el error es sistémico, es una línea y no seis.

### 3.6 El éxito parcial no limpia la planilla, pero sí relee el roster

En un éxito parcial la planilla queda como estaba: es donde se corrige y se reintenta, mismo
criterio que deja abierto el modal de edición de profesor cuando el guardado falla.

Con una vuelta más. El fallo más probable en producción es el de §3.4 —la reserva dejó de estar
`confirmed`—, y ésa no va a entrar por más que se reintente. Así que **después de un parcial se
relee `GET /class-sessions/:id/reservations`**: la fila muerta deja de estar confirmada, sale de
la planilla y se lleva su marca. Lo que queda en pantalla es exactamente lo reintentable, y el
bloque de fallidos sigue explicando por qué desapareció.

Es la única relectura de la entrega, y sólo en el camino de falla (§3.8).

### 3.7 No se esconde nada por rol

`AttendanceController` está anotado `@Roles('admin', 'encargado', 'superprofesor')` — sin
`profesor`. La tentación es esconder la sección para ese rol. No se hace, por dos razones:

1. **`ClassSessionsController` tiene los mismos tres roles a nivel de clase**
   (`class-sessions.controller.ts:18`). Un `profesor` come 403 en `GET /class-sessions` y en
   `GET /:id/reservations`: no ve la grilla ni puede abrir el modal. Gatear la sección sería pulir
   una pantalla que para ese rol ya está rota entera.
2. **No hay un solo precedente de gatear UI por rol en el repo.** `SessionStore.roles()` se
   consume en un único lugar —`shell.component.ts:115`, para imprimir la etiqueta del rol en el
   pie del sidebar—; `app.routes.ts` sólo tiene `authGuard`/`mustBeLoggedIn` y `NAV_ITEMS` no
   filtra nada.

El 403 llega como `"Forbidden resource"` genérico de Nest, y `toDomainError` lo normaliza a
`{kind:'forbidden'}`, cuyo copy ya es decente: «No tenés permisos para hacer esto. Pedí acceso al
administrador del club.»

Nota al margen, anterior a esta entrega y fuera de su alcance: que `/reservas` aparezca en el
sidebar de un usuario que no puede usarla es un problema de navegación, no de esta sección.

**Dato para el que lea `@Roles(...)` y saque cuentas:** en un club real sólo existen `admin` y
`encargado`. `auth.service.ts:46` siembra `superprofesor` únicamente en el signup
`tipo: 'particular'`; el tercer rol permitido es letra muerta en ese tenant.

### 3.8 La escritura NO relee (salvo §3.6), y SÍ devuelve algo

**No relee.** `AttendanceService` sólo escribe la tabla `attendance` (§1): la reserva sigue
`confirmed`, el cupo no cambia, la lista de espera no cambia. Una relectura devolvería exactamente
lo que ya está en pantalla. Es el desvío real de la convención del repo, y la excepción de §3.6 es
la única.

**Devuelve algo, y eso NO es un desvío.** El array por ítem es información que ninguna relectura
recupera (§3.2), y ya hay precedentes de contratos cuya escritura devuelve un valor:
`groups.repository.ts:17` (`saveAttendance` → snapshot completo) y `schedules.repository.ts:13`
(`generateSessions` → `SessionGenerationResult`). El comentario de
`http-class-sessions.repository.ts:134` que afirma «hoy todas las escrituras devuelven void» ya
estaba desactualizado antes de esta entrega y se corrige acá (§4.4).

### 3.9 Sección propia, componente propio

La sección no vive dentro de `SesionModalComponent`. Sale a `AsistenciaSeccionComponent`, un
componente tonto que no toca la facade: recibe el roster, emite las marcas, y el modal le informa
el desenlace. Tres razones, todas del repo:

1. `sesion-modal.component.ts` ya tiene 424 líneas con el template inline y es el archivo más
   grande del repo; el segundo (`horario-form-modal.component.ts`) tiene 333.
2. Su spec **no usa un doble de `SesionFacade`**: monta la facade real con dobles de cinco
   repositorios. Cualquier test nuevo adentro paga ese costo de entrada.
3. El precedente exacto existe: `AttendanceModalComponent` de `features/grupos` es un componente
   tonto con `output` y métodos imperativos (`markDone()`/`markFailed()`), y su comentario dice
   literal que «el modal NO toca la facade: la página cablea y le informa el desenlace».

## 4. Arquitectura

### 4.1 Dominio

**`core/domain/entities/session-attendance.ts`** *(nuevo)*. El nombre lleva `session-` a propósito:
`AttendanceMark` **ya existe** en `entities/group.ts:20` con otra forma (`{ memberId, present }`),
y dos entidades homónimas y distintas en la misma capa es una trampa. Mismo criterio que puso
`session-reservation.ts` al lado del concepto homónimo de grupos.

```ts
export type SessionAttendanceStatus = 'asistio' | 'ausente';

export interface SessionAttendanceMark {
  readonly reservationId: string;
  readonly status: SessionAttendanceStatus;
}

export interface SessionAttendanceResult {
  readonly reservationId: string;
  readonly ok: boolean;
  /** El status que quedó escrito. Sólo viene cuando `ok`. */
  readonly status: SessionAttendanceStatus | null;
  /** El motivo CRUDO del backend. Sólo viene cuando `!ok`. Ver §3.5. */
  readonly error: string | null;
}

export function createSessionAttendanceDraft(
  marks: readonly SessionAttendanceMark[],
): readonly SessionAttendanceMark[];
```

`createSessionAttendanceDraft` valida las dos invariantes que `MarkAttendanceBulkDto` declara
—`@ArrayMinSize(1)` y `@ArrayMaxSize(100)`— y tira `InvalidAttendanceError`. Son las dos únicas
que el backend chequea a nivel DTO: `items` no lleva `@ValidateNested()`, así que el
`ValidationPipe` global (`app.module.ts:62`, con `whitelist` y `forbidNonWhitelisted`) **no mira
dentro del array**. Todo lo demás se resuelve per-ítem dentro del service.

El union cerrado `'asistio' | 'ausente'` es correcto hoy porque la pantalla sólo escribe. La tabla
ya tiene filas con `confirmo_si` / `confirmo_no` / `sin_respuesta` puestas por WhatsApp: va un
comentario `ponytail:` nombrando el techo, y la salida es un `sessionAttendanceStatusLabel()` en
el dominio, estilo `reservationStatusLabel`, para cuando se lea.

**`core/domain/errors.ts`**: `InvalidAttendanceError extends DomainRuleError`, junto a sus
hermanos. **Sin `kind` nuevo**: `to-domain-error.ts:21` lo normaliza a `{kind:'domain', message}` y
el `switch` exhaustivo no se toca. Precedente: `InvalidUserError`, `SessionCancelledError`.

**`core/domain/contracts/class-sessions.repository.ts`**:

```ts
abstract markAttendance(
  sessionId: string,
  marks: readonly SessionAttendanceMark[],
): Promise<SessionAttendanceResult[]>;
```

El docstring tiene que responder al precedente contrario, no ignorarlo: `reservations.repository.ts:7`
documenta que «el contrato se corta por CONCEPTO» y por eso `reserve()` vive ahí aunque pegue a
`/class-sessions/:id/reservations`. La asistencia va en `ClassSessionsRepository` igual, y el
argumento es de concepto y no de path: la operación es **de la clase**, no de una reserva —
`markBulk` valida que cada reserva pertenezca a ese `classSessionId`, y la unidad de trabajo del
mostrador es «tomar asistencia de esta clase».

### 4.2 Data

**`core/data/dto/class-session.dto.ts`**:

- `AttendanceRequestSchema` = `{ items: [{ reservationId: string, status: 'asistio'|'ausente' }] }`.
  Exactamente esa forma y nada más: `forbidNonWhitelisted: true` es global, así que una clave de
  más es un 400 de la llamada entera.
- `AttendanceResultListDtoSchema` = array tolerante con `status` y `error` **opcionales y
  nullables**: el backend manda uno o el otro según el `ok`, nunca los dos.

**`core/data/mappers/class-session.mapper.ts`**: `toAttendanceRequest` y
`toSessionAttendanceResult`. El mapper estrecha `status` al union y deja `null` si no matchea.

`reservationId` vuelve **tal cual se mandó**: `markBulk` hace
`results.push({ reservationId: item.reservationId, ... })` con el string original del request, no
con el BigInt. No hay que re-parsearlo ni normalizarlo.

**`core/data/repositories/http-class-sessions.repository.ts`**: el POST, con el mismo
`try` / `v.parse` / `toDomainError` que sus vecinos. Devuelve **201**, no 200 — `markBulk` no
declara `@HttpCode` y rige el default de `@Post()` de Nest; `HttpClient` lo trata como éxito igual,
pero ningún comentario del repo debe decir 200.

### 4.3 Feature

**`features/reservas/sesion.facade.ts`** — `tomarAsistencia()`. **No usa `run()`**: `run()`
devuelve `Promise<void>` y publica en la tríada, así que un valor de retorno tendría que salir por
una variable de closure y el `[]` del catch quedaría indistinguible de «salió todo bien». El
patrón del repo para esto es `setLoading`/`setError` a mano con un centinela explícito, y el
análogo exacto ya existe: `horarios.facade.ts:175`, `generate(): Promise<SessionGenerationResult | null>`
— otra escritura que devuelve un resultado por ítem que ninguna relectura recupera.
`signal-store.base.ts:19` documenta `setLoading` justamente para «los flujos que NO caben en run()».

```ts
async tomarAsistencia(
  sessionId: string,
  marks: readonly SessionAttendanceMark[],
): Promise<readonly SessionAttendanceResult[] | null> {
  this.setLoading(true);
  this.setError(null);
  try {
    const results = await this.sessions.markAttendance(
      sessionId,
      createSessionAttendanceDraft(marks),
    );
    if (results.some((r) => !r.ok)) {
      // §3.6: la fila que dejó de estar `confirmed` no va a entrar nunca. La relectura la saca
      // de la planilla. Su fallo se traga: la planilla queda como está y el bloque de fallidos
      // ya cuenta el problema real — un error acá lo taparía.
      try { await this.loadReservations(sessionId); } catch { /* ver arriba */ }
    }
    return results;
  } catch (err) {
    this.setError(toDomainError(err));
    return null;
  } finally {
    this.setLoading(false);
  }
}
```

`createSessionAttendanceDraft` se llama **derecho**, sin el `Promise.resolve().then()` que usan
`reservar()` y `cobrar()`: acá el `try/catch` está en la misma función, así que su throw síncrono
ya cae donde tiene que caer. Devuelve `null` cuando falló el POST entero; `[]` es imposible
(`ArrayMinSize(1)` lo garantiza del lado del draft).

**`features/reservas/components/asistencia-seccion.component.ts`** *(nuevo)*, con su `.css` y su
`.spec` — selector `app-asistencia-seccion`:

```ts
readonly reservas = input.required<readonly SessionReservation[]>();   // el roster COMPLETO
readonly nombres  = input.required<ReadonlyMap<string, string>>();     // studentId → nombre
readonly saving   = input(false);
readonly guardar  = output<readonly SessionAttendanceMark[]>();

reset(): void;                                                          // lo llama open()
resultado(results: readonly SessionAttendanceResult[] | null, error: string): void;
```

`nombres` es el `Map` y no una función: el modal ya tiene ese `computed` (`studentNames`) y pasar
un método pierde el `this`.

Estado interno, tres signals, los tres limpiados por `reset()`:

| Signal | Tipo | Para qué |
|---|---|---|
| `marcas` | `Record<string, SessionAttendanceStatus>` | lo marcado y sin guardar |
| `fallos` | `readonly SessionAttendanceResult[]` | el éxito parcial |
| `resumen` | `string` | «Asistencia guardada: 5 presentes, 1 ausente.» |

**`Record` y no `Map`**: con `OnPush` + zoneless un `map.set()` in-place no notifica y la fila no
repinta. El precedente para esta misma UI es
`attendance-modal.component.ts:105` (`signal<Record<string, boolean>>({})`) con `update()` y
spread.

Computados:

- `confirmadas()` = `reservas().filter(r => r.status === 'confirmed')`. Es la planilla, y también
  la fuente del body (§3.4).
- `hayPendientes()` = hay alguna fila `held` o `pending_review`. Sólo para decidir si se muestra
  el hint de §5.
- `fallosAgrupados()` = `mensaje → nombres[]`, para el agrupado de §3.5.

`resultado()` concentra los tres desenlaces. Arranca limpiando `fallos`, `resumen` y el error
propio — si no, el resultado de un guardado viejo se queda al lado del nuevo y se leen como si
fueran el mismo — y después:

| Entrada | Qué hace |
|---|---|
| `results === null` | pinta `error` en su propio bloque, deja `marcas` intacto |
| todos `ok` | limpia `marcas` y arma `resumen` contando los `status` que volvieron |
| alguno `!ok` | guarda `fallos`, deja `marcas` intacto |

**`features/reservas/components/sesion-modal.component.ts`** — cambios acotados:

- renderiza `<app-asistencia-seccion>` entre *Anotados* y *Pendientes de confirmar*, con un
  `viewChild.required`;
- `open()` suma una línea: `this.asistencia().reset()`;
- `onAsistencia(marks)` pasa por el funnel `conSesion()`, como los otros cinco handlers. El
  docstring de `conSesion` dice que el freno «se arregla en cuatro lugares y se olvida en el
  quinto»: el sexto handler no puede ser la excepción.

```ts
protected onAsistencia(marks: readonly SessionAttendanceMark[]): void {
  this.conSesion(async (sessionId) => {
    const results = await this.facade.tomarAsistencia(sessionId, marks);
    this.asistencia().resultado(results, this.errorText());
  });
}
```

El error del POST entero se pinta **dentro de la sección**, al lado del botón que se acaba de
apretar, y no sólo en el `errorText()` de arriba de todo: el `.modal-body` scrollea
(`components.css:289`) y con cinco secciones arriba un 403 queda fuera de la vista. El plan de
alta de profesor ya cerró esta misma discusión.

### 4.4 Colateral en código existente

| Archivo | Qué se corrige |
|---|---|
| `sesion-modal.component.spec.ts:86` | su doble de `ClassSessionsRepository` es un literal casteado y **rompe el build** con el método nuevo (`TS2352`). Verificado con `tsc -p tsconfig.spec.json`, no inferido |
| `sesion.facade.spec.ts:31` | ídem |
| `http-class-sessions.repository.ts:134` | el comentario «hoy todas las escrituras devuelven void» ya era falso (§3.8) |
| `sesion-modal.component.ts:190` | el comentario del `setInterval` dice «sólo tickea si hay un hold que contar»; en realidad tickea con cualquier fila `held`, vencida incluida, porque `holdsOf` filtra sólo por status |

Los otros tres dobles de `ClassSessionsRepository` **no** rompen, porque hacen spread sobre un
`Partial<ClassSessionsRepository>`: `reservas.facade.spec.ts:20`,
`reservas-page.component.spec.ts:33`, `http-dashboard.repository.spec.ts:38`.

## 5. La pantalla

```
<h4>Asistencia</h4>
  Sólo se puede marcar la asistencia de las reservas confirmadas.      ← hint, si hayPendientes()
  Si falta alguien, confirmá su reserva primero.

  Rita Pérez               [ Presente ] [ Ausente ]
  Juan Gómez               [ Presente ] [ Ausente ]

  [ Vinieron todos ]  [ Guardar asistencia ]
  Asistencia guardada: 5 presentes, 1 ausente.                          ← aria-live="polite"
```

- **La sección no se renderiza si `confirmadas()` está vacío.** Es una excepción consciente al
  vocabulario del modal, cuyas otras tres secciones tienen su `@empty` («Todavía no se anotó
  nadie», «Ninguna reserva pendiente», «Sin lista de espera»): acá no hay nada que ofrecer ni
  ninguna acción que sugerir, y una cuarta línea de vacío en un modal que ya tiene tres es ruido.
- **El hint de las no confirmadas importa** porque Anotados puede mostrar seis filas y Asistencia
  cuatro: los `held` vigentes y los `pending_review` —el anotado por WhatsApp sin plan, que el
  comentario de `anotados()` describe como real y frecuente— aparecen arriba y no acá.
- **«Vinieron todos»** llena la planilla de un click y deja Guardar como segundo acto. La
  alternativa era defaultear todas las filas a Presente, como hace el modal de grupos; no se hace
  porque allá el modal ENTERO es «tomar asistencia» —un acto deliberado— y acá la sección vive
  dentro de un modal que se abre para veinte cosas más: un Guardar de más escribiría presencias
  que nadie miró.
- **Copy: Presente / Ausente**, no «Vino / Faltó». Es lo que ya usa `attendance-modal.component.ts`
  y lo que devuelve `reservationStatusLabel('no_show')`. Ojo con el efecto de eso: «Ausente»
  aparece dos veces en el mismo modal con dos significados —el botón, y el estado de reserva
  `no_show` que se renderiza en Anotados— y **marcar Ausente NO cambia el estado de la reserva**
  (§1). Es aceptable porque el vocabulario alternativo sería inventado; queda escrito acá para
  quien venga a «unificar».
- **«Guardar asistencia»**, no «Confirmar asistencia»: «Confirmar» ya es el verbo del botón de
  confirmar reservas, tres secciones más abajo.
- **Accesibilidad.** Dos botones con `aria-pressed`, no un radio group —es el precedente del repo
  y un radiogroup obligaría a manejar flechas a mano sin ganar nada—, envueltos por fila en un
  `<div role="group" [attr.aria-label]="'Asistencia de ' + nombre">`: sin eso un lector de
  pantalla anuncia «Presente, botón, no presionado» sin decir de quién. El `resumen` va con
  `aria-live="polite"`. Hay **tres** estados por fila (sin marcar, presente, ausente) y con
  `aria-pressed` los dos botones de una fila sin marcar quedan iguales, así que «sin marcar» no
  puede distinguirse sólo por color.

## 6. Errores

Cuatro superficies, cada una donde corresponde.

| Qué pasó | Dónde se ve | Qué dice |
|---|---|---|
| El POST entero falló (403, red, 404 de clase, draft inválido) | bloque propio en la sección, junto al botón — y también en el `errorText()` de arriba | `domainErrorMessage()`: para 403, «No tenés permisos para hacer esto…» |
| Éxito parcial | bloque `.notice hold` dentro de la sección, agrupado por mensaje | «Rita Pérez, Juan Gómez: Solo se puede marcar asistencia sobre reservas confirmadas» |
| Éxito total | línea bajo el botón, `aria-live` | «Asistencia guardada: 5 presentes, 1 ausente.» |
| Nada marcado | no ocurre | el botón está deshabilitado |

Los tres mensajes de dominio que el backend puede devolver per-ítem, en castellano y accionables:
`"La reserva no pertenece a esta clase"`, `"Solo se puede marcar asistencia sobre reservas
confirmadas"`, `"status inválido: debe ser 'asistio' o 'ausente'"`. Los otros dos posibles son
jerga y salen igual (§3.5).

Sin `ToastService`: el modal no lo inyecta —lo hace la página— y un toast en la esquina mientras
se mira adentro de un `<dialog>` es peor feedback que una línea bajo el botón que se apretó.

## 7. Tests

Vitest + `TestBed` + jsdom, `provideZonelessChangeDetection()` en todos, dobles como objetos
planos casteados al contrato.

| Archivo | Qué fija |
|---|---|
| `session-attendance.spec.ts` *(nuevo)* | draft vacío tira `InvalidAttendanceError`; 101 ítems tira; 100 pasa |
| `class-session.mapper.spec.ts` | el request; el parseo de un array **mixto** — un ítem `ok:true` sin `error`, uno `ok:false` sin `status`; un `status` desconocido queda `null` |
| `http-class-sessions.repository.spec.ts` | path y body exactos; el array mixto llega mapeado; un 403 sale `{kind:'forbidden'}` |
| `sesion.facade.spec.ts` | devuelve los results; devuelve `null` con `error()` seteado cuando el POST tira; **relee sólo si hubo un fallo** y **no relee si salió todo bien** (§3.8); un fallo de esa relectura no pisa el resultado parcial; `loading()` queda en `false` pase lo que pase |
| `asistencia-seccion.component.spec.ts` *(nuevo)* | no renderiza sin confirmadas; el hint aparece con un `held`; emite **sólo las filas confirmadas marcadas** y descarta la marca huérfana (§3.4); «Vinieron todos» llena la planilla; `resultado()` en sus tres desenlaces; `reset()` limpia |
| `sesion-modal.component.spec.ts` | el modal cablea la sección: `open()` la resetea y el guardado pasa por `conSesion()` (un segundo submit con `loading()` en true no llama a la facade) |

El test que fija §3.4 es el que hay que escribir con cuidado: marcar una fila, cambiar el roster
para que esa reserva deje de estar `confirmed`, guardar, y verificar que **no** viaja.

## 8. Techos, con su salida

| Techo | Salida |
|---|---|
| No se puede releer lo marcado: la planilla vuelve en blanco y quien reabre no sabe si ya tomó asistencia (§3.2) | `include: { attendance: true }` en `listReservations` del backend |
| Guardar pisa lo que el alumno respondió por WhatsApp, y dos personas se pisan entre sí, en silencio (§3.3) | la misma: con la asistencia en el roster, la pantalla puede mostrar lo que ya hay antes de pisarlo |
| El mensaje de falla per-ítem puede ser jerga técnica en inglés (§3.5) | que el backend normalice ese `catch` a mensajes de dominio |
| El union `'asistio' \| 'ausente'` ignora los tres status que escribe WhatsApp (§4.1) | un `sessionAttendanceStatusLabel()` en el dominio, el día que se lea la asistencia |
| `/reservas` aparece en el sidebar de un rol que come 403 en toda la pantalla (§3.7) | filtrar `NAV_ITEMS` por rol; es anterior a esta entrega y la excede |
