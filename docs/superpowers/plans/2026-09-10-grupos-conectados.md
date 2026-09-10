# Grupos y clases conectados — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la semilla en memoria de `/grupos` por datos reales, derivando el grupo de `ScheduleTemplate` y su roster de las reservas de la próxima sesión programada, sin tocar `pipofy-backend`.

**Architecture:** `GroupsRepository` queda en un solo método, `listGroups()`. `HttpGroupsRepository` **compone** repositorios que ya existen —`SchedulesRepository`, `ClassSessionsRepository`, `CourtsRepository`, `CoachesRepository`, `CategoryGroupsRepository`— igual que `HttpDashboardRepository`, y la derivación vive en `groups.mapper.ts` como función pura. Roster, lista de espera y escritura de asistencia salen directo de `ClassSessionsRepository`, que ya los tiene. No hay endpoints nuevos: los únicos dos cambios de DTO declaran campos que el backend **ya manda** y valibot venía descartando.

**Tech Stack:** Angular 20 standalone + zoneless + signals · valibot en el borde HTTP · Vitest + TestBed + jsdom · `eslint-plugin-boundaries`.

**Spec:** `docs/superpowers/specs/2026-09-10-grupos-conectados-design.md`

## Global Constraints

- **Capas (error de lint, no convención):** `domain` sólo ve `domain` y **no puede importar `@angular/*`** · `data` ve `domain` y `data` · `shared` sólo ve `shared` · `features/<x>` ve `domain`, `data`, `shared`, **nunca otra feature**. Usar siempre los alias (`@domain/*`, `@data/*`, `@shared/*`, `@features/*`), no rutas relativas largas.
- **Idioma:** comentarios, copy de UI y nombres de feature/rutas en **español**; `core/` en **inglés**.
- **Angular:** `ChangeDetectionStrategy.OnPush`, `inject()`, `signal`/`computed`. Nada de NgModules, Zone.js ni RxJS en las facades (`firstValueFrom` en los repos).
- **Tests:** todo `TestBed` lleva `provideZonelessChangeDetection()`. **No hay librería de mocks**: los dobles son objetos planos casteados al contrato (`as unknown as XRepository`), típicamente con un array `calls`.
- **Prettier:** `printWidth: 100`, `singleQuote: true`.
- **Ids:** la API los manda **siempre como string**; fechas en **ISO**. La lógica de fecha local vive en `@domain/local-date`.
- **Simplificaciones deliberadas** se marcan con un comentario `ponytail:` que nombra **el techo y la salida**.
- **Verificación por tarea:** `npm test` y `npm run lint` en verde antes de commitear. `npm run lint` es el que ataja las violaciones de capa.

---

## Mapa de archivos

**Tarea 1 — la ventana de sesiones**
- Modificar: `src/app/core/domain/local-date.ts` (gana `shiftDateKey`)
- Modificar: `src/app/core/domain/entities/class-session.ts` (gana `scheduleTemplateId`)
- Modificar: `src/app/core/domain/contracts/class-sessions.repository.ts` (gana `listRange`)
- Modificar: `src/app/core/data/dto/class-session.dto.ts` (declara `scheduleTemplateId`)
- Modificar: `src/app/core/data/mappers/class-session.mapper.ts`
- Modificar: `src/app/core/data/repositories/http-class-sessions.repository.ts` (implementa `listRange`, borra su `shiftDay` privado)
- Test: `local-date.spec.ts`, `http-class-sessions.repository.spec.ts`

**Tarea 2 — el nombre del alumno sin padrón**
- Modificar: `src/app/core/data/dto/class-session.dto.ts` (declara `student`)
- Modificar: `src/app/core/domain/entities/session-reservation.ts` (gana `studentName`, `studentCategoryId`)
- Modificar: `src/app/core/data/mappers/class-session.mapper.ts`
- Modificar: `src/app/features/reservas/**` — sólo los fixtures de los specs, que dejan de compilar
- Test: `class-session.mapper.spec.ts`

**Tarea 3 — el helper de días**
- Crear: `src/app/shared/weekday-label.ts` (movido)
- Crear: `src/app/shared/weekday-label.spec.ts` (movido)
- Borrar: `src/app/features/configuracion/horarios/weekday-label.ts` y su spec
- Modificar: los importadores en `features/configuracion/horarios/`

**Tarea 4 — el swap del slice**
- Reescribir: `src/app/core/domain/entities/group.ts`
- Reescribir: `src/app/core/domain/contracts/groups.repository.ts`
- Reescribir: `src/app/core/data/mappers/groups.mapper.ts` (+ su spec)
- Crear: `src/app/core/data/repositories/http-groups.repository.ts` (+ spec)
- Borrar: `groups.seed.ts`, `in-memory-groups.repository.ts` (+ spec), `core/domain/use-cases/apply-attendance.use-case.ts` (+ spec)
- Modificar: `core/domain/errors.ts` (salen dos clases)
- Reescribir: `features/grupos/grupos.facade.ts` (+ spec), `grupos.providers.ts`, `grupos-format.ts` (+ spec)
- Reescribir: las dos páginas y los cuatro componentes de `features/grupos/`

**Tarea 5 — verificación y cierre de la deuda documentada**
- Modificar: `docs/api-faltantes.md`, `docs/conexiones-disponibles.md`

---

### Task 1: `scheduleTemplateId` y la ventana de sesiones

`GET /class-sessions` devuelve la fila cruda de Prisma con un spread, así que `scheduleTemplateId` **ya viaja**; el DTO no lo declara y valibot lo descarta. Es el mismo bug que tuvieron `waitingCount` y `classSessionStatus`.

`list(dateKey)` pide UN día y recorta al día local exacto. Los grupos necesitan un rango, así que aparece `listRange`. El `shiftDay` privado del repositorio se sube a `@domain/local-date`, donde vive el resto de la lógica de fecha local, porque ahora lo necesitan dos llamadores.

**Files:**
- Modify: `src/app/core/domain/local-date.ts`
- Modify: `src/app/core/domain/entities/class-session.ts:9-22`
- Modify: `src/app/core/domain/contracts/class-sessions.repository.ts:22`
- Modify: `src/app/core/data/dto/class-session.dto.ts:15-37`
- Modify: `src/app/core/data/mappers/class-session.mapper.ts:19-32`
- Modify: `src/app/core/data/repositories/http-class-sessions.repository.ts:33-37,60-75`
- Test: `src/app/core/domain/local-date.spec.ts`, `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`

**Interfaces:**
- Produces: `shiftDateKey(dateKey: string, days: number): string` en `@domain/local-date` · `ClassSession.scheduleTemplateId: string | null` · `ClassSessionsRepository.listRange(fromKey: string, toKey: string): Promise<ClassSession[]>`

- [ ] **Step 1: Escribir el test que falla de `shiftDateKey`**

En `src/app/core/domain/local-date.spec.ts`, agregar:

```ts
describe('shiftDateKey', () => {
  it('corre días dentro del mes', () => {
    expect(shiftDateKey('2026-09-10', 1)).toBe('2026-09-11');
    expect(shiftDateKey('2026-09-10', -1)).toBe('2026-09-09');
  });

  it('desborda mes y año', () => {
    expect(shiftDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-12-31', 28)).toBe('2027-01-28');
  });

  // Argentina es UTC-3 fijo, pero el cálculo se hace con new Date(y, m, d) en hora LOCAL:
  // hacerlo en UTC correría un día en cualquier zona al oeste de Greenwich.
  it('no se corre un día cerca del borde', () => {
    expect(shiftDateKey('2026-09-10', -28)).toBe('2026-08-13');
    expect(shiftDateKey('2026-09-10', 28)).toBe('2026-10-08');
  });
});
```

Agregar `shiftDateKey` al import de `./local-date` que ya está arriba del archivo.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/domain/local-date.spec.ts`
Expected: FAIL — `shiftDateKey is not exported` / no está definida.

- [ ] **Step 3: Implementar `shiftDateKey`**

En `src/app/core/domain/local-date.ts`, al final:

```ts
/**
 * 'yyyy-MM-dd' ± n días, en el calendario LOCAL. `new Date(y, m, d)` normaliza el desborde de
 * mes y de año solo.
 *
 * Vivía como `shiftDay` privado en `http-class-sessions.repository.ts`. Se subió acá cuando
 * apareció el segundo llamador (la ventana de grupos): es lógica de fecha local, que es lo que
 * este archivo concentra justamente para que no se resuelva dos veces y distinto.
 */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/core/domain/local-date.spec.ts`
Expected: PASS

- [ ] **Step 5: Escribir el test que falla de `listRange`**

En `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`, agregar dentro del describe del repositorio:

```ts
it('listRange pide un día de más de cada lado y NO recorta', async () => {
  const { repo, calls } = setup({
    get: of([
      session({ id: '1', startAt: '2026-08-31T02:00:00.000Z', scheduleTemplateId: '7' }),
      session({ id: '2', startAt: '2026-10-01T21:00:00.000Z', scheduleTemplateId: null }),
    ]),
  });

  const rows = await repo.listRange('2026-09-01', '2026-09-30');

  expect(calls[0].path).toBe('/class-sessions?from=2026-08-31&to=2026-10-01');
  // A diferencia de list(dateKey), acá no hay filtro por día local: en una ventana de 56 días
  // unas horas de más en los bordes no cambian nada, y filtrar costaría un isOnLocalDate por fila.
  expect(rows.map((r) => r.id)).toEqual(['1', '2']);
  expect(rows.map((r) => r.scheduleTemplateId)).toEqual(['7', null]);
});
```

Agregar `scheduleTemplateId: '7'` al fixture base `session()` del archivo (arriba, junto a `waitingCount`), para que el resto de los tests siga parseando.

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
Expected: FAIL — `repo.listRange is not a function`

- [ ] **Step 7: Declarar el campo en el DTO, la entidad y el mapper**

`src/app/core/data/dto/class-session.dto.ts`, dentro de `ClassSessionDtoSchema`, después de `id`:

```ts
  /**
   * Nullable en Prisma: una clase creada a mano no cuelga de ninguna plantilla.
   *
   * `class-sessions.service.list()` hace `...session` sobre la fila cruda, así que este campo
   * SIEMPRE viajó — como `waitingCount` y `classSessionStatus` antes del 2026-09-10. No estaba
   * declarado, y valibot descarta lo que no se declara.
   */
  scheduleTemplateId: v.nullable(v.string()),
```

`src/app/core/domain/entities/class-session.ts`, en `ClassSession`, después de `id`:

```ts
  /** El grupo del que salió, o null si la clase se creó suelta. */
  readonly scheduleTemplateId: string | null;
```

`src/app/core/data/mappers/class-session.mapper.ts`, en `toClassSession`, después de `id: dto.id,`:

```ts
    scheduleTemplateId: dto.scheduleTemplateId,
```

- [ ] **Step 8: Declarar `listRange` en el contrato**

`src/app/core/domain/contracts/class-sessions.repository.ts`, justo debajo de `abstract list(...)`:

```ts
  /**
   * Las clases de un RANGO de días locales. `list` sigue siendo lo que quiere el dashboard —un
   * día exacto— y este método lo que quieren los grupos: una ventana de la que después se
   * agrupa por plantilla.
   *
   * No recorta por día local. Ver la implementación por qué.
   */
  abstract listRange(fromKey: string, toKey: string): Promise<ClassSession[]>;
```

- [ ] **Step 9: Implementar `listRange` y borrar el `shiftDay` privado**

En `src/app/core/data/repositories/http-class-sessions.repository.ts`: borrar la función `shiftDay` de arriba del archivo, agregar `shiftDateKey` al import de `@domain/local-date`, y reemplazar los dos usos de `shiftDay(` por `shiftDateKey(` dentro de `list()`. Después, debajo de `list()`:

```ts
  /**
   * Mismo ajuste de ventana que `list()` y por el mismo motivo —el backend arma el rango con
   * `new Date(`${from}T00:00:00Z`)`, con la Z literal— pero SIN el recorte final: en una ventana
   * de semanas, unas horas de más en cada borde no cambian nada, y filtrar costaría un
   * `isOnLocalDate` por fila para nada.
   */
  async listRange(fromKey: string, toKey: string): Promise<ClassSession[]> {
    try {
      const from = shiftDateKey(fromKey, -1);
      const to = shiftDateKey(toKey, 1);
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions?from=${from}&to=${to}`),
      );
      return v.parse(ClassSessionListDtoSchema, raw).map(toClassSession);
    } catch (err) {
      throw toDomainError(err);
    }
  }
```

- [ ] **Step 10: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS. Si algún fixture de `ClassSessionDto` en otro spec no tiene `scheduleTemplateId`, el `v.parse` lo rechaza: agregárselo. Los candidatos son `class-session.dto.spec.ts`, `http-dashboard.repository.spec.ts` y `reservas.facade.spec.ts`.

- [ ] **Step 11: Lint y commit**

```bash
npm run lint
git add -A
git commit -m "feat(class-sessions): declarar scheduleTemplateId y agregar listRange

El campo ya venía en la respuesta: class-sessions.service.list() hace un spread
de la fila cruda. Mismo caso que waitingCount y classSessionStatus.

shiftDay sube de http-class-sessions.repository a @domain/local-date como
shiftDateKey: apareció el segundo llamador.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: el nombre del alumno viaja en la reserva

`ClassSessionsService.listReservations()` hace `include: { student: true, ... }`. El DTO no declara `student` porque el único consumidor hasta hoy —el modal de `/reservas`— ya tenía el padrón en memoria. El detalle de grupos no lo tiene, y pedirlo entero para resolver cuatro nombres es una llamada al pedo.

`firstName` y `lastName` son `String?` en Prisma: se declaran nullables y el mapper los normaliza a `''`, exactamente como ya hace `student.mapper.ts`.

**Files:**
- Modify: `src/app/core/data/dto/class-session.dto.ts` (`SessionReservationDtoSchema`)
- Modify: `src/app/core/domain/entities/session-reservation.ts:12-31`
- Modify: `src/app/core/data/mappers/class-session.mapper.ts:37-49`
- Test: `src/app/core/data/mappers/class-session.mapper.spec.ts`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `SessionReservation.studentName: string` y `SessionReservation.studentCategoryId: string | null`.

- [ ] **Step 1: Escribir el test que falla**

En `src/app/core/data/mappers/class-session.mapper.spec.ts`:

```ts
describe('toSessionReservation · student embebido', () => {
  const base = {
    id: '500',
    studentId: '88',
    studentPlanId: null,
    holdExpiresAt: null,
    deletedAt: null,
    reservationStatus: { name: 'confirmed' },
    attendanceStatus: null,
  };

  it('arma el nombre completo y trae la categoría del alumno', () => {
    const r = toSessionReservation({
      ...base,
      student: { firstName: 'Lucía', lastName: 'Pereyra', categoryId: '3' },
    });
    expect(r.studentName).toBe('Lucía Pereyra');
    expect(r.studentCategoryId).toBe('3');
  });

  // firstName y lastName son String? en Prisma: hay filas cargadas por WhatsApp con sólo el
  // teléfono. El nombre queda vacío y lo resuelve la pantalla, no el mapper.
  it('tolera nombre y apellido nulos sin dejar espacios sueltos', () => {
    const r = toSessionReservation({
      ...base,
      student: { firstName: null, lastName: 'Vera', categoryId: null },
    });
    expect(r.studentName).toBe('Vera');
    expect(r.studentCategoryId).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/data/mappers/class-session.mapper.spec.ts`
Expected: FAIL — `studentName` es `undefined`.

- [ ] **Step 3: Declarar `student` en el DTO**

En `SessionReservationDtoSchema`, reemplazar el comentario que dice que `student` no se declara por:

```ts
  /**
   * `listReservations` hace `include: { student: true }`, así que esto SIEMPRE viene. Se declara
   * sólo lo que se usa: el detalle de grupos resuelve nombre y categoría desde acá en vez de
   * pedir el padrón entero para cuatro filas.
   *
   * `firstName`/`lastName` son String? en Prisma —hay filas creadas por WhatsApp con sólo el
   * teléfono—, así que van nullables y el mapper los normaliza. Mismo criterio que students.dto.
   */
  student: v.object({
    firstName: v.nullable(v.string()),
    lastName: v.nullable(v.string()),
    categoryId: v.nullable(v.string()),
  }),
```

- [ ] **Step 4: Agregar los campos a la entidad**

En `src/app/core/domain/entities/session-reservation.ts`, dentro de `SessionReservation`:

```ts
  /**
   * 'Nombre Apellido', ya armado desde el `student` embebido en la respuesta. Puede quedar
   * vacío: los dos campos son nullables en la base. Quien lo muestre decide el placeholder.
   */
  readonly studentName: string;
  /** El id de la categoría del alumno; el NOMBRE lo resuelve la pantalla contra /categories. */
  readonly studentCategoryId: string | null;
```

- [ ] **Step 5: Mapear**

En `toSessionReservation`, antes del cierre del objeto:

```ts
    // `${a} ${b}`.trim() y no un join: con apellido vacío no deja el espacio colgando.
    studentName: `${dto.student.firstName ?? ''} ${dto.student.lastName ?? ''}`.trim(),
    studentCategoryId: dto.student.categoryId,
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/core/data/mappers/class-session.mapper.spec.ts`
Expected: PASS

- [ ] **Step 7: Arreglar los fixtures de `/reservas`**

Run: `npm test`
Expected: fallan los specs de `features/reservas` cuyos fixtures de reserva ahora no pasan el `v.parse`, y los que construyen un `SessionReservation` literal sin los dos campos nuevos.

Agregarles `student: { firstName: 'Ana', lastName: 'Gómez', categoryId: null }` (a los fixtures de DTO) o `studentName: 'Ana Gómez', studentCategoryId: null` (a los de entidad). **No** cambiar el comportamiento de `/reservas`: sigue resolviendo por padrón, este campo todavía no lo usa nadie ahí.

- [ ] **Step 8: Correr todo y commitear**

```bash
npm test && npm run lint
git add -A
git commit -m "feat(reservations): declarar el student embebido en las reservas de una clase

listReservations ya hacía include: { student: true }. El DTO no lo declaraba
porque el único consumidor tenía el padrón en memoria; el detalle de grupos no.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `weekdayLabel` se muda a `@shared`

`features/grupos` no puede importar de `features/configuracion`: es error de `eslint-plugin-boundaries`. El helper no tiene un solo import, así que entra en `shared` sin conflicto, y el motivo por el que no vive en `domain` —es presentación, no una regla del negocio— se mantiene igual.

**Files:**
- Create: `src/app/shared/weekday-label.ts`, `src/app/shared/weekday-label.spec.ts`
- Delete: `src/app/features/configuracion/horarios/weekday-label.ts` y su spec
- Modify: los importadores dentro de `features/configuracion/horarios/`

**Interfaces:**
- Produces: `weekdayLabel(weekday: number | null): string` y `WEEKDAY_OPTIONS` en `@shared/weekday-label`.

- [ ] **Step 1: Mover los dos archivos con git**

```bash
git mv src/app/features/configuracion/horarios/weekday-label.ts src/app/shared/weekday-label.ts
git mv src/app/features/configuracion/horarios/weekday-label.spec.ts src/app/shared/weekday-label.spec.ts
```

- [ ] **Step 2: Actualizar el comentario de cabecera del archivo movido**

En `src/app/shared/weekday-label.ts`, reemplazar el primer párrafo del comentario por:

```ts
/**
 * Los nombres de los días. Vive en `shared/` y no en `domain/` porque es presentación, no una
 * regla del negocio — mismo criterio que `planes/plan-price.ts` y `hand-label.ts`. Está acá y
 * no en la feature de horarios desde que apareció el segundo consumidor: `features/grupos` no
 * puede importar de otra feature (boundaries), y `shared/` sí lo ve todo el mundo.
 *
 * El índice ES el `weekday` del backend: 0 = Domingo (§3.4). No reordenar este array — el
 * orden de la SEMANA se resuelve aparte, en HorariosFacade.sorted().
 */
```

- [ ] **Step 3: Arreglar los importadores**

```bash
grep -rln "weekday-label" src/app | grep -v '^src/app/shared/'
```

En cada archivo que aparezca, reemplazar el import relativo (`'./weekday-label'` o `'../weekday-label'`) por `'@shared/weekday-label'`.

- [ ] **Step 4: Verificar y commitear**

```bash
npm test && npm run lint
git add -A
git commit -m "refactor: mover weekdayLabel a shared

features/grupos lo necesita y no puede importar de features/configuracion.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: el swap del slice de grupos

**Esta tarea es grande a propósito y va en un solo commit.** El modelo viejo y el nuevo no
conviven: `Group` cambia de forma, y con eso dejan de compilar el mapper, el repositorio en
memoria, el caso de uso, la facade, las dos páginas y los cuatro componentes. Partirla dejaría el
árbol rojo entre tareas, que es peor que una tarea larga. Los pasos abajo sí son chicos, y las
fases A (dominio), B (datos) y C (presentación) tienen cada una su corrida de tests.

**Files:**
- Rewrite: `src/app/core/domain/entities/group.ts`, `src/app/core/domain/contracts/groups.repository.ts`, `src/app/core/data/mappers/groups.mapper.ts`, `src/app/features/grupos/grupos.facade.ts`, `src/app/features/grupos/grupos-format.ts`, `src/app/features/grupos/grupos.providers.ts`
- Create: `src/app/core/data/repositories/http-groups.repository.ts`
- Delete: `src/app/core/data/repositories/groups.seed.ts`, `src/app/core/data/repositories/in-memory-groups.repository.ts` (+ `.spec.ts`), `src/app/core/domain/use-cases/apply-attendance.use-case.ts` (+ `.spec.ts`)
- Modify: `src/app/core/domain/errors.ts:59-71`, y todos los `.ts`/`.html` de `src/app/features/grupos/`
- Test: `groups.mapper.spec.ts`, `http-groups.repository.spec.ts`, `group.spec.ts`, `grupos.facade.spec.ts`, `grupos-format.spec.ts`, y los specs de los cuatro componentes

**Interfaces:**
- Consumes: `ClassSession.scheduleTemplateId` y `ClassSessionsRepository.listRange` (Tarea 1) · `SessionReservation.studentName` y `.studentCategoryId` (Tarea 2) · `weekdayLabel` de `@shared/weekday-label` (Tarea 3)
- Produces: `Group`, `GroupSession`, `RosterMember`, `GroupWaitlistEntry`, `puedeTomarAsistencia` en `@domain/entities/group` · `GroupsRepository.listGroups()` · `toGroups`, `toRoster`, `toGroupWaitlist` en `@data/mappers/groups.mapper` · `HttpGroupsRepository`

#### Fase A — dominio

- [ ] **Step 1: Escribir el test que falla de `puedeTomarAsistencia`**

Crear `src/app/core/domain/entities/group.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GroupSession, puedeTomarAsistencia } from './group';

const sesion = (over: Partial<GroupSession> = {}): GroupSession => ({
  id: '301',
  startAt: '2026-09-01T21:00:00.000Z',
  courtName: 'Cancha 1',
  status: 'programada',
  enrolled: 4,
  capacity: 4,
  waiting: 0,
  yaPaso: true,
  ...over,
});

describe('puedeTomarAsistencia', () => {
  it('sí sobre una sesión que ya pasó', () => {
    expect(puedeTomarAsistencia(sesion())).toBe(true);
  });

  it('no sobre una futura', () => {
    expect(puedeTomarAsistencia(sesion({ yaPaso: false }))).toBe(false);
  });

  // El backend no la bloquea —markBulk sólo mira que la reserva esté confirmed— pero tomar
  // asistencia de una clase que se canceló no significa nada.
  it('no sobre una cancelada, aunque ya haya pasado', () => {
    expect(puedeTomarAsistencia(sesion({ status: 'cancelada' }))).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/domain/entities/group.spec.ts`
Expected: FAIL — no existe `puedeTomarAsistencia`, y `GroupSession` no tiene esos campos.

- [ ] **Step 3: Reescribir `group.ts` entero**

Reemplazar **todo** el contenido de `src/app/core/domain/entities/group.ts` por:

```ts
/**
 * Un grupo es un `ScheduleTemplate` con sus sesiones: "los lunes 18:00, cancha 1, 7ma+8va, con
 * Diego". El id ES el del template.
 *
 * ponytail: el roster se DERIVA de las reservas de la próxima sesión programada. En Prisma no
 * existe la inscripción a un grupo —`Reservation` cuelga de `ClassSession`—, así que no hay otra
 * fuente. Techo: quien no reservó la próxima clase no aparece aunque venga hace un año, y un
 * grupo sin próxima sesión programada muestra roster vacío. Salida: tabla `enrollment`
 * (schedule_template_id, student_id, student_plan_id, joined_at, left_at) y `listGroups()` la lee
 * en vez de derivarla. Ver el spec §3.1.
 *
 * NO lleva `name`: el título se arma con `weekdayLabel()`, que es presentación y vive en
 * `shared/`, y `core/data` no puede importar `shared/`. Lo arma `grupos-format.ts`.
 */
export interface Group {
  readonly id: string;
  /** `categoryGroup.name`. */
  readonly category: string;
  /** `coach.displayName`. */
  readonly teacher: string;
  readonly courtName: string;
  /** 0 = Domingo. La pantalla lo formatea con `weekdayLabel()`. */
  readonly weekday: number | null;
  /** 'HH:mm', ya recortado del DateTime por `toSchedule()`. */
  readonly startTime: string | null;
  readonly capacity: number;
  /** Lugares tomados en la PRÓXIMA sesión programada. 0 si no hay ninguna. */
  readonly enrolled: number;
  /** Cuántos esperan en la próxima sesión programada. */
  readonly waiting: number;
  /** La próxima sesión programada. De acá cuelgan el roster y la lista de espera del detalle. */
  readonly nextSessionId: string | null;
  /** Orden cronológico ASCENDENTE. */
  readonly sessions: readonly GroupSession[];
}

export interface GroupSession {
  readonly id: string;
  /**
   * El ISO CRUDO del backend, sin parsear: quien lo interpreta decide en qué zona hacerlo.
   * Mismo criterio —y mismo escarmiento— que `ClassSession.startAt`.
   */
  readonly startAt: string | null;
  readonly courtName: string;
  /** El `name` crudo del catálogo: 'programada' | 'cancelada' | 'completada'. */
  readonly status: string;
  readonly enrolled: number;
  readonly capacity: number;
  readonly waiting: number;
  /**
   * Si la sesión ya empezó. Se resuelve en el mapper, con el mismo `now` con el que se elige la
   * próxima sesión: así toda la pantalla mira un solo reloj y el template no tiene que llamar a
   * `new Date()` en cada ciclo de detección de cambios.
   *
   * ponytail: queda viejo si la pestaña se deja abierta cruzando el horario de una clase. Nadie
   * se rompe —el backend no valida la hora— y un F5 lo arregla.
   */
  readonly yaPaso: boolean;
}

/**
 * Una fila del roster.
 *
 * `id` ES el de la RESERVA, no el del alumno ni el de una inscripción: es lo que pide
 * `POST /class-sessions/:id/attendance`.
 */
export interface RosterMember {
  readonly id: string;
  readonly studentId: string;
  /** Puede venir vacío: `first_name`/`last_name` son nullables. La pantalla pone el placeholder. */
  readonly name: string;
  readonly category: string;
  /**
   * 'confirmed' o 'held'. Las dos ocupan cupo —es la definición del backend— pero el modal de
   * asistencia sólo ofrece las `confirmed`: `AttendanceService.mark()` tira 400 sobre el resto.
   */
  readonly status: string;
  /** 'asistio' | 'ausente' | null. Prellena el modal con lo ya guardado. */
  readonly attendanceStatus: string | null;
}

export interface GroupWaitlistEntry {
  readonly id: string;
  readonly studentId: string;
  readonly name: string;
  /** ISO. La pantalla lo formatea; el backend no manda 'hace 2 días'. */
  readonly requestedAt: string | null;
}

/**
 * Si tiene sentido tomarle asistencia a esta sesión.
 *
 * El backend no lo valida —`markBulk` sólo mira que cada reserva esté `confirmed`— así que la
 * regla vive acá: una clase que todavía no empezó no tiene asistencia que tomar, y una cancelada
 * no la va a tener nunca.
 */
export function puedeTomarAsistencia(session: GroupSession): boolean {
  return session.yaPaso && session.status !== 'cancelada';
}
```

- [ ] **Step 4: Reescribir el contrato**

Reemplazar **todo** `src/app/core/domain/contracts/groups.repository.ts` por:

```ts
import { Group } from '../entities/group';

/**
 * Los grupos del club. UN solo método, y no es minimalismo: es lo único que no existe ya.
 *
 * El roster, la lista de espera y la escritura de asistencia salen de `ClassSessionsRepository`,
 * que ya tiene `reservations()`, `waitingList()` y `markAttendance()` con su DTO, su mapper y sus
 * tests. Envolverlos acá sería una capa que sólo reenvía.
 *
 * Sin `clubId`: lo pone `tenantInterceptor` con X-Tenant-Id. Lo recibía sólo porque el
 * repositorio en memoria tenía que elegir qué semilla devolver.
 *
 * Clase abstracta a propósito: hace de token DI sin arrastrar @angular/core al dominio.
 */
export abstract class GroupsRepository {
  abstract listGroups(): Promise<Group[]>;
}
```

- [ ] **Step 5: Borrar el caso de uso y los dos errores que sólo él tiraba**

```bash
git rm src/app/core/domain/use-cases/apply-attendance.use-case.ts \
       src/app/core/domain/use-cases/apply-attendance.use-case.spec.ts
```

En `src/app/core/domain/errors.ts`, borrar las clases `GroupSessionNotFoundError` (líneas 59-64) y `SessionCancelledError` (66-71). **No** tocar `domainErrorMessage()`: las dos son subclases de `DomainRuleError`, no `kind` de la unión, así que el `switch` exhaustivo ni se entera. `GroupNotFoundError` se queda: la usa otra cosa.

- [ ] **Step 6: Correr el test de dominio**

Run: `npx ng test --include src/app/core/domain/entities/group.spec.ts`
Expected: PASS. El resto del árbol está rojo — es lo esperado hasta la Fase C.

#### Fase B — datos

- [ ] **Step 7: Escribir el test que falla del mapper**

Reemplazar **todo** `src/app/core/data/mappers/groups.mapper.spec.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { toGroups, toRoster, toGroupWaitlist, GroupsInput } from './groups.mapper';
import { Schedule } from '@domain/entities/schedule';
import { ClassSession } from '@domain/entities/class-session';
import { SessionReservation } from '@domain/entities/session-reservation';

const AHORA = new Date('2026-09-10T12:00:00.000Z');

const template = (over: Partial<Schedule> = {}): Schedule => ({
  id: '7',
  courtId: '1',
  coachId: '3',
  categoryGroupId: '2',
  sessionTypeId: '1',
  weekday: 1,
  startTime: '18:00',
  endTime: '19:30',
  capacity: 4,
  price: null,
  active: true,
  validFrom: null,
  validTo: null,
  ...over,
});

const sesion = (over: Partial<ClassSession> = {}): ClassSession => ({
  id: '301',
  scheduleTemplateId: '7',
  courtId: '1',
  coachId: '3',
  categoryGroupId: '2',
  startAt: '2026-09-14T21:00:00.000Z',
  capacity: 4,
  availableSpots: 1,
  waitingCount: 2,
  status: 'programada',
  ...over,
});

const input = (over: Partial<GroupsInput> = {}): GroupsInput => ({
  schedules: [template()],
  sessions: [sesion()],
  courts: [{ id: '1', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null }],
  coaches: [{ id: '3', displayName: 'Diego A.', description: null }],
  categoryGroups: [{ id: '2', name: '7ma+8va' }],
  ...over,
});

describe('toGroups', () => {
  it('arma el grupo desde el template y resuelve los nombres', () => {
    const [g] = toGroups(input(), AHORA);
    expect(g.id).toBe('7');
    expect(g.category).toBe('7ma+8va');
    expect(g.teacher).toBe('Diego A.');
    expect(g.courtName).toBe('Cancha 1');
    expect(g.weekday).toBe(1);
    expect(g.startTime).toBe('18:00');
    expect(g.capacity).toBe(4);
  });

  it('toma enrolled, waiting y nextSessionId de la próxima sesión PROGRAMADA', () => {
    const [g] = toGroups(
      input({
        sessions: [
          sesion({ id: 'pasada', startAt: '2026-09-07T21:00:00.000Z', availableSpots: 4, waitingCount: 0 }),
          sesion({ id: 'cancelada', startAt: '2026-09-14T21:00:00.000Z', status: 'cancelada', availableSpots: 4 }),
          sesion({ id: 'proxima', startAt: '2026-09-21T21:00:00.000Z', availableSpots: 1, waitingCount: 2 }),
          sesion({ id: 'lejana', startAt: '2026-09-28T21:00:00.000Z', availableSpots: 0, waitingCount: 9 }),
        ],
      }),
      AHORA,
    );
    expect(g.nextSessionId).toBe('proxima');
    expect(g.enrolled).toBe(3);   // capacity 4 − availableSpots 1
    expect(g.waiting).toBe(2);
  });

  it('ordena las sesiones ascendente y marca yaPaso contra el reloj recibido', () => {
    const [g] = toGroups(
      input({
        sessions: [
          sesion({ id: 'b', startAt: '2026-09-14T21:00:00.000Z' }),
          sesion({ id: 'a', startAt: '2026-09-07T21:00:00.000Z' }),
        ],
      }),
      AHORA,
    );
    expect(g.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(g.sessions.map((s) => s.yaPaso)).toEqual([true, false]);
  });

  // Una clase creada a mano no cuelga de ninguna plantilla: no es de ningún grupo.
  it('ignora las sesiones sin scheduleTemplateId', () => {
    const [g] = toGroups(input({ sessions: [sesion({ scheduleTemplateId: null })] }), AHORA);
    expect(g.sessions).toEqual([]);
    expect(g.nextSessionId).toBeNull();
    expect(g.enrolled).toBe(0);
    expect(g.waiting).toBe(0);
  });

  // Los inactivos no generan sesiones (generateSessions filtra active: true), así que un grupo
  // inactivo es un grupo que no existe más.
  it('descarta los templates inactivos', () => {
    expect(toGroups(input({ schedules: [template({ active: false })] }), AHORA)).toEqual([]);
  });

  it('muestra el template aunque no tenga sesiones en la ventana', () => {
    const [g] = toGroups(input({ sessions: [] }), AHORA);
    expect(g.sessions).toEqual([]);
    expect(g.enrolled).toBe(0);
  });

  it('cae a guión cuando un id no matchea ningún lookup', () => {
    const [g] = toGroups(input({ courts: [], coaches: [], categoryGroups: [] }), AHORA);
    expect([g.courtName, g.teacher, g.category]).toEqual(['—', '—', '—']);
  });
});

describe('toRoster', () => {
  const reserva = (over: Partial<SessionReservation> = {}): SessionReservation => ({
    id: '500',
    studentId: '88',
    studentPlanId: null,
    status: 'confirmed',
    holdExpiresAt: null,
    attendanceStatus: null,
    studentName: 'Lucía Pereyra',
    studentCategoryId: '3',
    ...over,
  });
  const categorias = [{ id: '3', name: '7ma', levelOrder: 7 }];

  it('usa la reserva como id de la fila y resuelve la categoría', () => {
    const [m] = toRoster([reserva()], categorias, AHORA);
    expect(m.id).toBe('500');
    expect(m.studentId).toBe('88');
    expect(m.name).toBe('Lucía Pereyra');
    expect(m.category).toBe('7ma');
  });

  // La MISMA definición de "lugar ocupado" que usa el backend (occupiedSpotsWhere), para que el
  // largo de esta tabla coincida con el `enrolled` del cupo.
  it('deja pasar confirmed y held vigente, y descarta el resto', () => {
    const rows = toRoster(
      [
        reserva({ id: 'conf', status: 'confirmed' }),
        reserva({ id: 'vigente', status: 'held', holdExpiresAt: '2026-09-10T13:00:00.000Z' }),
        reserva({ id: 'vencido', status: 'held', holdExpiresAt: '2026-09-10T11:00:00.000Z' }),
        reserva({ id: 'sinvto', status: 'held', holdExpiresAt: null }),
        reserva({ id: 'cancelada', status: 'cancelled' }),
      ],
      categorias,
      AHORA,
    );
    expect(rows.map((r) => r.id)).toEqual(['conf', 'vigente']);
  });

  it('cae a guión sin categoría o con una que no está en el catálogo', () => {
    const rows = toRoster(
      [reserva({ id: 'a', studentCategoryId: null }), reserva({ id: 'b', studentCategoryId: '99' })],
      categorias,
      AHORA,
    );
    expect(rows.map((r) => r.category)).toEqual(['—', '—']);
  });

  it('cae a guión con el alumno sin nombre cargado', () => {
    const [m] = toRoster([reserva({ studentName: '' })], categorias, AHORA);
    expect(m.name).toBe('—');
  });
});

describe('toGroupWaitlist', () => {
  const alumno = {
    id: '91',
    phone: '+5491100000000',
    firstName: 'Julián',
    lastName: 'Vera',
    birthDate: null,
    categoryId: null,
    studentStatusId: '1',
    dominantHand: null,
    ranking: null,
    notes: null,
  };

  it('resuelve el nombre contra el padrón', () => {
    const [e] = toGroupWaitlist([{ id: '7', studentId: '91', requestedAt: '2026-09-01T12:00:00.000Z' }], [alumno]);
    expect(e).toEqual({ id: '7', studentId: '91', name: 'Julián Vera', requestedAt: '2026-09-01T12:00:00.000Z' });
  });

  it('cae a guión si el alumno no está en el padrón', () => {
    const [e] = toGroupWaitlist([{ id: '7', studentId: '404', requestedAt: null }], [alumno]);
    expect(e.name).toBe('—');
  });
});
```

- [ ] **Step 8: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/data/mappers/groups.mapper.spec.ts`
Expected: FAIL — `toGroups`, `toRoster` y `toGroupWaitlist` no existen.

- [ ] **Step 9: Reescribir el mapper**

Reemplazar **todo** `src/app/core/data/mappers/groups.mapper.ts` por:

```ts
import { Group, GroupSession, GroupWaitlistEntry, RosterMember } from '@domain/entities/group';
import { Schedule } from '@domain/entities/schedule';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { Category } from '@domain/entities/category';
import { SessionReservation } from '@domain/entities/session-reservation';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { Student } from '@domain/entities/student';

/** Guión largo (EM DASH, U+2014), como en el resto de la pantalla. */
const DASH = '—';

/**
 * Todo lo que hace falta para derivar los grupos. No es un DTO: son entidades ya mapeadas por
 * los repositorios que `HttpGroupsRepository` compone.
 */
export interface GroupsInput {
  readonly schedules: readonly Schedule[];
  readonly sessions: readonly ClassSession[];
  readonly courts: readonly Court[];
  readonly coaches: readonly Coach[];
  readonly categoryGroups: readonly CategoryGroup[];
}

/**
 * Un grupo por `ScheduleTemplate` activo, con las sesiones de la ventana agrupadas por
 * `scheduleTemplateId`.
 *
 * `now` entra por parámetro y no se lee de `new Date()` acá adentro: la función queda pura y
 * testeable, y toda la pantalla mira UN solo reloj —el de la próxima sesión y el de `yaPaso` son
 * el mismo—, que es lo que evita que una sesión salga a la vez como "próxima" y como "ya pasó".
 */
export function toGroups(input: GroupsInput, now: Date): Group[] {
  const courtName = new Map(input.courts.map((c) => [c.id, c.name]));
  const coachName = new Map(input.coaches.map((c) => [c.id, c.displayName]));
  const groupName = new Map(input.categoryGroups.map((g) => [g.id, g.name]));

  const porTemplate = new Map<string, ClassSession[]>();
  for (const s of input.sessions) {
    // Una clase creada a mano no cuelga de ninguna plantilla: no es de ningún grupo.
    if (s.scheduleTemplateId === null) continue;
    const acumuladas = porTemplate.get(s.scheduleTemplateId);
    if (acumuladas) acumuladas.push(s);
    else porTemplate.set(s.scheduleTemplateId, [s]);
  }

  return input.schedules
    // Un template inactivo no genera sesiones (`generateSessions` filtra `active: true`), así
    // que listarlo sería un grupo que ya no existe.
    .filter((t) => t.active)
    .map((t) => {
      const sessions = (porTemplate.get(t.id) ?? [])
        .slice()
        .sort(porStartAt)
        .map((s) => toGroupSession(s, courtName, now));
      const proxima = sessions.find((s) => s.status === 'programada' && !s.yaPaso) ?? null;

      return {
        id: t.id,
        category: groupName.get(t.categoryGroupId) ?? DASH,
        teacher: coachName.get(t.coachId) ?? DASH,
        courtName: courtName.get(t.courtId) ?? DASH,
        weekday: t.weekday,
        startTime: t.startTime,
        capacity: t.capacity ?? 0,
        enrolled: proxima?.enrolled ?? 0,
        waiting: proxima?.waiting ?? 0,
        nextSessionId: proxima?.id ?? null,
        sessions,
      };
    });
}

/**
 * ASC por `startAt`. Se comparan los STRINGS: el backend los manda siempre en el mismo formato
 * ISO con Z, y así ordena igual que como se leen. Las sesiones sin hora van al final — existen
 * en la base pero no entran en ninguna grilla.
 */
function porStartAt(a: ClassSession, b: ClassSession): number {
  if (a.startAt === null) return b.startAt === null ? 0 : 1;
  if (b.startAt === null) return -1;
  return a.startAt.localeCompare(b.startAt);
}

function toGroupSession(s: ClassSession, courtName: Map<string, string>, now: Date): GroupSession {
  return {
    id: s.id,
    startAt: s.startAt,
    courtName: courtName.get(s.courtId) ?? DASH,
    status: s.status,
    enrolled: occupiedSpots(s),
    capacity: s.capacity,
    waiting: s.waitingCount,
    // Sin hora no se puede decir que pasó, así que no pasó: no ofrece tomar asistencia.
    yaPaso: s.startAt !== null && new Date(s.startAt).getTime() <= now.getTime(),
  };
}

/**
 * El roster de una sesión: las reservas que OCUPAN LUGAR.
 *
 * La definición es la del backend (`occupiedSpotsWhere`): `confirmed`, o `held` con el hold
 * todavía vigente. Contar distinto haría que el `enrolled` del cupo y el largo de esta tabla no
 * coincidan, y el que se equivoca siempre parece ser el número de la pantalla.
 *
 * Nada expira los holds en la base —cada query del backend los filtra en tiempo de consulta—, por
 * eso el recorte por vencimiento se hace acá.
 */
export function toRoster(
  reservations: readonly SessionReservation[],
  categories: readonly Category[],
  now: Date,
): RosterMember[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  return reservations
    .filter((r) => ocupaLugar(r, now))
    .map((r) => ({
      id: r.id,
      studentId: r.studentId,
      name: r.studentName || DASH,
      category:
        r.studentCategoryId === null ? DASH : (categoryName.get(r.studentCategoryId) ?? DASH),
      status: r.status,
      attendanceStatus: r.attendanceStatus,
    }));
}

function ocupaLugar(r: SessionReservation, now: Date): boolean {
  if (r.status === 'confirmed') return true;
  if (r.status !== 'held' || r.holdExpiresAt === null) return false;
  return new Date(r.holdExpiresAt).getTime() > now.getTime();
}

/**
 * La lista de espera SÍ necesita el padrón: `WaitingListService.list()` devuelve la fila cruda,
 * sin `include: { student }`, así que el `studentId` viene pelado.
 *
 * ponytail: se carga el padrón entero para resolver dos o tres nombres. Es el patrón que ya usa
 * `/reservas`. Salida: `include: { student: true }` en ese `findMany` del backend, una línea, la
 * misma que resolvió la relectura de asistencia.
 */
export function toGroupWaitlist(
  entries: readonly WaitingListEntry[],
  students: readonly Student[],
): GroupWaitlistEntry[] {
  const nombre = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
  return entries.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    name: nombre.get(e.studentId) || DASH,
    requestedAt: e.requestedAt,
  }));
}
```

- [ ] **Step 10: Correr el test del mapper y verificar que pasa**

Run: `npx ng test --include src/app/core/data/mappers/groups.mapper.spec.ts`
Expected: PASS

- [ ] **Step 11: Escribir el test que falla del repositorio HTTP**

Crear `src/app/core/data/repositories/http-groups.repository.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpGroupsRepository } from './http-groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';

function setup(over: { sesionesFalla?: boolean } = {}) {
  const calls: string[] = [];
  let rango: readonly string[] = [];

  const schedules = {
    list: async () => {
      calls.push('schedules');
      return [
        {
          id: '7', courtId: '1', coachId: '3', categoryGroupId: '2', sessionTypeId: '1',
          weekday: 1, startTime: '18:00', endTime: '19:30', capacity: 4,
          price: null, active: true, validFrom: null, validTo: null,
        },
      ];
    },
  } as unknown as SchedulesRepository;

  const classSessions = {
    listRange: async (from: string, to: string) => {
      calls.push('listRange');
      rango = [from, to];
      if (over.sesionesFalla) throw new Error('boom');
      return [];
    },
  } as unknown as ClassSessionsRepository;

  const courts = { list: async () => { calls.push('courts'); return []; } } as unknown as CourtsRepository;
  const coaches = { list: async () => { calls.push('coaches'); return []; } } as unknown as CoachesRepository;
  const categoryGroups = {
    list: async () => { calls.push('categoryGroups'); return []; },
  } as unknown as CategoryGroupsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpGroupsRepository,
      { provide: SchedulesRepository, useValue: schedules },
      { provide: ClassSessionsRepository, useValue: classSessions },
      { provide: CourtsRepository, useValue: courts },
      { provide: CoachesRepository, useValue: coaches },
      { provide: CategoryGroupsRepository, useValue: categoryGroups },
    ],
  });
  return { repo: TestBed.inject(HttpGroupsRepository), calls, rango: () => rango };
}

describe('HttpGroupsRepository', () => {
  it('llama a los cinco repositorios, una vez cada uno', async () => {
    const { repo, calls } = setup();
    await repo.listGroups();
    expect([...calls].sort()).toEqual([
      'categoryGroups',
      'coaches',
      'courts',
      'listRange',
      'schedules',
    ]);
  });

  it('pide una ventana de 28 días para atrás y 28 para adelante', async () => {
    const { repo, rango } = setup();
    await repo.listGroups();
    const [from, to] = rango();
    const dias = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    expect(dias).toBe(56);
  });

  // Media pantalla de grupos es peor que un mensaje de error: mismo criterio que el dashboard.
  it('si una de las cinco falla, falla la lista entera', async () => {
    const { repo } = setup({ sesionesFalla: true });
    await expect(repo.listGroups()).rejects.toBeDefined();
  });
});
```

- [ ] **Step 12: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/data/repositories/http-groups.repository.spec.ts`
Expected: FAIL — el archivo `http-groups.repository.ts` no existe.

- [ ] **Step 13: Escribir el repositorio HTTP**

Crear `src/app/core/data/repositories/http-groups.repository.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { Group } from '@domain/entities/group';
import { localDateKey, shiftDateKey } from '@domain/local-date';
import { toGroups } from '../mappers/groups.mapper';
import { toDomainError } from '../http/to-domain-error';

/**
 * ponytail: la ventana de sesiones es FIJA. `GET /class-sessions` exige from/to y no acepta
 * filtro por plantilla, así que se pide un rango y se agrupa en el cliente. Techo: un grupo en
 * receso de más de un mes se muestra sin sesiones. Salida: `?scheduleTemplateId=` del lado del
 * backend, y la ventana desaparece. Ver el spec §3.2.
 */
const VENTANA_DIAS = 28;

/**
 * No hay endpoint de grupos: este repositorio COMPONE la lista desde cinco llamadas en paralelo,
 * todas reusando repositorios que ya existen con su mapper y sus tests. Mismo patrón —y mismo
 * archivo de referencia— que `HttpDashboardRepository`.
 *
 * Si cualquiera de las cinco falla, falla la lista entera: media pantalla de grupos, con los
 * nombres de cancha en guión, es peor que un mensaje de error.
 *
 * Una sola llamada de sesiones cubre TODOS los grupos: se pide el rango una vez y el mapper lo
 * reparte por `scheduleTemplateId`. Por eso la lista son cinco requests y no cinco más una por
 * grupo.
 */
// `extends` y no `implements`, igual que el resto de los repos HTTP: así la clase satisface el
// token DI por sí sola.
@Injectable()
export class HttpGroupsRepository extends GroupsRepository {
  private readonly schedules = inject(SchedulesRepository);
  private readonly classSessions = inject(ClassSessionsRepository);
  private readonly courts = inject(CourtsRepository);
  private readonly coaches = inject(CoachesRepository);
  private readonly categoryGroups = inject(CategoryGroupsRepository);

  async listGroups(): Promise<Group[]> {
    try {
      // UN solo `now` para toda la derivación: la ventana, la próxima sesión y el `yaPaso` de
      // cada fila miran el mismo reloj.
      const now = new Date();
      const hoy = localDateKey(now);

      const [schedules, sessions, courts, coaches, categoryGroups] = await Promise.all([
        this.schedules.list(),
        this.classSessions.listRange(
          shiftDateKey(hoy, -VENTANA_DIAS),
          shiftDateKey(hoy, VENTANA_DIAS),
        ),
        this.courts.list(),
        this.coaches.list(),
        this.categoryGroups.list(),
      ]);

      return toGroups({ schedules, sessions, courts, coaches, categoryGroups }, now);
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
```

- [ ] **Step 14: Borrar la semilla y el repositorio en memoria**

```bash
git rm src/app/core/data/repositories/groups.seed.ts \
       src/app/core/data/repositories/in-memory-groups.repository.ts \
       src/app/core/data/repositories/in-memory-groups.repository.spec.ts
```

- [ ] **Step 15: Correr los tests de la capa de datos**

Run: `npx ng test --include src/app/core/data/repositories/http-groups.repository.spec.ts`
Expected: PASS

#### Fase C — presentación

- [ ] **Step 16: Reescribir `grupos-format.ts`**

Reemplazar **todo** `src/app/features/grupos/grupos-format.ts` por:

```ts
import { Group } from '@domain/entities/group';
import { localHhMm } from '@domain/local-date';
import { weekdayLabel } from '@shared/weekday-label';

/** Guión largo (EM DASH, U+2014), igual que la maqueta. */
const DASH = '—';

export type OccupancyState = 'low' | 'ok' | 'full';

/**
 * Estado de ocupación de un grupo. Origen: index-v2.html:1698-1701.
 * 'full' GANA sobre 'low' (un grupo de capacidad 0 está lleno, no vacío).
 */
export function occupancyState(enrolled: number, capacity: number): OccupancyState {
  if (capacity <= 0) return 'full';
  if (enrolled >= capacity) return 'full';
  if (enrolled <= capacity * 0.5) return 'low';   // el borde EXACTO de 50% es 'low'
  return 'ok';
}

/**
 * El título del grupo: '7ma+8va · Lunes 18:00'.
 *
 * Se arma acá y no en el mapper porque necesita `weekdayLabel`, que vive en `shared/`, y
 * `core/data` no puede importar `shared/` (boundaries). Es presentación de todos modos.
 */
export function groupTitle(g: Group): string {
  const cuando = [weekdayLabel(g.weekday), g.startTime].filter((p) => p && p !== DASH).join(' ');
  return cuando ? `${g.category} · ${cuando}` : g.category;
}

/**
 * '2026-09-14T21:00:00.000Z' → '14/09', en zona LOCAL. Es la fecha que ve el club.
 *
 * A mano y no con DatePipe: `new DatePipe('es-AR')` TIRA si el locale no está registrado con
 * `registerLocaleData`, y este proyecto no lo registra. Un `| date` en el template funcionaría
 * —cae al LOCALE_ID por defecto— pero entonces el mismo formato quedaría resuelto de dos maneras
 * distintas según se lo pida un template o una clase.
 */
export function fechaCorta(startAt: string | null): string {
  if (startAt === null) return DASH;
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** '21:00' en zona local. Reusa `localHhMm`, que ya resuelve esto para el resto del repo. */
export function horaCorta(startAt: string | null): string {
  if (startAt === null) return DASH;
  const d = new Date(startAt);
  return Number.isNaN(d.getTime()) ? DASH : localHhMm(d);
}

/**
 * Iniciales para el avatar. Las calcula el front: el backend manda nombre y apellido y nada más.
 * Toma la primera letra de las dos primeras palabras.
 */
export function initials(name: string): string {
  const letras = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '');
  return letras.join('') || DASH;
}
```

Actualizar `grupos-format.spec.ts`: **borrar** los describes de `formatAttendance`, `attendanceState` y `nextSessionDate`; **conservar** el de `occupancyState`; **agregar**:

```ts
describe('groupTitle', () => {
  const g = { category: '7ma+8va', weekday: 1, startTime: '18:00' } as Group;

  it('junta categoría, día y hora', () => {
    expect(groupTitle(g)).toBe('7ma+8va · Lunes 18:00');
  });

  // Hay templates viejos sin día ni hora: generateSessions los saltea, pero existen y se listan.
  it('se queda con la categoría sola cuando no hay día ni hora', () => {
    expect(groupTitle({ ...g, weekday: null, startTime: null } as Group)).toBe('7ma+8va');
  });
});

describe('fechaCorta / horaCorta', () => {
  // test-setup.ts fija TZ=America/Argentina/Buenos_Aires. Sin eso este test pasa aunque la
  // lógica esté rota: 21:00Z es 18:00 en Argentina y 21:00 en UTC.
  it('formatea en zona local, no en UTC', () => {
    expect(fechaCorta('2026-09-14T21:00:00.000Z')).toBe('14/09');
    expect(horaCorta('2026-09-14T21:00:00.000Z')).toBe('18:00');
  });

  it('cruza el día hacia atrás cuando corresponde', () => {
    expect(fechaCorta('2026-09-15T02:00:00.000Z')).toBe('14/09');
    expect(horaCorta('2026-09-15T02:00:00.000Z')).toBe('23:00');
  });

  it('devuelve guión sin fecha o con basura', () => {
    expect(fechaCorta(null)).toBe('—');
    expect(horaCorta('no es una fecha')).toBe('—');
  });
});

describe('initials', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(initials('Lucía Pereyra')).toBe('LP');
    expect(initials('María del Carmen Ruiz')).toBe('MD');
    expect(initials('Cher')).toBe('C');
  });

  it('devuelve guión con el nombre vacío', () => {
    expect(initials('')).toBe('—');
  });
});
```

- [ ] **Step 17: Reescribir la facade**

Reemplazar **todo** `src/app/features/grupos/grupos.facade.ts` por:

```ts
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Group, GroupWaitlistEntry, RosterMember } from '@domain/entities/group';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  createSessionAttendanceDraft,
} from '@domain/entities/session-attendance';
import { Category } from '@domain/entities/category';
import { Student } from '@domain/entities/student';
import { TenantContext } from '@shared/tenant/tenant-context';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { toGroupWaitlist, toRoster } from '@data/mappers/groups.mapper';

@Injectable()
export class GruposFacade extends SignalStore<Group[], DomainError> {
  private readonly repo = inject(GroupsRepository);
  private readonly sessions = inject(ClassSessionsRepository);
  private readonly categoriesRepo = inject(CategoriesRepository);
  private readonly studentsRepo = inject(StudentsRepository);
  private readonly tenant = inject(TenantContext, { optional: true });

  /** Atajo para los templates: [] mientras no haya datos. */
  readonly groups = computed(() => this.data() ?? []);

  private readonly _roster = signal<readonly RosterMember[]>([]);
  private readonly _waitlist = signal<readonly GroupWaitlistEntry[]>([]);
  private readonly _detalleCargando = signal(false);
  readonly roster = this._roster.asReadonly();
  readonly waitlist = this._waitlist.asReadonly();
  readonly detalleCargando = this._detalleCargando.asReadonly();

  /** Lookups de nombres. Se piden una vez por vida de la facade, que dura lo que dura /grupos. */
  private categories: readonly Category[] | null = null;
  private students: readonly Student[] | null = null;

  constructor() {
    super();
    // Aislamiento de tenant: limpia el estado cuando el tenant CAMBIA. El flag saltea el valor
    // inicial — sin él, el primer run del effect pisaría el estado recién cargado.
    let seenFirst = false;
    effect(() => {
      this.tenant?.tenantId();
      if (!seenFirst) { seenFirst = true; return; }
      this.reset();
      this._roster.set([]);
      this._waitlist.set([]);
      this.categories = null;
      this.students = null;
    });
  }

  load(): Promise<void> {
    return this.run(this.repo.listGroups(), toDomainError);
  }

  /**
   * Roster y lista de espera de la próxima sesión del grupo.
   *
   * NO pasa por run(): su fallo no debe reemplazar la pantalla entera, que ya tiene el grupo
   * cargado y es lo más valioso que hay para mostrar. Las dos listas quedan vacías y el detalle
   * sigue mostrando el hero y las sesiones.
   */
  async loadDetalle(nextSessionId: string | null): Promise<void> {
    if (nextSessionId === null) {
      this._roster.set([]);
      this._waitlist.set([]);
      return;
    }
    this._detalleCargando.set(true);
    try {
      const [reservations, esperando, categories, students] = await Promise.all([
        this.sessions.reservations(nextSessionId),
        this.sessions.waitingList(nextSessionId),
        this.lookupCategories(),
        this.lookupStudents(),
      ]);
      this._roster.set(toRoster(reservations, categories, new Date()));
      this._waitlist.set(toGroupWaitlist(esperando, students));
    } catch {
      this._roster.set([]);
      this._waitlist.set([]);
    } finally {
      this._detalleCargando.set(false);
    }
  }

  /**
   * El roster de UNA sesión cualquiera, para el modal de asistencia. Se devuelve y no se guarda:
   * el modal es efímero y la sesión que se marca casi nunca es la próxima.
   */
  async rosterDeSesion(sessionId: string): Promise<readonly RosterMember[]> {
    const [reservations, categories] = await Promise.all([
      this.sessions.reservations(sessionId),
      this.lookupCategories(),
    ]);
    return toRoster(reservations, categories, new Date());
  }

  /**
   * LAS DOS TRAMPAS GEMELAS — este método NO toca loading() NI error(), a propósito, y DEJA
   * PROPAGAR el error. Es una copia deliberada de DashboardFacade.cancel(), por las mismas tres
   * razones:
   *
   *  1. El template del detalle es una cadena `@if (loading()) … @else if (error()) … @else if
   *     (data())` y el modal vive DENTRO de la rama data(): usar run() prendería loading() y el
   *     modal se desmontaría con el usuario adentro.
   *  2. setError() tiene el mismo efecto por la otra rama: reemplaza la pantalla entera por el
   *     estado de error aunque data() siga poblado, en vez de dejar el modal abierto.
   *  3. run() atrapa TODO en su try/catch y NUNCA rechaza (signal-store.base.ts:23-29), así que
   *     el catch de la página no correría y saldría el toast de ÉXITO tras un fallo.
   *
   * Un implementador que "arregle" esto usando run() reintroduce exactamente el bug.
   *
   * NO relee después de escribir, y es la excepción justificada a la convención del repo:
   * `markBulk` escribe la tabla `attendance` y no toca el cupo, ni los créditos, ni el estado de
   * la reserva, ni el de la clase. Nada de lo que la pantalla muestra cambia. El resultado POR
   * ÍTEM que devuelve es lo único que hay, porque ninguna relectura lo recupera.
   */
  // `async` y no un return pelado de la promesa: `createSessionAttendanceDraft` tira
  // SINCRÓNICAMENTE, y la página espera ese fallo en su `catch`, no como una excepción que le
  // explota antes del await.
  async saveAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]> {
    return this.sessions.markAttendance(sessionId, createSessionAttendanceDraft(marks));
  }

  private async lookupCategories(): Promise<readonly Category[]> {
    this.categories ??= await this.categoriesRepo.list();
    return this.categories;
  }

  private async lookupStudents(): Promise<readonly Student[]> {
    this.students ??= await this.studentsRepo.list();
    return this.students;
  }
}
```

- [ ] **Step 18: Reescribir los providers**

Reemplazar **todo** `src/app/features/grupos/grupos.providers.ts` por:

```ts
import { Provider } from '@angular/core';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { HttpGroupsRepository } from '@data/repositories/http-groups.repository';
import { HttpSchedulesRepository } from '@data/repositories/http-schedules.repository';
import { HttpClassSessionsRepository } from '@data/repositories/http-class-sessions.repository';
import { HttpCategoriesRepository } from '@data/repositories/http-categories.repository';

/**
 * Bindeados en la ruta lazy de la feature, así quedan scoped a ella.
 *
 * `CourtsRepository`, `CoachesRepository`, `CategoryGroupsRepository`, `UsersRepository` y
 * `StudentsRepository` NO están acá: ya van a root en `app.config.ts` porque los comparten dos
 * rutas lazy distintas. Duplicarlos crearía una segunda instancia por ruta.
 *
 * `HttpGroupsRepository` no pega HTTP por sí mismo: compone los otros cuatro. Por eso todos
 * tienen que estar resueltos cuando se inyecta.
 */
export const GRUPOS_PROVIDERS: Provider[] = [
  { provide: GroupsRepository, useClass: HttpGroupsRepository },
  { provide: SchedulesRepository, useClass: HttpSchedulesRepository },
  { provide: ClassSessionsRepository, useClass: HttpClassSessionsRepository },
  { provide: CategoriesRepository, useClass: HttpCategoriesRepository },
];
```

**Verificar antes de dar el paso por hecho:** abrir `src/app/app.config.ts` y confirmar cuáles de
`CourtsRepository`, `CoachesRepository`, `CategoryGroupsRepository` y `StudentsRepository` están
efectivamente a root. Los que no estén, agregarlos a esta lista con su `Http*Repository`.

- [ ] **Step 19: Correr los tests y ver qué componentes quedan rotos**

Run: `npm test`
Expected: FAIL en los cuatro componentes y las dos páginas. Es el mapa de trabajo del paso
siguiente.

- [ ] **Step 20: Adaptar `roster-table`**

En `src/app/features/grupos/components/roster-table.component.ts`:

- Import: sacar `attendanceState`, agregar `initials` de `../grupos-format`.
- `<thead>`: dejar `<th>Alumno</th><th>Categoría</th>` y borrar las dos columnas restantes.
- La fila queda:

```html
<tr>
  <td>
    <div class="roster-who">
      <span class="avatar-sm" aria-hidden="true">{{ ini(m.name) }}</span>
      <div class="roster-name">{{ m.name }}</div>
    </div>
  </td>
  <td>
    <span class="cat-badge">{{ m.category }}</span>
    @if (m.status === 'held') {
      <span class="cat-badge hold">Sin confirmar</span>
    }
  </td>
</tr>
```

- En la clase: borrar `rate()`, agregar `protected ini(name: string) { return initials(name); }`.

Agregar al comentario de cabecera del componente:

```
 * SIN las columnas Créditos y % de asistencia: los dos son datos POR INSCRIPCIÓN y la inscripción
 * no existe en la base (ver el ponytail de entities/group.ts). Una columna de guiones ocupa ancho
 * e invita a preguntar por qué está vacía. Vuelven cuando exista `enrollment`.
 *
 * La fila 'held' se marca pero no se esconde: ocupa cupo para el backend, así que esconderla haría
 * que el 4/4 del hero no cuadre con las filas de esta tabla.
```

- [ ] **Step 21: Adaptar `sessions-table`**

En `src/app/features/grupos/components/sessions-table.component.ts`:

- Imports: sacar `SessionStatus` y `formatAttendance`; agregar `puedeTomarAsistencia` de
  `@domain/entities/group` y `fechaCorta`/`horaCorta` de `../grupos-format`.
- Borrar los `Record<SessionStatus, ...>` `LABEL` y `PILL`, y poner mapas por nombre de catálogo:

```ts
/** El `name` crudo del catálogo → copy y clase del pill. Un estado desconocido se muestra tal cual. */
const LABEL = new Map<string, string>([
  ['programada', 'Programada'],
  ['completada', 'Completada'],
  ['cancelada', 'Cancelada'],
]);
const PILL = new Map<string, string>([
  ['programada', 'prog'],
  ['completada', 'done'],
  ['cancelada', 'canc'],
]);
```

- Cabecera de la tabla: `<th>Fecha</th><th>Hora</th><th>Cancha</th><th>Estado</th><th class="cell-center">Inscriptos</th><th></th>`
- Fila:

```html
<tr>
  <td class="mono">{{ fecha(s.startAt) }}</td>
  <td class="mono">{{ hora(s.startAt) }}</td>
  <td class="ses-court">{{ s.courtName }}</td>
  <td><span class="ss-pill {{ pill(s.status) }}">{{ label(s.status) }}</span></td>
  <td class="mono cell-center ses-att">{{ s.enrolled }}/{{ s.capacity }}</td>
  <td class="cell-end">
    @if (tomable(s)) {
      <button type="button" class="btn btn-primary btn-sm"
              (click)="attendanceRequested.emit(s)">Tomar asistencia</button>
    } @else {
      <span class="ses-none">—</span>
    }
  </td>
</tr>
```

- La clase queda:

```ts
export class SessionsTableComponent {
  readonly sessions = input.required<readonly GroupSession[]>();
  readonly attendanceRequested = output<GroupSession>();

  protected label(status: string): string { return LABEL.get(status) ?? status; }
  protected pill(status: string): string { return PILL.get(status) ?? 'prog'; }
  protected tomable(s: GroupSession): boolean { return puedeTomarAsistencia(s); }
  protected fecha(startAt: string | null): string { return fechaCorta(startAt); }
  protected hora(startAt: string | null): string { return horaCorta(startAt); }
}
```

Nota: `canTake` **se borra**. Antes valía `roster.length > 0`, que era el roster del grupo; ahora
el roster es por sesión y no se conoce hasta abrir el modal. La página avisa con un toast si esa
sesión no tiene a nadie con lugar tomado.

Agregar al comentario de cabecera:

```
 * UN SOLO BOTÓN, no dos modos. `AttendanceService.markBulk` NO pasa la clase a 'completada', así
 * que `status` nunca dice si ya se tomó asistencia: la distinción tomar/editar no se puede
 * sostener contra este backend. El modal abre pidiendo las reservas de la sesión y prellena con
 * lo que ya esté guardado, igual que hace /reservas.
 *
 * La columna es Inscriptos y no Asistencia: el conteo de presentes no viene en `GET /class-sessions`
 * y sacarlo costaría una llamada por sesión.
```

- [ ] **Step 22: Adaptar `attendance-modal`**

En `src/app/features/grupos/components/attendance-modal.component.ts`:

- Imports: sacar `AttendanceMark`, `Group` y `creditsToDiscount`; agregar `RosterMember` de
  `@domain/entities/group` y `SessionAttendanceMark` de `@domain/entities/session-attendance`,
  y `groupTitle`/`initials`/`fechaCorta`/`horaCorta` de `../grupos-format`.
- Las dos interfaces del archivo:

```ts
export interface AttendanceTarget {
  readonly group: Group;
  readonly session: GroupSession;
  /** El roster DE ESA SESIÓN, ya filtrado a las confirmadas por la página. */
  readonly roster: readonly RosterMember[];
}
```

`AttendanceResult` **se borra**: el modal emite directamente `readonly SessionAttendanceMark[]`.

- Template: borrar el bloque `@if (taking()) { <label class="att-policy">…</label> }`, el
  `<div class="notice ok">…</div>` y el `<span class="sc">Clases a computar…</span>`. El pie
  queda con el texto fijo `Guardar asistencia`.
- La lista itera `target().roster` y usa `{{ ini(m.name) }}` y `<div class="sub">{{ m.category }}</div>`
  (sin los créditos).
- La clase:

```ts
export class AttendanceModalComponent {
  readonly target = input.required<AttendanceTarget>();
  /** El modal NO toca la facade: la página cablea y le informa el desenlace. */
  readonly confirmed = output<readonly SessionAttendanceMark[]>();

  protected readonly marks = signal<Record<string, boolean>>({});
  protected readonly saving = signal(false);

  private readonly modal = viewChild.required(ModalComponent);

  protected readonly title = 'Tomar asistencia';
  protected readonly subtitle = computed(() => {
    const { group, session } = this.target();
    return `${groupTitle(group)} · ${fechaCorta(session.startAt)} ${horaCorta(session.startAt)} · ${session.courtName}`;
  });

  protected readonly markList = computed<SessionAttendanceMark[]>(() =>
    this.target().roster.map((m) => ({
      reservationId: m.id,
      status: this.isPresent(m.id) ? ('asistio' as const) : ('ausente' as const),
    })),
  );
  protected readonly present = computed(() => this.markList().filter((m) => m.status === 'asistio').length);
  protected readonly absent = computed(() => this.markList().length - this.present());

  /**
   * Siembra IMPERATIVA, nunca con un effect/computed sobre el input.
   *
   * Abre en limpio y prellena con `attendanceStatus`, que es lo que el panel guardó la última
   * vez: es la única forma de EDITAR una asistencia ya tomada, porque el estado de la clase no
   * cambia al marcarla. El que no tiene marca guardada arranca PRESENTE — es el caso normal en
   * una clase a la que fue todo el mundo.
   */
  open(): void {
    this.marks.set(
      Object.fromEntries(
        this.target().roster.map((m) => [m.id, m.attendanceStatus !== 'ausente']),
      ),
    );
    this.saving.set(false);
    this.modal().open();
  }

  close(): void { this.modal().close(); }
  markDone(): void { this.close(); }
  /** La página avisa que falló: el modal QUEDA ABIERTO y el botón vuelve a estar disponible. */
  markFailed(): void { this.saving.set(false); }

  protected ini(name: string): string { return initials(name); }
  protected isPresent(reservationId: string): boolean { return this.marks()[reservationId] ?? true; }
  protected mark(reservationId: string, present: boolean): void {
    this.marks.update((m) => ({ ...m, [reservationId]: present }));
  }

  protected confirm(): void {
    // GUARD DE DOBLE-SUBMIT EN CÓDIGO. `.btn.loading` es sólo pointer-events:none
    // (styles/components.css:55) y NO impide la activación por teclado: un botón enfocado sigue
    // disparando click con Enter. Sin este guard, dos Enter seguidos son dos POST en vuelo. El
    // [disabled] del template es el segundo freno; éste es el primero.
    if (this.saving()) return;
    this.saving.set(true);
    this.confirmed.emit(this.markList());
  }
}
```

Reemplazar el párrafo "DOS MODOS DERIVADOS DE session.status" del comentario de cabecera por:

```
 * UN SOLO MODO. La versión de la maqueta tenía dos —tomar, que descontaba créditos, y editar, que
 * no— derivados de `session.status`. Contra este backend eso no se sostiene: `markBulk` no cambia
 * el estado de la clase, así que `status` nunca dice si ya se tomó asistencia, y los créditos los
 * descuenta `reserve()`, no la asistencia. El modal prellena desde `attendanceStatus` y guarda.
```

- [ ] **Step 23: Adaptar la lista**

`grupos-list-page.component.html`: borrar el `<p class="notice hold">` entero. En la fila:

- avatar: `{{ ini(g.teacher) }}`
- nombre: `{{ title(g) }}`
- meta: `{{ g.courtName }}@if (g.waiting) { · {{ g.waiting }} en espera }`
- día y hora: `{{ dia(g.weekday) }} {{ g.startTime ?? '—' }}`
- cupo: `<app-cupo-cell [enrolled]="g.enrolled" [capacity]="g.capacity" />`
- `aria-label` y `alt` que decían `g.name`: pasan a `title(g)`

`grupos-list-page.component.ts`:

```ts
  constructor() {
    // Carga sólo si está vacío: la facade se provee en la ruta PADRE, así que volver del detalle
    // no recarga, y entrar por deep-link a /grupos/:id sí carga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.facade.groups().filter(
      (g) =>
        (cat === TODAS || g.category === cat) &&
        (groupTitle(g).toLowerCase().includes(q) || g.teacher.toLowerCase().includes(q)),
    );
  });

  protected title(g: Group): string { return groupTitle(g); }
  protected ini(name: string): string { return initials(name); }
  protected dia(weekday: number | null): string { return weekdayLabel(weekday); }
```

Borrar la inyección de `SessionStore` y el `clubId` (`load()` ya no lo recibe). Agregar los
imports de `groupTitle`, `initials` y `weekdayLabel`.

- [ ] **Step 24: Adaptar el detalle**

`grupo-detail-page.component.html`: borrar el `<p class="notice hold">`. En el hero:

- `{{ ini(g.teacher) }}` en el avatar, `{{ title(g) }}` en el `<h2>`
- el tag de día: `{{ dia(g.weekday) }} · {{ g.startTime ?? '—' }}`
- `<app-cupo-cell [enrolled]="g.enrolled" [capacity]="g.capacity" />`
- Inscriptos: `{{ g.enrolled }}` · En lista de espera: `{{ g.waiting }}`
- Próxima sesión: `{{ proxima() }}`

Roster, lista de espera y sesiones:

```html
@if (facade.detalleCargando()) {
  <app-placeholder tone="loading" title="Cargando inscriptos…" />
} @else {
  <app-roster-table [roster]="facade.roster()" [capacity]="g.capacity" />
}
```

y la lista de espera itera `facade.waitlist()` con `track w.id`, mostrando
`anotado {{ fecha(w.requestedAt) }}` e `{{ ini(w.name) }}`.
`<app-sessions-table>` pierde `[canTake]`.

`grupo-detail-page.component.ts`:

```ts
  constructor() {
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Cuando el grupo aparece (o cambia), traer roster y lista de espera de su próxima sesión.
    // Es un effect y no una llamada encadenada al load() porque se entra a esta página también
    // por deep-link, con el snapshot ya cargado por la lista.
    effect(() => {
      const g = this.group();
      if (g) void this.facade.loadDetalle(g.nextSessionId);
    });

    // El modal vive detrás de un @if, así que no existe cuando se elige la sesión: hay que
    // abrirlo cuando Angular ya lo creó. Mismo patrón que el modal de cancelar del dashboard.
    effect(() => {
      if (this.attendanceTarget()) this.modal()?.open();
    });
  }

  protected readonly group = computed(() => this.facade.groups().find((g) => g.id === this.groupId));
  protected readonly proxima = computed(() => {
    const s = this.group()?.sessions.find((x) => x.status === 'programada' && !x.yaPaso);
    return fechaCorta(s?.startAt ?? null);
  });

  protected async openAttendance(session: GroupSession): Promise<void> {
    const group = this.group();
    if (!group || this.abriendo()) return;
    this.abriendo.set(true);
    try {
      // El modal SÓLO ofrece las confirmed: AttendanceService.mark() tira 400 sobre cualquier
      // otro estado, así que una fila 'held' en la planilla sería un fallo garantizado.
      const roster = (await this.facade.rosterDeSesion(session.id)).filter(
        (m) => m.status === 'confirmed',
      );
      if (roster.length === 0) {
        this.toasts.show('info', 'Nadie confirmado',
          'Esa clase no tiene reservas confirmadas: no hay a quién tomarle asistencia.');
        return;
      }
      // Sólo set(): el effect que abre el modal se re-dispara siempre, porque este literal nunca
      // es Object.is-igual al target anterior. Un open() manual acá correría ANTES de la
      // detección de cambios y sembraría el modal con el target VIEJO.
      this.attendanceTarget.set({ group, session, roster });
    } catch (err) {
      this.toasts.show('info', 'No se pudo abrir la planilla', domainErrorMessage(toDomainError(err)));
    } finally {
      this.abriendo.set(false);
    }
  }

  protected async onConfirmed(marks: readonly SessionAttendanceMark[]): Promise<void> {
    const target = this.attendanceTarget();
    if (!target) return;

    try {
      const results = await this.facade.saveAttendance(target.session.id, marks);
      const ok = results.filter((r) => r.ok).length;
      const fallaron = results.length - ok;
      this.modal()?.markDone();
      this.attendanceTarget.set(null);

      // markBulk NO es atómico: itera con un try por ítem, así que el éxito parcial es un
      // resultado de primera clase y no un borde. Reintentar es seguro: el upsert es idempotente.
      if (fallaron === 0) {
        const presentes = marks.filter((m) => m.status === 'asistio').length;
        this.toasts.show('ok', 'Asistencia registrada',
          `${presentes} presente(s) · ${marks.length - presentes} ausente(s).`);
      } else {
        this.toasts.show('info', 'Asistencia guardada a medias',
          `${ok} de ${results.length} se guardaron. Volvé a intentar: reintentar no duplica nada.`);
      }
    } catch (err) {
      // saveAttendance NO usa run(), así que el error llega crudo hasta acá. toDomainError lo
      // normaliza y domainErrorMessage le pone copy en español: nunca el kind pelado.
      this.modal()?.markFailed();
      this.toasts.show('info', 'No se pudo guardar', domainErrorMessage(toDomainError(err)));
    }
  }
```

Sumar `protected readonly abriendo = signal(false);`, los helpers `title`/`ini`/`dia` iguales a
los de la lista más `protected fecha(v: string | null) { return fechaCorta(v); }`, y borrar la
inyección de `SessionStore` y los imports de `creditsToDiscount` y `nextSessionDate`.

- [ ] **Step 25: Reescribir el spec de la facade**

Reemplazar **todo** `src/app/features/grupos/grupos.facade.spec.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GruposFacade } from './grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Group } from '@domain/entities/group';
import { SessionReservation } from '@domain/entities/session-reservation';

const grupo = (over: Partial<Group> = {}): Group => ({
  id: '7', category: '7ma+8va', teacher: 'Diego A.', courtName: 'Cancha 1',
  weekday: 1, startTime: '18:00', capacity: 4, enrolled: 3, waiting: 1,
  nextSessionId: '301', sessions: [], ...over,
});

const reserva = (over: Partial<SessionReservation> = {}): SessionReservation => ({
  id: '500', studentId: '88', studentPlanId: null, status: 'confirmed',
  holdExpiresAt: null, attendanceStatus: null, studentName: 'Lucía Pereyra',
  studentCategoryId: '3', ...over,
});

function setup(over: { asistenciaFalla?: boolean; reservasFallan?: boolean } = {}) {
  const calls: string[] = [];

  const groups = {
    listGroups: async () => { calls.push('listGroups'); return [grupo()]; },
  } as unknown as GroupsRepository;

  const sessions = {
    reservations: async (id: string) => {
      calls.push(`reservations:${id}`);
      if (over.reservasFallan) throw new Error('boom');
      return [reserva()];
    },
    waitingList: async (id: string) => { calls.push(`waitingList:${id}`); return []; },
    markAttendance: async (id: string) => {
      calls.push(`markAttendance:${id}`);
      if (over.asistenciaFalla) throw new Error('boom');
      return [{ reservationId: '500', ok: true, status: 'asistio' as const, error: null }];
    },
  } as unknown as ClassSessionsRepository;

  const categories = {
    list: async () => { calls.push('categories'); return [{ id: '3', name: '7ma', levelOrder: 7 }]; },
  } as unknown as CategoriesRepository;
  const students = {
    list: async () => { calls.push('students'); return []; },
  } as unknown as StudentsRepository;

  // TenantContext se inyecta con { optional: true }: no hace falta proveerlo.
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GruposFacade,
      { provide: GroupsRepository, useValue: groups },
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: CategoriesRepository, useValue: categories },
      { provide: StudentsRepository, useValue: students },
    ],
  });
  return { facade: TestBed.inject(GruposFacade), calls };
}

describe('GruposFacade', () => {
  it('load() llena groups()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.groups().map((g) => g.id)).toEqual(['7']);
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('loadDetalle() trae roster y lista de espera de esa sesión', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle('301');
    expect(calls).toContain('reservations:301');
    expect(calls).toContain('waitingList:301');
    expect(facade.roster().map((m) => m.id)).toEqual(['500']);
    expect(facade.detalleCargando()).toBe(false);
  });

  // Un grupo sin próxima sesión programada no tiene roster que pedir.
  it('loadDetalle(null) vacía las listas sin pegarle a nadie', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle(null);
    expect(facade.roster()).toEqual([]);
    expect(facade.waitlist()).toEqual([]);
    expect(calls).toEqual([]);
  });

  // El grupo ya está en pantalla: que falle el roster no debe reemplazarla por el estado de error.
  it('si loadDetalle falla, no ensucia error() ni loading()', async () => {
    const { facade } = setup({ reservasFallan: true });
    await facade.load();
    await facade.loadDetalle('301');
    expect(facade.error()).toBeNull();
    expect(facade.loading()).toBe(false);
    expect(facade.roster()).toEqual([]);
    expect(facade.data()).not.toBeNull();
  });

  it('pide categorías y padrón UNA sola vez aunque se llame dos veces', async () => {
    const { facade, calls } = setup();
    await facade.loadDetalle('301');
    await facade.loadDetalle('301');
    expect(calls.filter((c) => c === 'categories')).toHaveLength(1);
    expect(calls.filter((c) => c === 'students')).toHaveLength(1);
  });

  // LAS DOS TRAMPAS GEMELAS. El modal vive DENTRO de la rama data() del template: si esto
  // prendiera loading() o setError(), se desmontaría con el usuario adentro. Y si no propagara,
  // el catch de la página no correría y saldría el toast de ÉXITO tras un fallo.
  it('saveAttendance no toca loading() ni error(), y PROPAGA el fallo', async () => {
    const { facade } = setup({ asistenciaFalla: true });
    await facade.load();
    await expect(
      facade.saveAttendance('301', [{ reservationId: '500', status: 'asistio' }]),
    ).rejects.toBeDefined();
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.data()).not.toBeNull();
  });

  it('saveAttendance devuelve el resultado POR ÍTEM y no relee', async () => {
    const { facade, calls } = setup();
    const results = await facade.saveAttendance('301', [{ reservationId: '500', status: 'asistio' }]);
    expect(results).toEqual([{ reservationId: '500', ok: true, status: 'asistio', error: null }]);
    // markBulk no toca cupo, créditos ni estados: no hay nada que releer.
    expect(calls).toEqual(['markAttendance:301']);
  });

  // createSessionAttendanceDraft valida las dos invariantes que el backend valida a nivel DTO.
  it('rechaza guardar sin ninguna marca, antes de pegarle al backend', async () => {
    const { facade, calls } = setup();
    await expect(facade.saveAttendance('301', [])).rejects.toBeDefined();
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 26: Reescribir el spec de `sessions-table`**

Reemplazar **todo** `src/app/features/grupos/components/sessions-table.component.spec.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SessionsTableComponent } from './sessions-table.component';
import { GroupSession } from '@domain/entities/group';

const sesion = (over: Partial<GroupSession> = {}): GroupSession => ({
  id: '301',
  startAt: '2026-09-07T21:00:00.000Z',
  courtName: 'Cancha 1',
  status: 'programada',
  enrolled: 3,
  capacity: 4,
  waiting: 0,
  yaPaso: true,
  ...over,
});

function render(sessions: readonly GroupSession[]) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(SessionsTableComponent);
  fixture.componentRef.setInput('sessions', sessions);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SessionsTableComponent', () => {
  it('ofrece tomar asistencia en una sesión que ya pasó', () => {
    const el = render([sesion()]);
    expect(el.querySelector('button.btn-primary')?.textContent).toContain('Tomar asistencia');
  });

  it('no la ofrece en una futura', () => {
    const el = render([sesion({ yaPaso: false })]);
    expect(el.querySelector('button.btn-primary')).toBeNull();
  });

  // markBulk no la bloquea, pero tomar asistencia de una clase cancelada no significa nada.
  it('no la ofrece en una cancelada, aunque ya haya pasado', () => {
    const el = render([sesion({ status: 'cancelada' })]);
    expect(el.querySelector('button.btn-primary')).toBeNull();
  });

  it('muestra fecha y hora LOCALES y los inscriptos sobre el cupo', () => {
    const celdas = [...render([sesion()]).querySelectorAll('tbody td')].map((c) => c.textContent?.trim());
    // 21:00Z es 18:00 en Argentina, y test-setup.ts fija esa TZ.
    expect(celdas[0]).toBe('07/09');
    expect(celdas[1]).toBe('18:00');
    expect(celdas[4]).toBe('3/4');
  });

  it('muestra el placeholder sin sesiones', () => {
    expect(render([]).textContent).toContain('todavía no tiene sesiones');
  });
});
```

- [ ] **Step 27: Reescribir los specs de `roster-table`, `attendance-modal` y las dos páginas**

Mismo molde que el paso anterior (`TestBed` + `setInput` + `detectChanges`, sin librería de
mocks). Lo que tiene que quedar cubierto, con estas aserciones:

`roster-table.component.spec.ts`

```ts
it('marca la fila held sin esconderla: ocupa cupo para el backend', () => {
  const el = render([miembro({ id: 'a', status: 'confirmed' }), miembro({ id: 'b', status: 'held' })], 4);
  expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(el.textContent).toContain('Sin confirmar');
});

it('ya no tiene columnas de créditos ni de asistencia', () => {
  const th = [...render([miembro()], 4).querySelectorAll('thead th')].map((t) => t.textContent?.trim());
  expect(th).toEqual(['Alumno', 'Categoría']);
});

it('muestra el placeholder con el roster vacío', () => {
  expect(render([], 4).textContent).toContain('Nadie inscripto');
});
```

`attendance-modal.component.spec.ts`

```ts
it('open() prellena Ausente a quien ya está marcado ausente, y Presente al resto', () => {
  const { comp } = render([
    miembro({ id: '1', attendanceStatus: 'ausente' }),
    miembro({ id: '2', attendanceStatus: 'asistio' }),
    miembro({ id: '3', attendanceStatus: null }),
  ]);
  comp.open();
  const emitidas: readonly SessionAttendanceMark[][] = [];
  comp.confirmed.subscribe((m) => emitidas.push(m));
  comp.confirm();
  expect(emitidas[0]).toEqual([
    { reservationId: '1', status: 'ausente' },
    { reservationId: '2', status: 'asistio' },
    { reservationId: '3', status: 'asistio' },
  ]);
});

// El guard es de CÓDIGO: .btn.loading es sólo pointer-events:none y no frena el Enter del teclado.
it('un segundo confirm() seguido no emite dos veces', () => {
  const { comp } = render([miembro()]);
  comp.open();
  let veces = 0;
  comp.confirmed.subscribe(() => veces++);
  comp.confirm();
  comp.confirm();
  expect(veces).toBe(1);
});

it('markFailed() deja el modal abierto y el botón disponible otra vez', () => {
  const { comp } = render([miembro()]);
  comp.open();
  let veces = 0;
  comp.confirmed.subscribe(() => veces++);
  comp.confirm();
  comp.markFailed();
  comp.confirm();
  expect(veces).toBe(2);
});
```

`grupos-list-page.component.spec.ts` y `grupo-detail-page.component.spec.ts`

```ts
it('ya no muestra el cartel de datos de demostración', () => {
  expect(render().textContent).not.toContain('Datos de demostración');
});

it('el detalle pide el roster de la próxima sesión del grupo', async () => {
  const { calls } = await renderDetalle(grupo({ id: '7', nextSessionId: '301' }));
  expect(calls).toContain('loadDetalle:301');
});
```

- [ ] **Step 28: Verificar todo y commitear**

```bash
npm test && npm run lint
git add -A
git commit -m "feat(grupos): conectar la pantalla al backend real

Borra la última pantalla dummy. El grupo es un ScheduleTemplate y su roster se
deriva de las reservas de la próxima sesión programada: no hay tabla de
inscripción en Prisma y esta entrega no toca el backend.

GroupsRepository queda en un método; roster, lista de espera y escritura de
asistencia salen de ClassSessionsRepository, que ya los tenía.

Se van: la semilla, el repositorio en memoria, applyAttendance y el descuento de
créditos al tomar asistencia (lo hace reserve(), no markBulk).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: verificación contra el backend levantado y cierre de la deuda documentada

Los tests corren contra dobles: **ninguno prueba que el backend devuelva lo que este plan asume.**
Los tres campos que se declararon —`scheduleTemplateId`, `student`, y antes `waitingCount`— se
dieron por presentes leyendo el código de Nest, no una respuesta real. Un `v.parse` que falla tira
la pantalla entera, así que esto se mira con el server arriba antes de dar la entrega por hecha.

**Files:**
- Modify: `docs/api-faltantes.md`, `docs/conexiones-disponibles.md`

- [ ] **Step 1: Levantar los dos repos**

```bash
# en pipofy-backend
npm run start:dev
# en pipofy-backoffice
npm start
```

- [ ] **Step 2: Confirmar los dos campos nuevos en una respuesta real**

Con sesión iniciada en el backoffice, en la consola del navegador o con `curl` + el JWT:

```
GET /api/class-sessions?from=<hoy-29d>&to=<hoy+29d>   → cada fila tiene scheduleTemplateId
GET /api/class-sessions/<id>/reservations             → cada fila tiene student.{firstName,lastName,categoryId}
```

Si alguno **no** viene: el diagnóstico de esta entrega estaba mal, y hay que arreglar el backend
o volver el campo a `v.optional(v.nullable(...))`. Anotarlo, no improvisar.

- [ ] **Step 3: Recorrer la pantalla**

- `/grupos` lista los grupos con cupo y "en espera" reales, y el filtro por categoría los agrupa.
- Un grupo sin clases generadas aparece con la tabla de sesiones vacía y cupo `0/N`.
- El detalle muestra roster y lista de espera de la próxima sesión.
- Una sesión pasada ofrece "Tomar asistencia"; una futura y una cancelada, no.
- Guardar asistencia da toast de éxito; reabrir el modal muestra lo marcado **después de un F5**.
- Una clase con sólo holds vencidos abre el toast "Nadie confirmado" y no el modal.

- [ ] **Step 4: Cerrar §1 en `docs/api-faltantes.md`**

Marcar la sección 1 como hecha con el mismo formato que las otras tres (`✅ HECHO (2026-09-10)`,
diagnóstico original en `<details>`), diciendo qué se hizo distinto de lo que proponía: **no** se
crearon `GET /groups` ni `GET /schedules/:id/roster`; el grupo salió de `/schedules` y las sesiones
de `/class-sessions` agrupadas por `scheduleTemplateId`, que ya venía. Actualizar la fila del
resumen y el "Orden sugerido".

Dejar **explícitamente abierto** lo que esta entrega no resolvió: la tabla `enrollment`, y con ella
los créditos y el % de asistencia por inscripción.

- [ ] **Step 5: Actualizar `docs/conexiones-disponibles.md`**

`scheduleTemplateId` y el `student` embebido son dos conexiones disponibles más que estaban sin
usar: agregarlas como cerradas. En "Lo que sigue faltando", el ítem **Roster de grupos** deja de
ser una decisión pendiente —se eligió el derivado— y pasa a ser un techo con salida conocida.

- [ ] **Step 6: Commitear**

```bash
git add docs/
git commit -m "docs: cerrar el §1 de api-faltantes

Los grupos salieron sin endpoint nuevo: scheduleTemplateId y el student
embebido en las reservas ya venían en la respuesta.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
