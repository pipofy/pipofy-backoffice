# Asistencia de clase — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que desde el modal de clase de `/reservas` se pueda marcar Presente/Ausente a las reservas confirmadas y guardarlas todas juntas contra `POST /class-sessions/:id/attendance`.

**Architecture:** Slice vertical estándar del repo — entidad de dominio con su draft → DTO valibot + mapper → método nuevo en el contrato `ClassSessionsRepository` y su implementación HTTP → método en `SesionFacade` que **no** usa `run()` → un componente tonto nuevo que el modal existente cablea. La escritura devuelve un resultado por ítem (el backend responde 201 con un array aunque la mitad falle) y no relee, salvo en el camino de falla.

**Tech Stack:** Angular 20 standalone + zoneless + signals, valibot, vitest + TestBed + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-01-asistencia-de-clase-design.md`

## Global Constraints

- **No se toca la API del repo hermano `pipofy-backend`.** Ninguna tarea edita nada fuera de este repositorio.
- **No modificar `package.json` ni `package-lock.json`.** Si `node_modules` no está instalado, instalar sin tocar esos dos archivos.
- **No editar `src/environments/environment*.ts`**: son generados por `set-env.mjs`.
- Angular 20 **standalone + zoneless + signals**. Nada de NgModules, Zone.js ni RxJS en las facades (`firstValueFrom` sólo en los repositorios). Componentes con `ChangeDetectionStrategy.OnPush`, `inject()`, `signal`/`computed`, `input()`/`output()`/`viewChild.required()`.
- **Boundaries de capas, impuestos por `eslint-plugin-boundaries`** (violarlas es error de lint): `domain` → sólo `domain`, y **prohibido `@angular/*`**; `data` → `domain`, `data`; `shared` → sólo `shared`; `features/<x>` → `domain`, `data`, `shared`, **nunca otra feature**.
- Usar siempre los alias `@domain/*`, `@data/*`, `@shared/*`, `@features/*`. Nunca rutas relativas largas entre capas.
- **Idioma:** comentarios, copy de UI y nombres de feature en **español**; `core/` en **inglés** salvo los comentarios, que en este repo van en español también.
- **Ids siempre string.** La API los serializa así (polyfill de `BigInt.prototype.toJSON`).
- **Todo `TestBed` lleva `provideZonelessChangeDetection()`** en sus providers.
- **No hay librería de mocks:** los dobles son objetos planos casteados al contrato (`as ClassSessionsRepository`), con un array de `calls` para verificar qué se llamó.
- **Prettier: `printWidth: 100`, `singleQuote: true`.** Al terminar cada tarea, correr `npx prettier --write` sobre los archivos tocados **excepto** donde haya un `eslint-disable-next-line` cuyo target podría moverse de línea.
- **Copy exacto, sin variantes:** `Asistencia`, `Presente`, `Ausente`, `Vinieron todos`, `Guardar asistencia`, `Asistencia guardada: N presentes, M ausentes.`, `Sólo se puede marcar la asistencia de las reservas confirmadas. Si falta alguien, confirmá su reserva primero.`
- **Nunca `AttendanceMark` a secas:** ese nombre ya existe en `@domain/entities/group.ts` con otra forma. Los tipos nuevos llevan el prefijo `SessionAttendance`.
- Comandos: `npm test` (vitest), `npx ng test --include <ruta al spec>` para uno solo, `npm run lint`.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/app/core/domain/entities/session-attendance.ts` *(nuevo)* | tipos de la asistencia de una clase + `createSessionAttendanceDraft` | 1 |
| `src/app/core/domain/entities/session-attendance.spec.ts` *(nuevo)* | las invariantes del draft | 1 |
| `src/app/core/domain/errors.ts` | `InvalidAttendanceError` | 1 |
| `src/app/core/data/dto/class-session.dto.ts` | schemas del request y de la respuesta por ítem | 2 |
| `src/app/core/data/mappers/class-session.mapper.ts` | entidad ↔ DTO | 2 |
| `src/app/core/data/mappers/class-session.mapper.spec.ts` | el request y el array mixto | 2 |
| `src/app/core/domain/contracts/class-sessions.repository.ts` | `markAttendance` | 3 |
| `src/app/core/data/repositories/http-class-sessions.repository.ts` | el POST | 3 |
| `src/app/core/data/repositories/http-class-sessions.repository.spec.ts` | path, body, array mixto, 403 | 3 |
| `src/app/features/reservas/sesion.facade.ts` | `tomarAsistencia()` | 4 |
| `src/app/features/reservas/sesion.facade.spec.ts` | relee sólo en el parcial, centinela `null` | 3 (doble) y 4 (tests) |
| `src/app/features/reservas/components/asistencia-seccion.component.ts` *(nuevo)* | la planilla, componente tonto | 5 |
| `src/app/features/reservas/components/asistencia-seccion.component.css` *(nuevo)* | estilos locales de la planilla | 5 |
| `src/app/features/reservas/components/asistencia-seccion.component.spec.ts` *(nuevo)* | los 8 comportamientos de la planilla | 5 |
| `src/app/features/reservas/components/sesion-modal.component.ts` | cablea la sección | 6 |
| `src/app/features/reservas/components/sesion-modal.component.spec.ts` | el cableado | 3 (doble) y 6 (tests) |

**Ningún archivo lo modifican dos tareas con contenido en conflicto.** `sesion.facade.spec.ts` y `sesion-modal.component.spec.ts` los toca la Tarea 3 sólo para agregar `markAttendance` a sus dobles (sin eso el build no compila), y las Tareas 4 y 6 construyen sobre eso.

---

### Task 1: Entidad de dominio y su error

**Files:**
- Create: `src/app/core/domain/entities/session-attendance.ts`
- Create: `src/app/core/domain/entities/session-attendance.spec.ts`
- Modify: `src/app/core/domain/errors.ts` (agregar una clase después de `InvalidReservationError`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type SessionAttendanceStatus = 'asistio' | 'ausente'`
  - `interface SessionAttendanceMark { readonly reservationId: string; readonly status: SessionAttendanceStatus }`
  - `interface SessionAttendanceResult { readonly reservationId: string; readonly ok: boolean; readonly status: SessionAttendanceStatus | null; readonly error: string | null }`
  - `function createSessionAttendanceDraft(marks: readonly SessionAttendanceMark[]): readonly SessionAttendanceMark[]`
  - `class InvalidAttendanceError extends DomainRuleError`

- [ ] **Step 1: Agregar el error de dominio**

En `src/app/core/domain/errors.ts`, inmediatamente **después** de la clase `InvalidReservationError`:

```ts
/**
 * La tira `createSessionAttendanceDraft`. Vive acá porque TODAS las DomainRuleError viven acá:
 * si se dispersan, `toDomainError` deja de tener un solo lugar donde mirar.
 */
export class InvalidAttendanceError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAttendanceError';
  }
}
```

**NO agregar un `kind` nuevo a `DomainError`.** `to-domain-error.ts:21` ya mapea cualquier `DomainRuleError` a `{ kind: 'domain', message }` y el `switch` exhaustivo de `domainErrorMessage()` no se toca. Precedente: `InvalidUserError`, `InvalidReservationError`.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/app/core/domain/entities/session-attendance.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createSessionAttendanceDraft, SessionAttendanceMark } from './session-attendance';
import { InvalidAttendanceError } from '../errors';

const marca = (n: number): SessionAttendanceMark => ({
  reservationId: String(n),
  status: 'asistio',
});

describe('createSessionAttendanceDraft', () => {
  it('sin marcas tira: el backend valida @ArrayMinSize(1) y responde 400', () => {
    expect(() => createSessionAttendanceDraft([])).toThrow(InvalidAttendanceError);
  });

  it('con más de 100 tira: es el tope de @ArrayMaxSize(100) del DTO del backend', () => {
    const ciento_una = Array.from({ length: 101 }, (_, i) => marca(i));
    expect(() => createSessionAttendanceDraft(ciento_una)).toThrow(InvalidAttendanceError);
  });

  it('con exactamente 100 pasa: el tope es inclusivo', () => {
    const cien = Array.from({ length: 100 }, (_, i) => marca(i));
    expect(createSessionAttendanceDraft(cien)).toHaveLength(100);
  });

  it('devuelve las marcas tal cual: no reordena, no deduplica, no completa nada', () => {
    // Lo que llega ya viene reconciliado contra el roster por el componente. El draft valida
    // las invariantes de escritura y nada más.
    const marcas: SessionAttendanceMark[] = [
      { reservationId: '7', status: 'ausente' },
      { reservationId: '3', status: 'asistio' },
    ];
    expect(createSessionAttendanceDraft(marcas)).toEqual(marcas);
  });
});
```

Sin `TestBed`: es TypeScript puro, la capa `domain` no puede importar `@angular/*`.

- [ ] **Step 3: Correr el test y verificar que FALLA**

Run: `npx ng test --include src/app/core/domain/entities/session-attendance.spec.ts`
Expected: FAIL — el módulo `./session-attendance` no existe.

- [ ] **Step 4: Escribir la entidad**

Crear `src/app/core/domain/entities/session-attendance.ts`:

```ts
import { InvalidAttendanceError } from '../errors';

/**
 * La asistencia de UNA clase, tal como la escribe `POST /class-sessions/:id/attendance`.
 *
 * El prefijo `Session` no es decorativo: `AttendanceMark` YA EXISTE en `entities/group.ts` con
 * otra forma (`{ memberId, present }`) y pertenece a la maqueta de Grupos, que corre sobre un
 * repositorio en memoria y descuenta créditos AL TOMAR ASISTENCIA. Este backend los descuenta
 * al reservar y `AttendanceService` no toca créditos en absoluto. Dos entidades homónimas y
 * distintas en la misma capa es una trampa; mismo criterio que puso `session-reservation.ts`
 * al lado del concepto homónimo de grupos.
 *
 * ponytail: el union está cerrado en los dos status que este panel ESCRIBE. La tabla
 * `attendance` ya tiene filas con 'confirmo_si' / 'confirmo_no' / 'sin_respuesta' puestas por
 * WhatsApp sobre la misma fila. Techo: si algún día se LEE la asistencia, este union se queda
 * corto. Salida: un `sessionAttendanceStatusLabel()` acá mismo, estilo el
 * `reservationStatusLabel` de session-reservation.ts.
 */
export type SessionAttendanceStatus = 'asistio' | 'ausente';

export interface SessionAttendanceMark {
  readonly reservationId: string;
  readonly status: SessionAttendanceStatus;
}

/**
 * El resultado POR ÍTEM. El endpoint responde 201 con un array aunque la mitad falle: el éxito
 * parcial es un resultado de primera clase, no un borde.
 *
 * `status` viene sólo cuando `ok`; `error` sólo cuando `!ok`. Nunca los dos, nunca ninguno.
 */
export interface SessionAttendanceResult {
  readonly reservationId: string;
  readonly ok: boolean;
  readonly status: SessionAttendanceStatus | null;
  /**
   * El motivo CRUDO del backend. `markBulk` captura CUALQUIER excepción del loop en
   * `err.message`, no sólo las escritas para humanos: además de los tres mensajes de dominio
   * en castellano, por acá pueden salir "Cannot convert X to a BigInt" (mensaje de V8) y
   * "attendance_status 'asistio' no está sembrado — correr prisma:seed" (jerga de infra).
   */
  readonly error: string | null;
}

/** Tope de `@ArrayMaxSize(100)` en `MarkAttendanceBulkDto`. */
const MAX_MARCAS = 100;

/**
 * Las DOS invariantes que el backend valida a nivel DTO, y las únicas: `items` no lleva
 * `@ValidateNested()`, así que el ValidationPipe global —que corre con `whitelist: true` y
 * `forbidNonWhitelisted: true`— no mira dentro del array. Todo lo demás (que la reserva exista,
 * que pertenezca a la clase, que esté `confirmed`, que el status sea válido) se resuelve
 * per-ítem dentro del service y vuelve como `{ ok: false }`, no como un 400.
 */
export function createSessionAttendanceDraft(
  marks: readonly SessionAttendanceMark[],
): readonly SessionAttendanceMark[] {
  if (marks.length === 0) {
    throw new InvalidAttendanceError('Marcá al menos un alumno antes de guardar.');
  }
  if (marks.length > MAX_MARCAS) {
    throw new InvalidAttendanceError(
      `No se pueden guardar más de ${MAX_MARCAS} asistencias de una vez.`,
    );
  }
  return marks;
}
```

- [ ] **Step 5: Correr el test y verificar que PASA**

Run: `npx ng test --include src/app/core/domain/entities/session-attendance.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Correr lint y la suite entera**

Run: `npm run lint` — no puede haber violación de boundaries (la entidad no importa `@angular/*`).
Run: `npm test` — todo verde, nada roto.

- [ ] **Step 7: Formatear y commitear**

```bash
npx prettier --write src/app/core/domain/entities/session-attendance.ts src/app/core/domain/entities/session-attendance.spec.ts src/app/core/domain/errors.ts
git add src/app/core/domain/entities/session-attendance.ts src/app/core/domain/entities/session-attendance.spec.ts src/app/core/domain/errors.ts
git commit -m "feat(domain): entidad SessionAttendance con createSessionAttendanceDraft"
```

---

### Task 2: DTO y mapper

**Files:**
- Modify: `src/app/core/data/dto/class-session.dto.ts` (agregar al final)
- Modify: `src/app/core/data/mappers/class-session.mapper.ts` (agregar al final)
- Modify: `src/app/core/data/mappers/class-session.mapper.spec.ts`

**Interfaces:**
- Consumes: `SessionAttendanceMark`, `SessionAttendanceResult`, `SessionAttendanceStatus` de `@domain/entities/session-attendance`.
- Produces:
  - `AttendanceRequestSchema`, `type AttendanceRequest`
  - `AttendanceResultDtoSchema`, `AttendanceResultListDtoSchema`, `type AttendanceResultDto`
  - `function toAttendanceRequest(marks: readonly SessionAttendanceMark[]): AttendanceRequest`
  - `function toSessionAttendanceResult(dto: AttendanceResultDto): SessionAttendanceResult`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/app/core/data/mappers/class-session.mapper.spec.ts`. Si el archivo todavía no importa `valibot`, sumar `import * as v from 'valibot';` arriba junto al resto de los imports.

```ts
describe('toAttendanceRequest', () => {
  it('arma el body con la forma EXACTA que acepta el DTO del backend', () => {
    // forbidNonWhitelisted: true es global (app.module.ts): una clave de más es un 400 de la
    // llamada entera, no un campo ignorado.
    expect(
      toAttendanceRequest([
        { reservationId: '55', status: 'asistio' },
        { reservationId: '56', status: 'ausente' },
      ]),
    ).toEqual({
      items: [
        { reservationId: '55', status: 'asistio' },
        { reservationId: '56', status: 'ausente' },
      ],
    });
  });
});

describe('toSessionAttendanceResult', () => {
  it('un ítem que salió bien viene SIN `error`', () => {
    expect(toSessionAttendanceResult({ reservationId: '55', ok: true, status: 'asistio' })).toEqual(
      { reservationId: '55', ok: true, status: 'asistio', error: null },
    );
  });

  it('un ítem que falló viene SIN `status`', () => {
    expect(
      toSessionAttendanceResult({
        reservationId: '56',
        ok: false,
        error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
      }),
    ).toEqual({
      reservationId: '56',
      ok: false,
      status: null,
      error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
    });
  });

  it('un status que este panel no conoce queda en null y no se cuela al union', () => {
    // La tabla attendance_status tiene CINCO nombres sembrados. WhatsApp escribe
    // confirmo_si/confirmo_no/sin_respuesta sobre la misma fila que el panel. Un cast a ciegas
    // metería uno de ésos en un tipo que dice que no puede estar.
    expect(
      toSessionAttendanceResult({ reservationId: '57', ok: true, status: 'confirmo_si' }).status,
    ).toBeNull();
  });
});

describe('AttendanceResultListDtoSchema', () => {
  it('tolera el array MIXTO que devuelve el backend', () => {
    // markBulk hace push de dos formas distintas según el desenlace de cada ítem: nunca manda
    // las dos claves juntas, así que las dos tienen que ser opcionales.
    const crudo = [
      { reservationId: '55', ok: true, status: 'asistio' },
      { reservationId: '56', ok: false, error: 'La reserva no pertenece a esta clase' },
    ];
    expect(() => v.parse(AttendanceResultListDtoSchema, crudo)).not.toThrow();
  });
});
```

Sumar a los imports del spec: `toAttendanceRequest` y `toSessionAttendanceResult` desde `./class-session.mapper`, y `AttendanceResultListDtoSchema` desde `../dto/class-session.dto`.

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

Run: `npx ng test --include src/app/core/data/mappers/class-session.mapper.spec.ts`
Expected: FAIL — `toAttendanceRequest is not a function` / el schema no existe.

- [ ] **Step 3: Agregar los schemas al DTO**

Al final de `src/app/core/data/dto/class-session.dto.ts`:

```ts
/**
 * Body de `POST /class-sessions/:id/attendance`. EXACTAMENTE esta forma y nada más: el
 * ValidationPipe global corre con `whitelist: true, forbidNonWhitelisted: true`
 * (app.module.ts), así que una clave de más es un 400 de la llamada entera.
 *
 * `status` va por NOMBRE y no por id: `AttendanceService` busca la fila de `attendance_status`
 * por `name`. No hay catálogo que pedir — `GET /catalogs/*` no expone attendance-statuses.
 */
export const AttendanceRequestSchema = v.object({
  items: v.array(
    v.object({
      reservationId: v.string(),
      status: v.picklist(['asistio', 'ausente']),
    }),
  ),
});
export type AttendanceRequest = v.InferOutput<typeof AttendanceRequestSchema>;

/**
 * Lo que devuelve ese POST: 201 —no 200: `markBulk` no declara `@HttpCode` y rige el default de
 * `@Post()` de Nest— con un array POR ÍTEM, aunque la mitad falle.
 *
 * `status` y `error` son opcionales Y nullables porque el backend manda uno o el otro según el
 * `ok`: el éxito hace push de `{reservationId, ok:true, status}` y el fallo de
 * `{reservationId, ok:false, error}`.
 *
 * `reservationId` vuelve como el string ORIGINAL del request: `markBulk` hace push de
 * `item.reservationId`, no del BigInt que parseó. No hay que re-normalizarlo.
 */
export const AttendanceResultDtoSchema = v.object({
  reservationId: v.string(),
  ok: v.boolean(),
  status: v.optional(v.nullable(v.string())),
  error: v.optional(v.nullable(v.string())),
});
export const AttendanceResultListDtoSchema = v.array(AttendanceResultDtoSchema);
export type AttendanceResultDto = v.InferOutput<typeof AttendanceResultDtoSchema>;
```

- [ ] **Step 4: Agregar los mappers**

Al final de `src/app/core/data/mappers/class-session.mapper.ts`, y sumar a sus imports
`SessionAttendanceMark`, `SessionAttendanceResult` desde `@domain/entities/session-attendance`, y
`AttendanceRequest`, `AttendanceResultDto` desde `../dto/class-session.dto`:

```ts
export function toAttendanceRequest(marks: readonly SessionAttendanceMark[]): AttendanceRequest {
  return { items: marks.map((m) => ({ reservationId: m.reservationId, status: m.status })) };
}

/**
 * `status` se ESTRECHA al union del dominio y queda en null si el backend devuelve cualquier
 * otra cosa. Ver el ponytail de session-attendance.ts: la tabla tiene cinco status posibles y
 * este panel conoce dos.
 */
export function toSessionAttendanceResult(dto: AttendanceResultDto): SessionAttendanceResult {
  return {
    reservationId: dto.reservationId,
    ok: dto.ok,
    status: dto.status === 'asistio' || dto.status === 'ausente' ? dto.status : null,
    error: dto.error ?? null,
  };
}
```

- [ ] **Step 5: Correr los tests y verificar que PASAN**

Run: `npx ng test --include src/app/core/data/mappers/class-session.mapper.spec.ts`
Expected: PASS — los tests que ya había más los 5 nuevos.

- [ ] **Step 6: Correr lint y la suite entera**

Run: `npm run lint` y `npm test`. Todo verde.

- [ ] **Step 7: Formatear y commitear**

```bash
npx prettier --write src/app/core/data/dto/class-session.dto.ts src/app/core/data/mappers/class-session.mapper.ts src/app/core/data/mappers/class-session.mapper.spec.ts
git add src/app/core/data/dto/class-session.dto.ts src/app/core/data/mappers/class-session.mapper.ts src/app/core/data/mappers/class-session.mapper.spec.ts
git commit -m "feat(data): schemas y mappers de la asistencia de clase"
```

---

### Task 3: Contrato, repositorio HTTP y los dobles que rompe

**Files:**
- Modify: `src/app/core/domain/contracts/class-sessions.repository.ts`
- Modify: `src/app/core/data/repositories/http-class-sessions.repository.ts` (agregar el método; corregir el comentario de `cancelDay`)
- Modify: `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
- Modify: `src/app/features/reservas/sesion.facade.spec.ts` (**sólo** el doble)
- Modify: `src/app/features/reservas/components/sesion-modal.component.spec.ts` (**sólo** el doble)

**Interfaces:**
- Consumes: `SessionAttendanceMark`, `SessionAttendanceResult` de `@domain/entities/session-attendance`; `AttendanceRequestSchema`, `AttendanceResultListDtoSchema` del DTO; `toAttendanceRequest`, `toSessionAttendanceResult` del mapper.
- Produces: `ClassSessionsRepository.markAttendance(sessionId: string, marks: readonly SessionAttendanceMark[]): Promise<SessionAttendanceResult[]>`.

**Cuidado:** agregar el método abstracto al contrato **rompe el build de dos specs** con `TS2352` ("Property 'markAttendance' is missing"). Está verificado corriendo `tsc -p tsconfig.spec.json`, no es una suposición. Los dos dobles que rompen son literales casteados directo al contrato:

- `src/app/features/reservas/sesion.facade.spec.ts:31` (`} as ClassSessionsRepository`)
- `src/app/features/reservas/components/sesion-modal.component.spec.ts:86` (el `useValue` inline)

Los otros tres dobles **no** rompen porque hacen spread de un `Partial<ClassSessionsRepository>`, lo que vuelve la propiedad opcional en el tipo del literal: `reservas.facade.spec.ts:20`, `reservas-page.component.spec.ts:33`, `http-dashboard.repository.spec.ts:38`. **No los toques.**

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`:

```ts
describe('HttpClassSessionsRepository.markAttendance', () => {
  it('postea al path de la CLASE con el body exacto que acepta el DTO', async () => {
    const { repo, calls } = setup({ post: of([]) });
    await repo.markAttendance('10', [{ reservationId: '55', status: 'asistio' }]);
    expect(calls[0]).toEqual({
      method: 'post',
      path: '/class-sessions/10/attendance',
      body: { items: [{ reservationId: '55', status: 'asistio' }] },
    });
  });

  it('mapea el array MIXTO: un ítem que entró y uno que falló', async () => {
    const { repo } = setup({
      post: of([
        { reservationId: '55', ok: true, status: 'asistio' },
        {
          reservationId: '56',
          ok: false,
          error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
        },
      ]),
    });
    const res = await repo.markAttendance('10', [
      { reservationId: '55', status: 'asistio' },
      { reservationId: '56', status: 'ausente' },
    ]);
    expect(res).toEqual([
      { reservationId: '55', ok: true, status: 'asistio', error: null },
      {
        reservationId: '56',
        ok: false,
        status: null,
        error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
      },
    ]);
  });

  it('un 403 sale normalizado: el endpoint exige admin, encargado o superprofesor', async () => {
    const { repo } = setup({
      post: throwError(() => new HttpErrorResponse({ status: 403 })),
    });
    await expect(
      repo.markAttendance('10', [{ reservationId: '55', status: 'asistio' }]),
    ).rejects.toEqual({ kind: 'forbidden' });
  });
});
```

`of`, `throwError` y `HttpErrorResponse` ya están importados en ese archivo.

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

Run: `npx ng test --include src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
Expected: FAIL — `repo.markAttendance is not a function`.

- [ ] **Step 3: Agregar el método al contrato**

En `src/app/core/domain/contracts/class-sessions.repository.ts`, después de `reservations()` y antes del bloque de `cancel`/`cancelDay`. Sumar el import de `SessionAttendanceMark` y `SessionAttendanceResult` desde `../entities/session-attendance`:

```ts
  /**
   * Marca la asistencia de VARIAS reservas de una clase, de una sola vez.
   *
   * Vive acá y no en `ReservationsRepository` aunque la asistencia se escriba POR RESERVA y el
   * backend también exponga `POST /reservations/:id/attendance`. `reservations.repository.ts`
   * documenta el criterio contrario —"el contrato se corta por CONCEPTO", que es por lo que
   * `reserve()` vive allá aunque pegue a /class-sessions/:id/reservations— y por concepto esto
   * es de la CLASE: `markBulk` valida que cada reserva pertenezca a ese classSessionId, y la
   * unidad de trabajo del mostrador es "tomar asistencia de esta clase", no "marcar a Rita".
   *
   * ÚNICA escritura del contrato que devuelve algo, y no es un capricho: el backend responde
   * con un resultado POR ÍTEM —el éxito parcial es lo normal, no un borde— y ninguna relectura
   * lo recupera, porque `listReservations` no incluye `attendance`. Ya hay precedente de
   * escrituras que devuelven: `groups.repository.ts` (saveAttendance → snapshot completo) y
   * `schedules.repository.ts` (generateSessions → SessionGenerationResult).
   */
  abstract markAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]>;
```

- [ ] **Step 4: Implementar el POST**

En `src/app/core/data/repositories/http-class-sessions.repository.ts`, después de `reservations()`. Sumar a los imports: `SessionAttendanceMark`, `SessionAttendanceResult` de `@domain/entities/session-attendance`; `AttendanceRequestSchema`, `AttendanceResultListDtoSchema` del DTO; `toAttendanceRequest`, `toSessionAttendanceResult` del mapper.

```ts
  /**
   * Responde 201, no 200: `markBulk` no declara `@HttpCode` y rige el default de `@Post()` de
   * Nest. `HttpClient` lo trata como éxito igual.
   *
   * NO es atómico: `markBulk` itera y hace un upsert por ítem, cada uno con su propio try. Si
   * el ítem 3 de 10 falla, los dos primeros ya están escritos. Reintentar es seguro —el upsert
   * es idempotente y no toca créditos, cupo ni el estado de la reserva—, pero nadie debe
   * asumir un todo-o-nada que no existe.
   */
  async markAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]> {
    try {
      const body = v.parse(AttendanceRequestSchema, toAttendanceRequest(marks));
      const raw = await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${sessionId}/attendance`, body),
      );
      return v.parse(AttendanceResultListDtoSchema, raw).map(toSessionAttendanceResult);
    } catch (err) {
      throw toDomainError(err);
    }
  }
```

- [ ] **Step 5: Corregir el comentario desactualizado de `cancelDay`**

En el mismo archivo, el docblock de `cancelDay()` termina diciendo *"hoy todas las escrituras devuelven void"*. Ya era falso antes de esta entrega (`groups.repository.ts` y `schedules.repository.ts` devuelven valores) y ahora también lo es en este mismo archivo. Reemplazar esa última oración por:

```
   * La respuesta trae `affectedCount` y también se descarta: la pantalla no lo muestra
   * todavía. `markAttendance` es la única escritura de este repositorio que SÍ devuelve algo, y
   * por un motivo que acá no aplica: su resultado por ítem no se puede releer de ningún lado.
```

- [ ] **Step 6: Arreglar los dos dobles que rompe el contrato**

En `src/app/features/reservas/sesion.facade.spec.ts`, dentro del objeto `sessions` (el que termina en `} as ClassSessionsRepository`), agregar como última propiedad antes del cierre:

```ts
    markAttendance: async () => {
      calls.push('markAttendance');
      return [];
    },
```

En `src/app/features/reservas/components/sesion-modal.component.spec.ts`, dentro del `useValue` inline de `ClassSessionsRepository`, agregar:

```ts
          markAttendance: async () => [],
```

Las Tareas 4 y 6 construyen sobre estos dos dobles. **En esta tarea no se escribe ningún test nuevo en esos dos archivos**: sólo se los hace compilar.

- [ ] **Step 7: Correr los tests y verificar que PASAN**

Run: `npx ng test --include src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
Expected: PASS — los que ya había más los 3 nuevos.

- [ ] **Step 8: Correr lint y la suite entera**

Run: `npm run lint` y `npm test`.
Expected: todo verde. Si algún spec falla con `TS2352`/`TS2515` por `markAttendance`, es un doble que faltó: agregale el método, no cambies el contrato.

- [ ] **Step 9: Formatear y commitear**

```bash
npx prettier --write src/app/core/domain/contracts/class-sessions.repository.ts src/app/core/data/repositories/http-class-sessions.repository.ts src/app/core/data/repositories/http-class-sessions.repository.spec.ts src/app/features/reservas/sesion.facade.spec.ts src/app/features/reservas/components/sesion-modal.component.spec.ts
git add src/app/core/domain/contracts/class-sessions.repository.ts src/app/core/data/repositories/http-class-sessions.repository.ts src/app/core/data/repositories/http-class-sessions.repository.spec.ts src/app/features/reservas/sesion.facade.spec.ts src/app/features/reservas/components/sesion-modal.component.spec.ts
git commit -m "feat(data): ClassSessionsRepository.markAttendance"
```

---

### Task 4: `SesionFacade.tomarAsistencia()`

**Files:**
- Modify: `src/app/features/reservas/sesion.facade.ts`
- Modify: `src/app/features/reservas/sesion.facade.spec.ts`

**Interfaces:**
- Consumes: `ClassSessionsRepository.markAttendance(...)` de la Tarea 3; `createSessionAttendanceDraft`, `SessionAttendanceMark`, `SessionAttendanceResult` de la Tarea 1.
- Produces: `SesionFacade.tomarAsistencia(sessionId: string, marks: readonly SessionAttendanceMark[]): Promise<readonly SessionAttendanceResult[] | null>` — `null` significa que falló el POST entero y `error()` lo cuenta.

- [ ] **Step 1: Preparar `setup()` del spec para poder inyectar el resultado**

En `src/app/features/reservas/sesion.facade.spec.ts`, la función `setup()` hoy toma `(over, rows)`. Sumarle un tercer parámetro y usarlo en el doble que la Tarea 3 dejó:

```ts
function setup(
  over: Partial<ReservationsRepository> = {},
  rows: readonly SessionReservation[] = [],
  // Parámetros propios y no un Partial<ClassSessionsRepository>: un override entero perdería el
  // calls.push() del doble, que es justo lo que fija "relee sólo en el parcial".
  asistencia: () => Promise<SessionAttendanceResult[]> = async () => [],
  relecturaFalla = false,
) {
```

y dentro del objeto `sessions`, reemplazar el `markAttendance` que puso la Tarea 3 por:

```ts
    markAttendance: async () => {
      calls.push('markAttendance');
      return asistencia();
    },
```

y hacer que `reservations` pueda fallar, para el test de la relectura del parcial:

```ts
    reservations: async () => {
      calls.push('reservations');
      if (relecturaFalla) throw new Error('la relectura también falló');
      return [...state];
    },
```

Sumar el import: `import { SessionAttendanceResult } from '@domain/entities/session-attendance';`

- [ ] **Step 2: Escribir los tests que fallan**

Agregar al final de `src/app/features/reservas/sesion.facade.spec.ts`:

```ts
describe('SesionFacade.tomarAsistencia', () => {
  const MARCAS = [{ reservationId: '55', status: 'asistio' as const }];
  const OK = { reservationId: '55', ok: true, status: 'asistio' as const, error: null };
  const FALLO = {
    reservationId: '55',
    ok: false,
    status: null,
    error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
  };

  it('devuelve el resultado por ítem y NO relee: la asistencia no cambia el roster', async () => {
    // AttendanceService escribe la tabla `attendance` y nada más: la reserva sigue confirmed,
    // el cupo no cambia, la lista de espera no cambia. Releer sería un GET al pedo que
    // devolvería exactamente lo que ya está en pantalla.
    const { facade, calls } = setup({}, [], async () => [OK]);
    expect(await facade.tomarAsistencia('10', MARCAS)).toEqual([OK]);
    expect(calls).toEqual(['markAttendance']);
  });

  it('con un fallo per-ítem SÍ relee: la fila muerta tiene que salir de la planilla', async () => {
    // El fallo más probable es que la reserva haya dejado de estar `confirmed` entre la carga
    // del roster y el Guardar. Ésa no va a entrar nunca, por más que se reintente.
    const { facade, calls } = setup({}, [], async () => [FALLO]);
    expect(await facade.tomarAsistencia('10', MARCAS)).toEqual([FALLO]);
    expect(calls).toEqual(['markAttendance', 'reservations']);
  });

  it('si la relectura del parcial falla, NO pisa el resultado ni ensucia error()', async () => {
    // La relectura es una comodidad, no la operación: su fallo es de segundo orden y taparía el
    // bloque de fallidos, que es el que cuenta el problema real.
    const { facade } = setup({}, [], async () => [FALLO], true);
    const res = await facade.tomarAsistencia('10', MARCAS);
    expect(res).toEqual([FALLO]);
    expect(facade.error()).toBeNull();
  });

  it('devuelve null y deja el error cuando falla el POST ENTERO', async () => {
    const { facade } = setup({}, [], async () => {
      throw { kind: 'forbidden' };
    });
    expect(await facade.tomarAsistencia('10', MARCAS)).toBeNull();
    expect(facade.error()).toEqual({ kind: 'forbidden' });
  });

  it('sin marcas NO llama al repo y deja el error de dominio', async () => {
    const { facade, calls } = setup();
    expect(await facade.tomarAsistencia('10', [])).toBeNull();
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({
      kind: 'domain',
      message: 'Marcá al menos un alumno antes de guardar.',
    });
  });

  it('deja loading en false al terminar, pase lo que pase', async () => {
    const { facade } = setup({}, [], async () => {
      throw new Error('boom');
    });
    await facade.tomarAsistencia('10', MARCAS);
    expect(facade.loading()).toBe(false);
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que FALLAN**

Run: `npx ng test --include src/app/features/reservas/sesion.facade.spec.ts`
Expected: FAIL — `facade.tomarAsistencia is not a function`.

- [ ] **Step 4: Escribir el método en la facade**

En `src/app/features/reservas/sesion.facade.ts`, después de `cobrar()`. Sumar a los imports:

```ts
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  createSessionAttendanceDraft,
} from '@domain/entities/session-attendance';
```

```ts
  /**
   * Marca la asistencia de la clase abierta. Devuelve el resultado POR ÍTEM, o `null` si falló
   * el POST entero.
   *
   * NO usa run(), y es a propósito: `run()` devuelve `Promise<void>` y publica en la tríada, así
   * que un valor de retorno tendría que salir por una variable de closure y el `[]` del catch
   * quedaría indistinguible de "salió todo bien". El patrón del repo para una escritura que
   * devuelve algo es setLoading/setError a mano con un centinela explícito —`signal-store.base.ts`
   * documenta `setLoading` justamente para "los flujos que NO caben en run()"— y el análogo
   * exacto es `HorariosFacade.generate()`: otra escritura cuyo resultado por ítem ninguna
   * relectura recupera.
   *
   * `createSessionAttendanceDraft` se llama DERECHO, sin el `Promise.resolve().then()` que usan
   * `reservar()` y `cobrar()`: ésos lo necesitan porque su try/catch vive dentro de run(), en
   * otro método; acá está en esta misma función, así que el throw síncrono ya cae donde tiene
   * que caer.
   *
   * NO RELEE cuando sale todo bien: `AttendanceService` escribe la tabla `attendance` y nada más
   * —la reserva sigue confirmed, el cupo no cambia, la lista de espera no cambia—, así que una
   * relectura devolvería exactamente lo que ya está en pantalla.
   */
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
        // El fallo más probable es que la reserva haya dejado de estar `confirmed` entre la
        // carga del roster y el Guardar: se confirmó un hold y el roster se releyó, o el alumno
        // canceló por WhatsApp. Esa fila no va a entrar por más que se reintente, y la
        // relectura la saca de la planilla dejando en pantalla exactamente lo reintentable.
        //
        // Su fallo se TRAGA: la planilla queda como está y el bloque de fallidos ya cuenta el
        // problema real. Un error acá lo taparía con uno de segundo orden.
        try {
          await this.loadReservations(sessionId);
        } catch {
          /* ver arriba */
        }
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

- [ ] **Step 5: Correr los tests y verificar que PASAN**

Run: `npx ng test --include src/app/features/reservas/sesion.facade.spec.ts`
Expected: PASS — los que ya había más los 6 nuevos.

- [ ] **Step 6: Correr lint y la suite entera**

Run: `npm run lint` y `npm test`. Todo verde.

- [ ] **Step 7: Formatear y commitear**

```bash
npx prettier --write src/app/features/reservas/sesion.facade.ts src/app/features/reservas/sesion.facade.spec.ts
git add src/app/features/reservas/sesion.facade.ts src/app/features/reservas/sesion.facade.spec.ts
git commit -m "feat(reservas): SesionFacade.tomarAsistencia() sin run() y sin relectura"
```

---

### Task 5: El componente de la planilla

**Files:**
- Create: `src/app/features/reservas/components/asistencia-seccion.component.ts`
- Create: `src/app/features/reservas/components/asistencia-seccion.component.css`
- Create: `src/app/features/reservas/components/asistencia-seccion.component.spec.ts`

**Interfaces:**
- Consumes: `SessionReservation` de `@domain/entities/session-reservation`; `SessionAttendanceMark`, `SessionAttendanceResult`, `SessionAttendanceStatus` de la Tarea 1.
- Produces: `AsistenciaSeccionComponent`, selector `app-asistencia-seccion`, con
  - inputs `reservas: readonly SessionReservation[]` (el roster **completo**), `nombres: ReadonlyMap<string, string>`, `saving: boolean`
  - output `guardar: readonly SessionAttendanceMark[]`
  - métodos públicos `reset(): void` y `resultado(results: readonly SessionAttendanceResult[] | null, error: string): void`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/app/features/reservas/components/asistencia-seccion.component.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AsistenciaSeccionComponent } from './asistencia-seccion.component';
import { SessionReservation } from '@domain/entities/session-reservation';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';

const fila = (id: string, studentId: string, status: string): SessionReservation => ({
  id,
  studentId,
  studentPlanId: null,
  status,
  holdExpiresAt: null,
});

const NOMBRES = new Map([
  ['4', 'Rita Pérez'],
  ['7', 'Juan Gómez'],
]);

function mount(rows: readonly SessionReservation[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(AsistenciaSeccionComponent);
  fixture.componentRef.setInput('reservas', rows);
  fixture.componentRef.setInput('nombres', NOMBRES);
  fixture.detectChanges();
  const emitidas: (readonly SessionAttendanceMark[])[] = [];
  fixture.componentInstance.guardar.subscribe((m) => emitidas.push(m));
  return { fixture, el: fixture.nativeElement as HTMLElement, emitidas };
}

/** Los botones de una fila, en orden: [Presente, Ausente]. */
function botones(el: HTMLElement, i: number): HTMLButtonElement[] {
  const filas = el.querySelectorAll('.att-row');
  return Array.from(filas[i].querySelectorAll('button'));
}

function click(el: HTMLElement, selector: string): void {
  el.querySelector<HTMLButtonElement>(selector)!.click();
}

describe('AsistenciaSeccionComponent', () => {
  it('no se renderiza si no hay ninguna reserva confirmada', () => {
    const { el } = mount([fila('55', '4', 'held')]);
    expect(el.querySelector('h4')).toBeNull();
  });

  it('lista sólo las confirmadas: los held y pending_review viven en Anotados', () => {
    const { el } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'held'),
      fila('57', '7', 'pending_review'),
    ]);
    expect(el.querySelectorAll('.att-row')).toHaveLength(1);
    expect(el.textContent).toContain('Rita Pérez');
  });

  it('muestra el hint cuando hay filas que no se pueden marcar', () => {
    const { el } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'held')]);
    expect(el.textContent).toContain('Sólo se puede marcar la asistencia de las reservas');
  });

  it('sin filas pendientes NO muestra el hint: no habría nada que explicar', () => {
    const { el } = mount([fila('55', '4', 'confirmed')]);
    expect(el.textContent).not.toContain('Sólo se puede marcar la asistencia');
  });

  it('Guardar está deshabilitado hasta que se marque algo', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    const guardar = el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!;
    expect(guardar.disabled).toBe(true);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    expect(guardar.disabled).toBe(false);
  });

  it('«Vinieron todos» marca a todas las confirmadas como presentes', () => {
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    click(el, '[data-test="todos"]');
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([
      { reservationId: '55', status: 'asistio' },
      { reservationId: '56', status: 'asistio' },
    ]);
  });

  it('emite sólo las filas marcadas, no las que quedaron en blanco', () => {
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    botones(el, 1)[1].click(); // Juan → Ausente
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([{ reservationId: '56', status: 'ausente' }]);
  });

  it('DESCARTA la marca huérfana: la reserva que dejó de estar confirmada no viaja', () => {
    // Es el borde que se lleva la entrega si el body se arma desde las marcas en vez del
    // roster. Entre marcar y guardar el alumno puede cancelar por WhatsApp; esa marca volvería
    // como fallo per-ítem que NUNCA va a entrar, y como el parcial no limpia la planilla, el
    // reintento fallaría para siempre.
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    botones(el, 0)[0].click();
    botones(el, 1)[0].click();
    fixture.detectChanges();
    fixture.componentRef.setInput('reservas', [
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'cancelled'),
    ]);
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([{ reservationId: '55', status: 'asistio' }]);
  });

  it('resultado() con todo OK limpia la planilla y resume lo guardado', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [
        { reservationId: '55', ok: true, status: 'asistio', error: null },
        { reservationId: '56', ok: true, status: 'ausente', error: null },
      ],
      '',
    );
    fixture.detectChanges();
    expect(el.textContent).toContain('Asistencia guardada: 1 presente, 1 ausente.');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('resultado() parcial NO limpia y agrupa los fallidos por mensaje', () => {
    // Si el error es sistémico sale en todas las filas: una línea, no seis.
    const { el, fixture } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [
        { reservationId: '55', ok: false, status: null, error: 'La reserva no pertenece a esta clase' },
        { reservationId: '56', ok: false, status: null, error: 'La reserva no pertenece a esta clase' },
      ],
      '',
    );
    fixture.detectChanges();
    const alertas = Array.from(el.querySelectorAll('[role="alert"]'));
    expect(alertas).toHaveLength(1);
    expect(alertas[0].textContent).toContain('Rita Pérez, Juan Gómez');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('resultado(null) pinta el error del POST entero al lado del botón y no limpia', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    expect(el.textContent).toContain('No tenés permisos para hacer esto.');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('resultado() borra lo del guardado anterior antes de mostrar lo nuevo', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [{ reservationId: '55', ok: true, status: 'asistio', error: null }],
      '',
    );
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No tenés permisos');
    expect(el.textContent).toContain('Asistencia guardada: 1 presente.');
  });

  it('reset() deja todo en blanco: es lo que llama open() del modal', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    fixture.componentInstance.reset();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No tenés permisos');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.disabled).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

Run: `npx ng test --include src/app/features/reservas/components/asistencia-seccion.component.spec.ts`
Expected: FAIL — el módulo `./asistencia-seccion.component` no existe.

- [ ] **Step 3: Escribir el componente**

Crear `src/app/features/reservas/components/asistencia-seccion.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SessionReservation } from '@domain/entities/session-reservation';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  SessionAttendanceStatus,
} from '@domain/entities/session-attendance';

/** «Asistencia guardada: 5 presentes, 1 ausente.» Sólo nombra lo que hay. */
function resumenDe(results: readonly SessionAttendanceResult[]): string {
  const presentes = results.filter((r) => r.status === 'asistio').length;
  const ausentes = results.filter((r) => r.status === 'ausente').length;
  const partes = [
    ...(presentes ? [`${presentes} ${presentes === 1 ? 'presente' : 'presentes'}`] : []),
    ...(ausentes ? [`${ausentes} ${ausentes === 1 ? 'ausente' : 'ausentes'}`] : []),
  ];
  return partes.length ? `Asistencia guardada: ${partes.join(', ')}.` : 'Asistencia guardada.';
}

/**
 * La planilla de asistencia de UNA clase.
 *
 * COMPONENTE TONTO: no toca la facade, emite las marcas y espera que el padre le informe el
 * desenlace por `resultado()`. Mismo contrato que AttendanceModalComponent de features/grupos,
 * cuyo comentario dice literal que "el modal NO toca la facade: la página cablea y le informa
 * el desenlace".
 *
 * Vive afuera de SesionModalComponent por dos razones del repo: ese archivo ya tiene 424 líneas
 * con el template inline y es el más grande que hay, y su spec monta la facade REAL con dobles
 * de cinco repositorios, así que cualquier test nuevo adentro paga ese costo de entrada.
 *
 * Recibe el roster COMPLETO y filtra acá: es este componente el que sabe que sólo las reservas
 * `confirmed` se pueden marcar —`AttendanceService` rechaza cualquier otra— y el que tiene que
 * explicarlo con el hint.
 */
@Component({
  selector: 'app-asistencia-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './asistencia-seccion.component.css',
  template: `
    @if (confirmadas().length) {
      <h4>Asistencia</h4>

      @if (hayPendientes()) {
        <p class="hint">
          Sólo se puede marcar la asistencia de las reservas confirmadas. Si falta alguien,
          confirmá su reserva primero.
        </p>
      }

      @if (errorGlobal()) {
        <p class="notice hold" role="alert">{{ errorGlobal() }}</p>
      }

      @for (f of fallosAgrupados(); track f.mensaje) {
        <p class="notice hold" role="alert">{{ f.nombres }}: {{ f.mensaje }}</p>
      }

      <div class="att-list">
        @for (r of confirmadas(); track r.id) {
          <div class="att-row">
            <div class="att-who">{{ nombre(r.studentId) }}</div>
            <div
              class="segpick"
              role="group"
              [attr.aria-label]="'Asistencia de ' + nombre(r.studentId)"
            >
              <button
                type="button"
                class="segp"
                [class.on-p]="marcaDe(r.id) === 'asistio'"
                [attr.aria-pressed]="marcaDe(r.id) === 'asistio'"
                (click)="marcar(r.id, 'asistio')"
              >
                Presente
              </button>
              <button
                type="button"
                class="segp"
                [class.on-a]="marcaDe(r.id) === 'ausente'"
                [attr.aria-pressed]="marcaDe(r.id) === 'ausente'"
                (click)="marcar(r.id, 'ausente')"
              >
                Ausente
              </button>
            </div>
          </div>
        }
      </div>

      <div class="att-actions">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          data-test="todos"
          [disabled]="saving()"
          (click)="vinieronTodos()"
        >
          Vinieron todos
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="guardar-asistencia"
          [disabled]="saving() || !hayMarcas()"
          (click)="onGuardar()"
        >
          Guardar asistencia
        </button>
      </div>

      @if (resumen()) {
        <p class="hint" role="status">{{ resumen() }}</p>
      }
    }
  `,
})
export class AsistenciaSeccionComponent {
  /** El roster COMPLETO de la clase. El filtro por estado es responsabilidad de este componente. */
  readonly reservas = input.required<readonly SessionReservation[]>();
  /**
   * studentId → nombre. Un Map y no una función: el modal ya tiene ese `computed`
   * (`studentNames`) y pasarle un método perdería el `this`.
   */
  readonly nombres = input.required<ReadonlyMap<string, string>>();
  readonly saving = input(false);
  readonly guardar = output<readonly SessionAttendanceMark[]>();

  /**
   * Record y NO Map: con OnPush + zoneless un `map.set()` in-place no notifica y la fila no
   * repinta. Mismo patrón que attendance-modal.component.ts, que usa
   * `signal<Record<string, boolean>>({})` con `update()` y spread.
   */
  private readonly marcas = signal<Record<string, SessionAttendanceStatus>>({});
  private readonly fallos = signal<readonly SessionAttendanceResult[]>([]);
  protected readonly resumen = signal('');
  protected readonly errorGlobal = signal('');

  protected readonly confirmadas = computed(() =>
    this.reservas().filter((r) => r.status === 'confirmed'),
  );

  /**
   * Anotados puede mostrar seis filas y esta planilla cuatro: los `held` vigentes y los
   * `pending_review` —el anotado por WhatsApp sin plan, que el comentario de `anotados()`
   * describe como real y frecuente— aparecen allá y no acá. El hint explica la diferencia.
   *
   * Los `cancelled` y `expired` no cuentan: tampoco están en Anotados, así que su ausencia acá
   * no sorprende a nadie.
   */
  protected readonly hayPendientes = computed(() =>
    this.reservas().some((r) => r.status === 'held' || r.status === 'pending_review'),
  );

  /**
   * Agrupado por MENSAJE, no una línea por alumno: `markBulk` corre el mismo camino para las N
   * filas, así que un error sistémico —el `attendance_status` sin sembrar, por ejemplo— sale en
   * todas a la vez y sin agrupar sería un muro de texto idéntico.
   */
  protected readonly fallosAgrupados = computed(() => {
    const porMensaje = new Map<string, string[]>();
    const nombreDe = new Map(this.reservas().map((r) => [r.id, this.nombre(r.studentId)]));
    for (const f of this.fallos()) {
      const mensaje = f.error ?? 'No se pudo guardar.';
      const quien = nombreDe.get(f.reservationId) ?? `Reserva #${f.reservationId}`;
      porMensaje.set(mensaje, [...(porMensaje.get(mensaje) ?? []), quien]);
    }
    return [...porMensaje].map(([mensaje, nombres]) => ({ mensaje, nombres: nombres.join(', ') }));
  });

  protected readonly hayMarcas = computed(() =>
    this.confirmadas().some((r) => this.marcas()[r.id] !== undefined),
  );

  /** Lo llama `open()` del modal: la planilla no recuerda nada entre aperturas. */
  reset(): void {
    this.marcas.set({});
    this.fallos.set([]);
    this.resumen.set('');
    this.errorGlobal.set('');
  }

  /**
   * El padre informa el desenlace. Limpia SIEMPRE lo del guardado anterior antes de mostrar lo
   * nuevo: si no, el resultado viejo queda al lado del nuevo y los dos se leen como si fueran el
   * mismo guardado.
   */
  resultado(results: readonly SessionAttendanceResult[] | null, error: string): void {
    this.fallos.set([]);
    this.resumen.set('');
    this.errorGlobal.set('');
    if (results === null) {
      this.errorGlobal.set(error);
      return;
    }
    const fallidos = results.filter((r) => !r.ok);
    if (fallidos.length) {
      // La planilla NO se limpia: es donde se corrige y se reintenta.
      this.fallos.set(fallidos);
      return;
    }
    this.marcas.set({});
    this.resumen.set(resumenDe(results));
  }

  protected nombre(studentId: string): string {
    return this.nombres().get(studentId) ?? `Alumno #${studentId}`;
  }

  protected marcaDe(reservationId: string): SessionAttendanceStatus | undefined {
    return this.marcas()[reservationId];
  }

  protected marcar(reservationId: string, status: SessionAttendanceStatus): void {
    this.marcas.update((m) => ({ ...m, [reservationId]: status }));
  }

  protected vinieronTodos(): void {
    this.marcas.update((m) => ({
      ...m,
      ...Object.fromEntries(this.confirmadas().map((r) => [r.id, 'asistio' as const])),
    }));
  }

  /**
   * El body se arma desde `confirmadas()` y NO desde `marcas()`: entre marcar y guardar una
   * reserva puede dejar de estar `confirmed` —se confirmó un hold y el roster se releyó, o el
   * alumno canceló por WhatsApp— y esa marca huérfana viajaría igual, volvería como fallo
   * per-ítem, y como el parcial no limpia la planilla el reintento fallaría PARA SIEMPRE. Mismo
   * criterio que el `markList` de attendance-modal.component.ts.
   *
   * Sin guard de doble-submit acá: el freno vive en `conSesion()` del modal, que consulta
   * `facade.loading()` —estado propio del padre, seteado de forma síncrona antes del await— y no
   * un input, que en zoneless podría no haber propagado entre dos clicks seguidos. El
   * `[disabled]` del template es el segundo freno.
   */
  protected onGuardar(): void {
    const marks = this.confirmadas()
      .map((r) => ({ reservationId: r.id, status: this.marcas()[r.id] }))
      .filter((m): m is SessionAttendanceMark => m.status !== undefined);
    if (!marks.length) return;
    this.guardar.emit(marks);
  }
}
```

- [ ] **Step 4: Escribir los estilos**

Crear `src/app/features/reservas/components/asistencia-seccion.component.css`:

```css
/* Planilla de asistencia. Feature-local y encapsulado.

   ponytail: .att-list/.att-row/.att-who/.segpick/.segp están DUPLICADOS de
   features/grupos/components/attendance-modal.component.css. Con dos consumidores ya cumplen la
   regla de admisión de components.css ("vocabulario del DS, con un consumidor real"), pero
   promoverlos obliga a sacarlos del css de Grupos —una maqueta que este slice no toca— y a
   arriesgar una regresión visual ahí para no ganar nada hoy. Techo: una tercera pantalla con
   segmented picker. Salida: mover .segpick/.segp a styles/components.css y borrar las dos copias.

   .hint también se define acá: en components.css sólo existe como `.field .hint`, y esta no vive
   dentro de un .field. */

.hint { font-size: var(--text-xs); color: var(--color-fg-subtle); margin-top: var(--space-xs); }

.att-list { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin: var(--space-sm) 0 var(--space-md); }
.att-row { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm); flex-wrap: wrap; }
.att-row + .att-row { border-top: 1px solid var(--color-border); }
.att-who { flex: 1; font-weight: 600; font-size: var(--text-sm); min-width: 0; }

.segpick { display: flex; background: var(--color-muted); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); padding: 2px; flex: 0 0 auto; }
.segp { font-size: var(--text-xs); font-weight: 600; padding: var(--space-sm); border-radius: var(--radius-sm); color: var(--color-fg-muted); cursor: pointer; transition: background var(--duration) var(--ease), color var(--duration) var(--ease); }
.segp.on-p { background: var(--color-accent-strong); color: #fff; }
.segp.on-a { background: var(--color-destructive); color: #fff; }

.att-actions { display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; }

@media (pointer: coarse) {
  .segp { min-height: 44px; }
}
```

- [ ] **Step 5: Correr los tests y verificar que PASAN**

Run: `npx ng test --include src/app/features/reservas/components/asistencia-seccion.component.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Correr lint y la suite entera**

Run: `npm run lint` — atención a `@angular-eslint/template/*`: no hay `autofocus` acá, así que no debería saltar nada.
Run: `npm test`. Todo verde.

- [ ] **Step 7: Formatear y commitear**

```bash
npx prettier --write src/app/features/reservas/components/asistencia-seccion.component.ts src/app/features/reservas/components/asistencia-seccion.component.spec.ts
git add src/app/features/reservas/components/asistencia-seccion.component.ts src/app/features/reservas/components/asistencia-seccion.component.css src/app/features/reservas/components/asistencia-seccion.component.spec.ts
git commit -m "feat(reservas): componente de la planilla de asistencia"
```

---

### Task 6: Cablear la sección en el modal de clase

**Files:**
- Modify: `src/app/features/reservas/components/sesion-modal.component.ts`
- Modify: `src/app/features/reservas/components/sesion-modal.component.spec.ts`

**Interfaces:**
- Consumes: `AsistenciaSeccionComponent` de la Tarea 5 (`reset()`, `resultado(results, error)`, output `guardar`); `SesionFacade.tomarAsistencia()` de la Tarea 4; `SessionAttendanceMark` de la Tarea 1.
- Produces: nada que consuma otra tarea. Es la última.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/features/reservas/components/sesion-modal.component.spec.ts`, primero **reemplazar** el `markAttendance: async () => []` que dejó la Tarea 3 en el doble de `ClassSessionsRepository` por una versión que registre y sea configurable. Extender la firma de `mount()`:

```ts
function mount(
  over: { holdExpiresAt?: string } = {},
  rows: readonly SessionReservation[] = [],
  asistencia: () => Promise<SessionAttendanceResult[]> = async () => [],
) {
```

y en el `useValue` de `ClassSessionsRepository`, en lugar del `markAttendance` de la Tarea 3:

```ts
          markAttendance: async (_id: string, marks: readonly SessionAttendanceMark[]) => {
            calls.push(`markAttendance:${marks.map((m) => m.reservationId + '=' + m.status).join(',')}`);
            return asistencia();
          },
```

Sumar los imports `SessionAttendanceMark` y `SessionAttendanceResult` desde `@domain/entities/session-attendance`.

Después, agregar al final del archivo:

```ts
describe('SesionModalComponent · Asistencia', () => {
  const confirmada = (id: string, studentId: string): SessionReservation => ({
    id,
    studentId,
    studentPlanId: null,
    status: 'confirmed',
    holdExpiresAt: null,
  });

  it('la sección se cablea con el roster y manda lo marcado', async () => {
    const { fixture, el, calls } = mount({}, [confirmada('55', '4')]);
    await abrir(fixture);
    el.querySelectorAll<HTMLButtonElement>('.att-row button')[0].click(); // Presente
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.click();
    await settle(fixture);
    expect(calls).toContain('markAttendance:55=asistio');
  });

  it('el éxito deja el resumen en pantalla', async () => {
    const { fixture, el } = mount({}, [confirmada('55', '4')], async () => [
      { reservationId: '55', ok: true, status: 'asistio', error: null },
    ]);
    await abrir(fixture);
    el.querySelectorAll<HTMLButtonElement>('.att-row button')[0].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.click();
    await settle(fixture);
    expect(el.textContent).toContain('Asistencia guardada: 1 presente.');
  });

  it('un 403 se pinta DENTRO de la sección, al lado del botón que se apretó', async () => {
    // El .modal-body scrollea y el errorText() de arriba queda fuera de la vista con cinco
    // secciones por encima.
    const { fixture, el } = mount({}, [confirmada('55', '4')], async () => {
      throw { kind: 'forbidden' };
    });
    await abrir(fixture);
    el.querySelectorAll<HTMLButtonElement>('.att-row button')[0].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.click();
    await settle(fixture);
    const seccion = el.querySelector('app-asistencia-seccion')!;
    expect(seccion.textContent).toContain('No tenés permisos');
  });

  it('reabrir la clase deja la planilla en blanco: la asistencia no se recuerda', async () => {
    const { fixture, el } = mount({}, [confirmada('55', '4')]);
    await abrir(fixture);
    el.querySelectorAll<HTMLButtonElement>('.att-row button')[0].click();
    fixture.detectChanges();
    await abrir(fixture);
    expect(
      el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.disabled,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

Run: `npx ng test --include src/app/features/reservas/components/sesion-modal.component.spec.ts`
Expected: FAIL — no existe `app-asistencia-seccion` en el DOM y `[data-test="guardar-asistencia"]` es `null`.

- [ ] **Step 3: Cablear el componente en el modal**

En `src/app/features/reservas/components/sesion-modal.component.ts`:

1. Sumar a los imports del archivo:

```ts
import { AsistenciaSeccionComponent } from './asistencia-seccion.component';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';
```

2. Sumar `AsistenciaSeccionComponent` al array `imports` del decorador.

3. En el template, **entre** el `@empty` de la sección *Anotados* y el `<h4>Pendientes de confirmar</h4>`:

```html
      <app-asistencia-seccion
        [reservas]="rosterActual()"
        [nombres]="studentNames()"
        [saving]="facade.loading()"
        (guardar)="onAsistencia($event)"
      />
```

4. Dos ajustes de visibilidad para que el template pueda pasar los inputs:

   - `studentNames` hoy se declara `private readonly`. Cambiarlo a `protected readonly` — es la
     única modificación de esa línea; el `computed` no se toca.
   - Agregar el roster como `computed` y no llamar al método en el binding: `reservationsOf()`
     se evaluaría en cada ciclo de detección.

```ts
  /** El roster de la clase abierta. Lo mismo que leen anotados() y holds(). */
  protected readonly rosterActual = computed(() =>
    this.facade.reservationsOf(this.session()?.id ?? ''),
  );
```

5. Sumar el `viewChild`, junto a los dos que ya hay:

```ts
  private readonly asistencia = viewChild.required(AsistenciaSeccionComponent);
```

6. En `open()`, después de `this.cerrarCobro();`:

```ts
    this.asistencia().reset();
```

7. El handler, junto a los otros cinco, **pasando por `conSesion()`**:

```ts
  /**
   * Pasa por conSesion() como los otros cinco: su docstring dice que el freno "se arregla en
   * cuatro lugares y se olvida en el quinto", y éste es el sexto. Acá el doble submit es
   * inofensivo —el endpoint es un upsert— pero el segundo run() limpiaría el error y los
   * fallidos del primero.
   *
   * El error del POST entero se le pasa a la sección para que lo pinte al lado del botón: el
   * errorText() de arriba del modal queda fuera de la vista con cinco secciones por encima y
   * un .modal-body que scrollea.
   */
  protected onAsistencia(marks: readonly SessionAttendanceMark[]): void {
    this.conSesion(async (sessionId) => {
      const results = await this.facade.tomarAsistencia(sessionId, marks);
      this.asistencia().resultado(results, this.errorText());
    });
  }
```

- [ ] **Step 4: Corregir el comentario desactualizado del `setInterval`**

En el constructor del mismo archivo, el comentario dice *"Sólo tickea si hay un hold que contar"*.
`holdsOf()` filtra sólo por `status === 'held'`, así que también tickea con holds **vencidos**.
Reemplazar esa primera oración por:

```
    // Sólo tickea si hay alguna reserva en `held` — vencidas incluidas, porque holdsOf() filtra
    // por estado y no por vencimiento, y la fila vencida sigue mostrando "Venció" en Pendientes.
```

- [ ] **Step 5: Correr los tests y verificar que PASAN**

Run: `npx ng test --include src/app/features/reservas/components/sesion-modal.component.spec.ts`
Expected: PASS — los que ya había más los 4 nuevos.

Si algún test viejo de *Anotados* falla, mirá el helper `seccion()` del archivo: junta
`h4, .arow, .a-empty` y corta en el siguiente `<h4>`. El `<h4>Asistencia</h4>` nuevo pasa a ser
ese corte, lo cual es correcto — las filas de la planilla no son `.arow`, así que no se cuelan.

- [ ] **Step 6: Correr lint y la suite entera**

Run: `npm run lint` y `npm test`. Todo verde.

- [ ] **Step 7: Formatear y commitear**

**No** correr prettier sobre `sesion-modal.component.ts`: tiene un `eslint-disable-next-line`
para `@angular-eslint/template/no-autofocus` sobre un `<select>` largo, y reformatear puede mover
el atributo `autofocus` a otra línea, con lo que la supresión deja de aplicar **en silencio**.
Formatear a mano lo que se agregó, respetando `printWidth: 100`.

```bash
npx prettier --write src/app/features/reservas/components/sesion-modal.component.spec.ts
git add src/app/features/reservas/components/sesion-modal.component.ts src/app/features/reservas/components/sesion-modal.component.spec.ts
git commit -m "feat(reservas): planilla de asistencia en el modal de clase"
```

---

## Verificación final

- [ ] `npm test` — toda la suite verde.
- [ ] `npm run lint` — sin errores de boundaries ni de template.
- [ ] Repaso manual contra el spec: la sección aparece sólo con confirmadas, el hint sale cuando hay `held`, «Vinieron todos» llena la planilla, el éxito la limpia y resume, el parcial la deja y agrupa por mensaje, y reabrir la clase la deja en blanco.
