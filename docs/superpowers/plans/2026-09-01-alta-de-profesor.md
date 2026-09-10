# Alta de profesor — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón *+ Nuevo profesor* en `/configuracion/profesores` que da de alta un profesor creando un usuario con rol `profesor`, que es la única vía que expone el backend.

**Architecture:** Slice vertical estándar del repo — entidad con `createXDraft` en `domain`, DTO valibot y mapper en `data`, método en el repositorio HTTP, método en la facade `SignalStore`, modal standalone y cableado en la página. **Sin contrato abstracto nuevo:** `UsersRepository` ya vive fuera de esa convención a propósito, igual que `CatalogsRepository`, y nueve archivos de `features/` ya inyectan un repositorio concreto de `data`. **Sin cambios de providers:** `UsersRepository` ya está bindeado en root y `CoachesRepository` ya está en `CONFIGURACION_PROVIDERS`.

**Tech Stack:** Angular 20 standalone + zoneless + signals, valibot, vitest + `TestBed`, eslint-plugin-boundaries.

**Spec:** [docs/superpowers/specs/2026-09-01-alta-de-profesor-design.md](../specs/2026-09-01-alta-de-profesor-design.md)

## Global Constraints

- **No se toca la API del repo hermano `pipofy-backend`.** Ninguna tarea edita nada fuera de este repositorio.
- **Capas (las impone eslint, no son convención):** `domain` no importa `@angular/*` ni nada de `data`/`features`/`shared`. `data` importa `domain` y `data`. `features/*` importa `domain`/`data`/`shared`, **nunca** otra feature. `shared` sólo `shared`.
- **No se agrega ningún `kind` a la unión `DomainError`.** `InvalidUserError` extiende `DomainRuleError`, que `toDomainError` normaliza a `{kind:'domain', message}`. El `switch` exhaustivo de `domainErrorMessage()` **no se toca**.
- **Comentarios y copy de UI en español.** `core/` en inglés para nombres de símbolos; los comentarios de `core/` de este repo están en español, seguir lo que hay en cada archivo.
- Todo `TestBed` lleva `provideZonelessChangeDetection()` en los providers.
- Los dobles son objetos planos casteados al contrato. **No hay librería de mocks.**
- Prettier: `printWidth: 100`, `singleQuote: true`.
- Correr un spec solo: `npx ng test --include <ruta al spec>`. Toda la suite: `npm test`. Lint: `npm run lint`.
- Los ids de la API llegan **siempre como string**; las fechas, como ISO.
- Toda simplificación deliberada con techo conocido lleva comentario `ponytail:` nombrando el techo y su salida.
- Usar los alias `@domain/*`, `@data/*`, `@shared/*`, `@features/*`. Nunca rutas relativas largas.

---

## Estructura de archivos

**Crear**

| Archivo | Responsabilidad |
|---|---|
| `src/app/core/domain/entities/new-user.ts` | Entidad `NewUser`, `NewUserInput`, `createNewUserDraft` |
| `src/app/core/domain/entities/new-user.spec.ts` | Sus invariantes |
| `src/app/core/data/mappers/user.mapper.ts` | `NewUser` → `CreateUserRequest` |
| `src/app/core/data/mappers/user.mapper.spec.ts` | La omisión de claves |
| `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.ts` | Modal de alta |
| `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts` | Validación y doble submit |

**Modificar**

| Archivo | Cambio |
|---|---|
| `src/app/core/domain/errors.ts` | + `InvalidUserError` |
| `src/app/core/data/dto/users.dto.ts` | + `CreateUserRequestSchema` |
| `src/app/core/data/repositories/users.repository.ts` | + `roles()`, + `create()` |
| `src/app/core/data/repositories/users.repository.spec.ts` | `setup()` acepta `post`; specs nuevos |
| `src/app/features/configuracion/profesores/profesores.facade.ts` | + `crear()`, docstring corregido |
| `src/app/features/configuracion/profesores/profesores.facade.spec.ts` | `setup()` acepta `UsersRepository`; specs nuevos |
| `src/app/features/configuracion/profesores/profesores-page.component.ts` | Botón, modal, handler |
| `src/app/features/configuracion/profesores/profesores-page.component.html` | Botón, modal, **copy obsoleto ×2** |
| `src/app/features/configuracion/profesores/profesores-page.component.spec.ts` | `setup()` acepta `UsersRepository`; **3 tests existentes quedan inválidos**; specs nuevos |
| `src/app/core/domain/entities/coach.ts` | Comentario obsoleto |
| `src/app/core/domain/contracts/coaches.repository.ts` | Comentario obsoleto |

---

### Task 1: Entidad `NewUser` e `InvalidUserError`

TS puro, sin Angular. Es la base de todo lo demás.

**Files:**
- Create: `src/app/core/domain/entities/new-user.ts`
- Create: `src/app/core/domain/entities/new-user.spec.ts`
- Modify: `src/app/core/domain/errors.ts`

**Interfaces:**
- Consumes: `DomainRuleError` de `../errors`.
- Produces:
  - `interface NewUserInput { readonly email: string; readonly nombre: string; readonly apellido: string }`
  - `interface NewUser { readonly email: string; readonly nombre: string | null; readonly apellido: string | null; readonly roleId: string }`
  - `function createNewUserDraft(input: NewUserInput, roleId: string): NewUser`
  - `class InvalidUserError extends DomainRuleError`

> **Ojo con la firma:** `roleId` es un **segundo parámetro**, no un campo de `NewUserInput`. El formulario no conoce el rol — lo resuelve la facade en la Task 4. Las tareas 4 y 5 dependen de esta forma exacta.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/core/domain/entities/new-user.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createNewUserDraft } from './new-user';
import { InvalidUserError } from '../errors';

const base = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' };

describe('createNewUserDraft', () => {
  it('recorta los tres campos y lleva el roleId que le pasan', () => {
    expect(createNewUserDraft({ email: '  ana@club.com  ', nombre: '  Ana  ', apellido: ' Pérez ' }, '7'))
      .toEqual({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' });
  });

  it('tira InvalidUserError cuando el email está vacío', () => {
    expect(() => createNewUserDraft({ ...base, email: '   ' }, '7')).toThrow(InvalidUserError);
  });

  it('tira InvalidUserError sin roleId', () => {
    // Es el backstop del caso §3.1: un club sin rol 'profesor'. La facade ya lo corta antes
    // con un mensaje mejor, pero el dominio no confía en la facade.
    expect(() => createNewUserDraft(base, '')).toThrow(InvalidUserError);
  });

  it('normaliza nombre y apellido vacíos a null: el mapper los omite del body', () => {
    expect(createNewUserDraft({ email: 'a@b.com', nombre: '  ', apellido: '' }, '7'))
      .toEqual({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' });
  });

  it('NO valida el formato del email: eso lo hace el form con EMAIL_RE', () => {
    // Mismo reparto que createRegistration. domain no puede importar de shared (boundaries),
    // así que duplicar el regex acá crearía dos criterios de qué es un email válido.
    expect(createNewUserDraft({ ...base, email: 'no-es-un-email' }, '7').email).toBe('no-es-un-email');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/domain/entities/new-user.spec.ts`
Expected: FAIL — no existe el módulo `./new-user`.

- [ ] **Step 3: Agregar `InvalidUserError` a `errors.ts`**

En `src/app/core/domain/errors.ts`, junto a las otras `DomainRuleError` (después de `InvalidClubError`):

```ts
/**
 * La tira `createNewUserDraft`. Vive acá porque TODAS las DomainRuleError viven acá: si se
 * dispersan, `toDomainError` deja de tener un solo lugar donde mirar.
 */
export class InvalidUserError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserError';
  }
}
```

- [ ] **Step 4: Escribir la entidad**

Crear `src/app/core/domain/entities/new-user.ts`:

```ts
import { InvalidUserError } from '../errors';

/**
 * Lo que emite el formulario de alta. SIN `roleId`: la UI no elige rol —siempre es
 * 'profesor'— y el id de ese rol lo resuelve la facade contra `GET /roles` (§4.3).
 */
export interface NewUserInput {
  readonly email: string;
  readonly nombre: string;
  readonly apellido: string;
}

/** Lo que viaja al backend. `nombre` y `apellido` en null los OMITE el mapper. */
export interface NewUser {
  readonly email: string;
  readonly nombre: string | null;
  readonly apellido: string | null;
  readonly roleId: string;
}

/**
 * Backstop de dominio del alta de usuario.
 *
 * El FORMATO del email no se valida acá: lo hace el formulario con `EMAIL_RE` de
 * `@shared/validators/email`, igual que `createRegistration`. `domain` no puede importar de
 * `shared` (boundaries), y duplicar el regex crearía dos criterios de qué es un email válido.
 * Lo que sí es invariante de dominio es que no esté vacío.
 *
 * El `trim()` vive acá y no en el componente, por el mismo argumento que `createRegistration`:
 * así "el nombre no puede ser espacios en blanco" no depende de que la UI se acuerde de limpiar.
 */
export function createNewUserDraft(input: NewUserInput, roleId: string): NewUser {
  const email = input.email.trim();
  if (email.length === 0) {
    throw new InvalidUserError('El email es obligatorio.');
  }
  const rol = roleId.trim();
  if (rol.length === 0) {
    throw new InvalidUserError('No se pudo determinar el rol a asignar.');
  }
  return {
    email,
    nombre: input.nombre.trim() || null,
    apellido: input.apellido.trim() || null,
    roleId: rol,
  };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/core/domain/entities/new-user.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Verificar que no se rompió el resto y que el lint pasa**

Run: `npm run lint`
Expected: sin errores. Confirma que `domain` no arrastró ningún import prohibido.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/domain/entities/new-user.ts src/app/core/domain/entities/new-user.spec.ts src/app/core/domain/errors.ts
git commit -m "feat(domain): entidad NewUser con createNewUserDraft" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: DTO de escritura y mapper

**Files:**
- Modify: `src/app/core/data/dto/users.dto.ts`
- Create: `src/app/core/data/mappers/user.mapper.ts`
- Create: `src/app/core/data/mappers/user.mapper.spec.ts`

**Interfaces:**
- Consumes: `NewUser` de `@domain/entities/new-user` (Task 1).
- Produces:
  - `CreateUserRequestSchema` y `type CreateUserRequest` en `@data/dto/users.dto`
  - `function toCreateUserRequest(draft: NewUser): CreateUserRequest` en `@data/mappers/user.mapper`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/core/data/mappers/user.mapper.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toCreateUserRequest } from './user.mapper';

describe('toCreateUserRequest', () => {
  it('manda email y roleId', () => {
    expect(toCreateUserRequest({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' }))
      .toEqual({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' });
  });

  it('OMITE nombre y apellido cuando son null, no los manda en null', () => {
    const body = toCreateUserRequest({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' });
    expect('nombre' in body).toBe(false);
    expect('apellido' in body).toBe(false);
    expect(body).toEqual({ email: 'a@b.com', roleId: '7' });
  });

  it('nunca manda clubId: el backend lo saca del JWT', () => {
    // Mandarlo activaría la comparación de ClubScopeGuard, que hoy pasa de largo justamente
    // porque el body no lo lleva (§4.2).
    expect('clubId' in toCreateUserRequest({ email: 'a@b.com', nombre: null, apellido: null, roleId: '7' }))
      .toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/core/data/mappers/user.mapper.spec.ts`
Expected: FAIL — no existe `./user.mapper`.

- [ ] **Step 3: Agregar el schema de escritura**

Al final de `src/app/core/data/dto/users.dto.ts`:

```ts
/**
 * Write-path de `POST /users`.
 *
 * SIN `clubId`: el backend lo resuelve del JWT. Mandarlo activaría la comparación de
 * `ClubScopeGuard`, que hoy pasa de largo justamente porque el body no lo lleva (§4.2).
 *
 * `nombre` y `apellido` son `v.optional` y no `v.nullable`: el mapper OMITE la clave cuando
 * no hay valor, así no se depende del manejo de null de `@IsOptional()` del otro repo.
 */
export const CreateUserRequestSchema = v.object({
  email: v.string(),
  nombre: v.optional(v.string()),
  apellido: v.optional(v.string()),
  roleId: v.string(),
});
export type CreateUserRequest = v.InferOutput<typeof CreateUserRequestSchema>;
```

- [ ] **Step 4: Escribir el mapper**

Crear `src/app/core/data/mappers/user.mapper.ts`:

```ts
import { NewUser } from '@domain/entities/new-user';
import { CreateUserRequest } from '../dto/users.dto';

/**
 * `nombre` y `apellido` se OMITEN cuando son null en vez de mandarse en null. `@IsOptional()`
 * de class-validator los dejaría pasar igual, pero omitir no depende de ese detalle del repo
 * de la API.
 *
 * OJO: la forma coincide con `toCourtRequest` pero la razón NO es la misma — allá omitir
 * evita un `BigInt(null)` que devuelve 500. No unificarlas.
 */
export function toCreateUserRequest(draft: NewUser): CreateUserRequest {
  return {
    email: draft.email,
    roleId: draft.roleId,
    ...(draft.nombre !== null ? { nombre: draft.nombre } : {}),
    ...(draft.apellido !== null ? { apellido: draft.apellido } : {}),
  };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/core/data/mappers/user.mapper.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/data/dto/users.dto.ts src/app/core/data/mappers/user.mapper.ts src/app/core/data/mappers/user.mapper.spec.ts
git commit -m "feat(data): CreateUserRequestSchema y user.mapper" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `UsersRepository.roles()` y `.create()`

**Files:**
- Modify: `src/app/core/data/repositories/users.repository.ts`
- Modify: `src/app/core/data/repositories/users.repository.spec.ts`

**Interfaces:**
- Consumes: `NewUser` (Task 1), `toCreateUserRequest` y `CreateUserRequestSchema` (Task 2), `CatalogItem` / `CatalogListDtoSchema` de `../dto/catalogs.dto`.
- Produces:
  - `UsersRepository.roles(): Promise<CatalogItem[]>`
  - `UsersRepository.create(draft: NewUser): Promise<void>`

- [ ] **Step 1: Ampliar el `setup()` del spec para que acepte `post`**

En `src/app/core/data/repositories/users.repository.spec.ts`, reemplazar la función `setup` por:

```ts
function setup(
  get: () => Observable<unknown>,
  post: () => Observable<unknown> = () => of({}),
) {
  const paths: string[] = [];
  const bodies: unknown[] = [];
  const api = {
    get: (p: string) => { paths.push(p); return get(); },
    post: (p: string, body: unknown) => { paths.push(p); bodies.push(body); return post(); },
  } as unknown as ApiClient;
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      UsersRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(UsersRepository), paths, bodies };
}
```

Los cinco specs que ya existen siguen usando `repo` y `paths` y no cambian.

- [ ] **Step 2: Escribir los tests que fallan**

Agregar al final de `src/app/core/data/repositories/users.repository.spec.ts`:

```ts
describe('UsersRepository.roles', () => {
  const ROLES = [{ id: '3', name: 'admin' }, { id: '7', name: 'profesor' }];

  it('pide /roles y parsea con el schema de catálogos', async () => {
    const { repo, paths } = setup(() => of(ROLES));
    expect(await repo.roles()).toEqual(ROLES);
    expect(paths).toEqual(['/roles']);
  });

  it('NO cachea: dos llamadas son dos requests', async () => {
    // Los roles son DEL CLUB del JWT. Memoizarlos serviría los del club anterior después de
    // un logout+login en la misma pestaña (§3.4).
    const { repo, paths } = setup(() => of(ROLES));
    await repo.roles();
    await repo.roles();
    expect(paths).toHaveLength(2);
  });

  it('normaliza el error de red a DomainError', async () => {
    const { repo } = setup(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(repo.roles()).rejects.toEqual({ kind: 'network' });
  });
});

describe('UsersRepository.create', () => {
  const DRAFT = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' };

  it('postea a /users el body del mapper', async () => {
    const { repo, paths, bodies } = setup(() => of({}), () => of({ id: '9', email: 'ana@club.com' }));
    await repo.create(DRAFT);
    expect(paths).toEqual(['/users']);
    expect(bodies[0]).toEqual({ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' });
  });

  it('con nombre y apellido en null no manda esas claves', async () => {
    const { repo, bodies } = setup(() => of({}), () => of({}));
    await repo.create({ ...DRAFT, nombre: null, apellido: null });
    expect(bodies[0]).toEqual({ email: 'ana@club.com', roleId: '7' });
  });

  it('el 409 de email repetido sale como domain con el texto del backend', async () => {
    const { repo } = setup(
      () => of({}),
      () => throwError(() => new HttpErrorResponse({
        status: 409,
        error: { statusCode: 409, message: 'Ya existe un usuario con ese email' },
      })),
    );
    await expect(repo.create(DRAFT)).rejects.toEqual({
      kind: 'domain',
      message: 'Ya existe un usuario con ese email',
    });
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx ng test --include src/app/core/data/repositories/users.repository.spec.ts`
Expected: FAIL — `repo.roles is not a function`.

- [ ] **Step 4: Implementar los dos métodos**

En `src/app/core/data/repositories/users.repository.ts`, agregar los imports:

```ts
import { NewUser } from '@domain/entities/new-user';
import { CatalogItem, CatalogListDtoSchema } from '../dto/catalogs.dto';
import { CreateUserRequestSchema } from '../dto/users.dto';
import { toCreateUserRequest } from '../mappers/user.mapper';
```

y los dos métodos dentro de la clase, después de `me()`:

```ts
  /**
   * Los roles del club. `roles.service.list()` serializa a mano `{ id, name }` —la misma
   * forma que `/catalogs/*`—, así que reusa `CatalogListDtoSchema` en vez de declarar uno.
   *
   * SIN cache, igual que me() y a diferencia de CatalogsRepository: los roles son DEL CLUB
   * del JWT. Memoizarlos en un singleton de root haría que un logout seguido de un login con
   * otro club en la misma pestaña sirviera los roles del club anterior (§3.4).
   */
  async roles(): Promise<CatalogItem[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/roles'));
      return v.parse(CatalogListDtoSchema, raw);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Alta de usuario. Devuelve void y el llamador relee: la respuesta real es `{ id, email }`
   * y no alcanza para armar un `Coach` (le falta `description`).
   *
   * OJO (§3.2): el backend NO es atómico. `createUser` crea user + userRole + coachProfile
   * sin transacción y recién después manda el mail, sin catch. Un fallo de SMTP devuelve 500
   * con el usuario YA creado. Por eso `ProfesoresFacade.crear()` relee también cuando esto
   * tira — no asumir acá que un rechazo significa que no se creó nada.
   */
  async create(draft: NewUser): Promise<void> {
    try {
      const body = v.parse(CreateUserRequestSchema, toCreateUserRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/users', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx ng test --include src/app/core/data/repositories/users.repository.spec.ts`
Expected: PASS, 11 tests (los 5 de `me`/`currentUserName` que ya estaban + 6 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/data/repositories/users.repository.ts src/app/core/data/repositories/users.repository.spec.ts
git commit -m "feat(data): UsersRepository.roles() y create()" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `ProfesoresFacade.crear()`

El corazón del slice, y donde vive la defensa contra la no-atomicidad del backend.

**Files:**
- Modify: `src/app/features/configuracion/profesores/profesores.facade.ts`
- Modify: `src/app/features/configuracion/profesores/profesores.facade.spec.ts`

**Interfaces:**
- Consumes: `UsersRepository.roles()` y `.create()` (Task 3), `createNewUserDraft` y `NewUserInput` (Task 1).
- Produces: `ProfesoresFacade.crear(input: NewUserInput): Promise<boolean>` — `true` si la escritura salió bien.

- [ ] **Step 1: Ampliar el `setup()` del spec para proveer `UsersRepository`**

En `src/app/features/configuracion/profesores/profesores.facade.spec.ts`, agregar el import y reemplazar `setup`:

```ts
import { UsersRepository } from '@data/repositories/users.repository';

function setup(repo: Partial<CoachesRepository>, users: Partial<UsersRepository> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CoachesRepository, useValue: repo },
      { provide: UsersRepository, useValue: users },
      ProfesoresFacade,
    ],
  });
  return TestBed.inject(ProfesoresFacade);
}
```

Los specs que ya existen llaman `setup({...})` con un argumento y siguen andando.

- [ ] **Step 2: Escribir los tests que fallan**

Agregar a `src/app/features/configuracion/profesores/profesores.facade.spec.ts`:

```ts
describe('ProfesoresFacade.crear', () => {
  const ROLES = [{ id: '3', name: 'admin' }, { id: '7', name: 'profesor' }];
  const INPUT = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' };

  it('busca el rol "profesor" y manda el draft con ese roleId', async () => {
    const enviados: unknown[] = [];
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => ROLES, create: async (d) => { enviados.push(d); } },
    );
    expect(await f.crear(INPUT)).toBe(true);
    expect(enviados).toEqual([
      { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' },
    ]);
  });

  it('relee la lista después de crear', async () => {
    let leidas = 0;
    const f = setup(
      { list: async () => { leidas++; return COACHES; } },
      { roles: async () => ROLES, create: async () => undefined },
    );
    await f.crear(INPUT);
    expect(leidas).toBe(1);
    expect(f.data()).toHaveLength(2);
  });

  it('RELEE también cuando create() falla: el backend no es atómico con el mail', async () => {
    // §3.2: POST /users crea user + coachProfile y recién después manda el mail, sin catch.
    // Un 500 de SMTP deja el profesor creado. La tabla tiene que mostrar lo que HAY.
    let leidas = 0;
    const f = setup(
      { list: async () => { leidas++; return COACHES; } },
      { roles: async () => ROLES, create: async () => { throw new Error('boom'); } },
    );
    expect(await f.crear(INPUT)).toBe(false);
    expect(leidas).toBe(1);
    expect(f.data()).toHaveLength(2);
    expect(f.error()).not.toBeNull();
  });

  it('sin rol "profesor" no llama a create() y deja un mensaje propio', async () => {
    // Es el caso de las cuentas 'particular' y de los clubes viejos (§3.1): no es un borde
    // teórico, es una población entera.
    let creados = 0;
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => [{ id: '3', name: 'admin' }], create: async () => { creados++; } },
    );
    expect(await f.crear(INPUT)).toBe(false);
    expect(creados).toBe(0);
    expect(f.error()).toEqual({
      kind: 'domain',
      message:
        'Tu cuenta no tiene configurado el rol de profesor. Sólo las cuentas de club pueden dar de alta profesores.',
    });
  });

  it('el error de la ESCRITURA gana sobre el de la relectura', async () => {
    const f = setup(
      { list: async () => { throw new Error('la relectura también falló'); } },
      {
        roles: async () => ROLES,
        create: async () => { throw new HttpErrorResponse({
          status: 409, error: { statusCode: 409, message: 'Ya existe un usuario con ese email' },
        }); },
      },
    );
    await f.crear(INPUT);
    expect(f.error()).toEqual({ kind: 'domain', message: 'Ya existe un usuario con ese email' });
  });

  it('deja loading en false al terminar, pase lo que pase', async () => {
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => { throw new Error('boom'); }, create: async () => undefined },
    );
    await f.crear(INPUT);
    expect(f.loading()).toBe(false);
  });
});
```

Agregar el import que falta al principio del archivo:

```ts
import { HttpErrorResponse } from '@angular/common/http';
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesores.facade.spec.ts`
Expected: FAIL — `f.crear is not a function`.

- [ ] **Step 4: Implementar `crear()`**

En `src/app/features/configuracion/profesores/profesores.facade.ts`, agregar imports:

```ts
import { UsersRepository } from '@data/repositories/users.repository';
import { NewUserInput, createNewUserDraft } from '@domain/entities/new-user';
import { InvalidUserError } from '@domain/errors';
```

Agregar la constante arriba de la clase:

```ts
/** El backend crea el CoachProfile cuando el rol se llama EXACTAMENTE así (users.service.ts). */
const ROL_PROFESOR = 'profesor';
```

Inyectar el repositorio junto al que ya está:

```ts
  private readonly usersRepo = inject(UsersRepository);
```

Y el método:

```ts
  /**
   * Alta de profesor. Crea un USUARIO con rol 'profesor': el backend crea el `CoachProfile`
   * como efecto de asignar ese rol, y no existe `POST /coaches`.
   *
   * NO usa run(): run() no escribe data() cuando la promesa falla, y acá hay que releer en
   * las DOS ramas — `POST /users` no es atómico con el envío del mail, así que un 500 puede
   * dejar el profesor creado (§3.2). Mismo patrón que `AlumnoPlanesFacade.comprar()`.
   *
   * Devuelve true si la ESCRITURA salió bien, para que la página sepa si cerrar el modal.
   */
  async crear(input: NewUserInput): Promise<boolean> {
    this.setLoading(true);
    this.setError(null);

    let creado = false;
    try {
      const roles = await this.usersRepo.roles();
      const rol = roles.find((r) => r.name === ROL_PROFESOR);
      if (!rol) {
        // §3.1: los roles se crean por club en el signup y las cuentas 'particular' sólo
        // reciben 'superprofesor'. El mensaje es específico porque el caso es real y frecuente.
        throw new InvalidUserError(
          'Tu cuenta no tiene configurado el rol de profesor. Sólo las cuentas de club pueden dar de alta profesores.',
        );
      }
      await this.usersRepo.create(createNewUserDraft(input, rol.id));
      creado = true;
    } catch (err) {
      this.setError(toDomainError(err));
    }

    // Se relee SIEMPRE, también después de un fallo (§3.2).
    try {
      this.setData(await this.repo.list());
    } catch (err) {
      // El error de la escritura gana: es el que explica qué pasó. Éste sólo llena el hueco.
      //
      // ponytail: si la escritura anduvo y sólo falló la relectura, la tabla queda
      // desactualizada hasta cambiar de tab. Techo aceptado: con la escritura ya hecha, un
      // error de red al releer no tiene arreglo del lado del cliente.
      if (!this.error()) this.setError(toDomainError(err));
    }

    this.setLoading(false);
    return creado;
  }
```

- [ ] **Step 5: Corregir el docstring obsoleto de la clase**

En el mismo archivo, reemplazar el primer párrafo del docstring de `ProfesoresFacade`:

```ts
/**
 * Sin remove: no hay endpoint para dar de baja un profesor.
 *
 * `crear()` no vive en `CoachesRepository` a propósito: crear un profesor es crear un
 * USUARIO, y esconder eso detrás de un método del contrato de coaches haría creer que
 * existe un `POST /coaches` (§4.4).
 *
 * ponytail: save() reusa `loading`, así que la tabla muestra su spinner mientras se guarda.
 * Es aceptable porque el modal la tapa — mismo techo que las otras cinco facades con tabla.
 */
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesores.facade.spec.ts`
Expected: PASS — los que ya estaban más los 6 nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/configuracion/profesores/profesores.facade.ts src/app/features/configuracion/profesores/profesores.facade.spec.ts
git commit -m "feat(profesores): ProfesoresFacade.crear() con relectura en ambas ramas" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `ProfesorNuevoModalComponent`

**Files:**
- Create: `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.ts`
- Create: `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts`

**Interfaces:**
- Consumes: `NewUserInput` (Task 1), `ModalComponent` de `@shared/ui/modal/modal.component`, `EMAIL_RE` de `@shared/validators/email`.
- Produces:
  - `ProfesorNuevoModalComponent.open(): void`
  - `.close(): void`
  - `.markFailed(): void` — libera el guard de doble submit; la página la llama cuando la escritura falló
  - `output saved: NewUserInput`
  - `input error: string`

> El guard de doble submit sigue el patrón de `AttendanceModalComponent`: un signal **interno** `saving`, no un input. Se pone en `false` en `open()` y en `markFailed()`. `ProfesorFormModalComponent` recibe `saving` como input, pero ése no tiene guard en código — acá hace falta, porque en zoneless el input del padre no se propaga entre dos clicks seguidos.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProfesorNuevoModalComponent } from './profesor-nuevo-modal.component';
import { NewUserInput } from '@domain/entities/new-user';

function setup(error = '') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(ProfesorNuevoModalComponent);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open();
  fixture.detectChanges();
  return fixture;
}

const input = (f: { nativeElement: HTMLElement }, id: string) =>
  f.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

const escribir = (f: { nativeElement: HTMLElement; detectChanges: () => void }, id: string, valor: string) => {
  const el = input(f, id);
  el.value = valor;
  el.dispatchEvent(new Event('input'));
  f.detectChanges();
};

const guardar = (f: { nativeElement: HTMLElement }) =>
  (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();

describe('ProfesorNuevoModalComponent', () => {
  it('abre vacío', () => {
    const f = setup();
    expect(input(f, 'profesor-email').value).toBe('');
    expect(input(f, 'profesor-nombre').value).toBe('');
    expect(input(f, 'profesor-apellido').value).toBe('');
  });

  it('emite los tres campos', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    escribir(f, 'profesor-nombre', 'Ana');
    escribir(f, 'profesor-apellido', 'Pérez');
    guardar(f);
    expect(emitidos).toEqual([{ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' }]);
  });

  it('con un email inválido NO emite', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'no-es-un-email');
    guardar(f);
    expect(emitidos).toEqual([]);
  });

  it('el segundo click seguido NO reemite', () => {
    // En zoneless el input `error`/estado del padre no se propaga entre dos clicks: el guard
    // tiene que estar en el componente, no sólo en [disabled].
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    guardar(f);
    guardar(f);
    expect(emitidos).toHaveLength(1);
  });

  it('markFailed() vuelve a habilitar el envío', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    guardar(f);
    f.componentInstance.markFailed();
    f.detectChanges();
    guardar(f);
    expect(emitidos).toHaveLength(2);
  });

  it('reabrir limpia lo tipeado', () => {
    const f = setup();
    escribir(f, 'profesor-email', 'ana@club.com');
    f.componentInstance.open();
    f.detectChanges();
    expect(input(f, 'profesor-email').value).toBe('');
  });

  it('muestra el error DENTRO del modal', () => {
    // El .notice de la página queda detrás del ::backdrop, que tiene scrim + blur.
    expect(setup('Ya existe un usuario con ese email').nativeElement.textContent)
      .toContain('Ya existe un usuario con ese email');
  });

  it('avisa que se manda un mail con contraseña temporal', () => {
    expect(setup().nativeElement.textContent).toContain('contraseña temporal');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Escribir el componente**

Crear `src/app/features/configuracion/profesores/profesor-nuevo-modal.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NewUserInput } from '@domain/entities/new-user';
import { EMAIL_RE } from '@shared/validators/email';

/**
 * ALTA, no edición. Modal aparte de `ProfesorFormModalComponent` a propósito: los campos son
 * disjuntos —acá email/nombre/apellido, allá sólo `description`— y su `open(coach: Coach)`
 * está construido alrededor de un coach no-null. Un flag `mode` ramificaría template,
 * siembra, título y tipo emitido: más código que este archivo (§3.5).
 *
 * El guard de doble submit vive en `saving`, un signal INTERNO —no un input— igual que en
 * AttendanceModalComponent: en zoneless el input del padre no se propaga entre dos clicks
 * seguidos, así que `[disabled]` solo no alcanza. La página llama a `markFailed()` para
 * liberarlo cuando la escritura falla.
 */
@Component({
  selector: 'app-profesor-nuevo-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Nuevo profesor" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css). -->
      @if (error()) { <p class="notice hold form-error" role="alert">{{ error() }}</p> }

      <div class="field field-dense">
        <label for="profesor-email">Email</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' -->
        <input id="profesor-email" class="control" type="email" autofocus
               [value]="email()" (input)="email.set(value($event))" />
        @if (emailInvalido()) {
          <p class="hint" role="alert">Ingresá un email válido.</p>
        }
      </div>

      <div class="field field-dense">
        <label for="profesor-nombre">Nombre</label>
        <input id="profesor-nombre" class="control" type="text"
               [value]="nombre()" (input)="nombre.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="profesor-apellido">Apellido</label>
        <input id="profesor-apellido" class="control" type="text"
               [value]="apellido()" (input)="apellido.set(value($event))" />
      </div>

      <p class="hint">
        Se le crea una cuenta y se le manda un mail con una contraseña temporal, que va a
        tener que cambiar la primera vez que entre.
      </p>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save"
                [disabled]="saving()" [class.loading]="saving()" (click)="onSave()">
          Crear profesor
        </button>
      </div>
    </app-modal>
  `,
  styles: [`.form-error{margin-bottom:var(--space-md)}`],
})
export class ProfesorNuevoModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<NewUserInput>();

  private readonly modal = viewChild.required(ModalComponent);

  protected readonly email = signal('');
  protected readonly nombre = signal('');
  protected readonly apellido = signal('');
  /** Guard de doble submit. Interno, no input: ver el docstring de la clase. */
  protected readonly saving = signal(false);
  /** El aviso de email inválido aparece recién después del primer intento, no al tipear. */
  protected readonly intentado = signal(false);

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  protected emailInvalido(): boolean {
    return this.intentado() && !EMAIL_RE.test(this.email().trim());
  }

  /** Siembra imperativa en CADA apertura: el <dialog> no se destruye entre aperturas. */
  open(): void {
    this.email.set('');
    this.nombre.set('');
    this.apellido.set('');
    this.saving.set(false);
    this.intentado.set(false);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  /** La llama la página cuando la escritura falló, para poder reintentar. */
  markFailed(): void { this.saving.set(false); }

  protected onSave(): void {
    if (this.saving()) return;
    this.intentado.set(true);
    // El formato del email se valida acá, no en createNewUserDraft: domain no puede importar
    // de shared (boundaries). Mismo reparto que el wizard de onboarding.
    if (!EMAIL_RE.test(this.email().trim())) return;
    this.saving.set(true);
    this.saved.emit({
      email: this.email(),
      nombre: this.nombre(),
      apellido: this.apellido(),
    });
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/configuracion/profesores/profesor-nuevo-modal.component.ts src/app/features/configuracion/profesores/profesor-nuevo-modal.component.spec.ts
git commit -m "feat(profesores): modal de alta con guard de doble submit" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Cablear la página y corregir el copy obsoleto

**Files:**
- Modify: `src/app/features/configuracion/profesores/profesores-page.component.ts`
- Modify: `src/app/features/configuracion/profesores/profesores-page.component.html`
- Modify: `src/app/features/configuracion/profesores/profesores-page.component.spec.ts`
- Modify: `src/app/core/domain/entities/coach.ts`
- Modify: `src/app/core/domain/contracts/coaches.repository.ts`

**Interfaces:**
- Consumes: `ProfesoresFacade.crear()` (Task 4), `ProfesorNuevoModalComponent` con `open()` / `close()` / `markFailed()` / `saved` (Task 5).
- Produces: nada que consuman tareas posteriores.

> **Leer esto antes de empezar.** Este spec **no** usa un doble de la facade: usa la
> `ProfesoresFacade` real con un doble de `CoachesRepository`. Como la facade ahora inyecta
> `UsersRepository` (Task 4), **todos** los tests del archivo van a explotar con
> `NullInjectorError` hasta que `setup()` lo provea. Y hay **tres tests existentes que este
> slice rompe a propósito** — no son regresiones, son afirmaciones que dejaron de ser ciertas.

- [ ] **Step 1: Arreglar el `setup()` para que provea `UsersRepository`**

En `src/app/features/configuracion/profesores/profesores-page.component.spec.ts`, agregar el
import y reemplazar `setup`:

```ts
import { UsersRepository } from '@data/repositories/users.repository';

const ROLES = [{ id: '3', name: 'admin' }, { id: '7', name: 'profesor' }];

function setup(repo: Partial<CoachesRepository>, users: Partial<UsersRepository> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CoachesRepository, useValue: repo },
      { provide: UsersRepository, useValue: users },
      ProfesoresFacade,
      ToastService,
    ],
  });
  const fixture = TestBed.createComponent(ProfesoresPageComponent);
  fixture.detectChanges();
  return fixture;
}
```

Correr `npx ng test --include src/app/features/configuracion/profesores/profesores-page.component.spec.ts`
antes de seguir: los tests tienen que volver al verde con el código de producción **todavía sin
tocar**. Si alguno sigue rojo, es un problema del `setup`, no del slice.

- [ ] **Step 2: Actualizar los tres tests que este slice invalida**

**2a.** `'NO ofrece alta ni baja: contra este backend son imposibles (§2.3)'` afirma
`not.toContain('Nuevo profesor')`. El alta ahora existe; la baja sigue sin existir. Reemplazarlo
entero por:

```ts
  it('ofrece alta pero NO baja: no hay endpoint para borrar un profesor', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Nuevo profesor');
    expect(f.nativeElement.querySelector('.btn-danger')).toBeNull();
    expect(f.nativeElement.querySelector('app-confirm-delete-modal')).toBeNull();
  });
```

**2b.** `'explica de dónde salen los profesores'` afirma `toContain('rol de profesor')`, que era
la explicación de por qué no se podían crear. Ahora lo que hay que explicar es la consecuencia
del alta:

```ts
  it('avisa que el alta manda un mail con una contraseña temporal', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('contraseña temporal');
  });
```

**2c.** `'el vacío NO dice "todavía no cargaste": acá no se puede cargar ninguno'` afirma
`toContain('No hay profesores en este club')`, y el copy nuevo del vacío cambia. Reemplazarlo por:

```ts
  it('el vacío ahora SÍ puede invitar a cargar: el alta existe', async () => {
    const f = setup({ list: async () => [] });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Todavía no hay profesores');
  });
```

- [ ] **Step 3: Escribir los tests nuevos, que fallan**

Agregar al final del `describe` de `src/app/features/configuracion/profesores/profesores-page.component.spec.ts`:

```ts
  // Hay DOS <dialog> en la página: el de edición va primero en el template, así que
  // querySelector('dialog') a secas sigue devolviendo ése. El de alta se busca por su host.
  const dialogNuevo = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelector('app-profesor-nuevo-modal dialog') as HTMLDialogElement;

  it('el botón de alta abre el modal de alta', async () => {
    const f = setup({ list: async () => COACHES });
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(true);
    expect(f.nativeElement.querySelector('#profesor-email')).not.toBeNull();
  });

  it('el alta exitosa cierra el modal', async () => {
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => ROLES, create: async () => undefined },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    (dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(false);
  });

  it('el alta fallida deja el modal ABIERTO para corregir', async () => {
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => [{ id: '3', name: 'admin' }], create: async () => undefined },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    (dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(dialogNuevo(f).open).toBe(true);
    expect(f.nativeElement.textContent).toContain('rol de profesor');
  });

  it('después de un alta fallida se puede reintentar: markFailed() libera el guard', async () => {
    // Sin markFailed(), el signal `saving` del modal queda en true y el botón deshabilitado
    // para siempre: el usuario ve el error y no puede corregirlo.
    let intentos = 0;
    const f = setup(
      { list: async () => COACHES },
      { roles: async () => ROLES, create: async () => { intentos++; throw { kind: 'network' }; } },
    );
    await f.whenStable();
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="new"]') as HTMLButtonElement).click();
    f.detectChanges();
    const email = f.nativeElement.querySelector('#profesor-email') as HTMLInputElement;
    email.value = 'ana@club.com';
    email.dispatchEvent(new Event('input'));
    f.detectChanges();
    const guardar = dialogNuevo(f).querySelector('[data-test="save"]') as HTMLButtonElement;
    guardar.click();
    await f.whenStable();
    f.detectChanges();
    guardar.click();
    await f.whenStable();
    expect(intentos).toBe(2);
  });
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesores-page.component.spec.ts`
Expected: FAIL — no existe `[data-test="new"]` ni el elemento `app-profesor-nuevo-modal`.

- [ ] **Step 5: Cablear el componente**

En `src/app/features/configuracion/profesores/profesores-page.component.ts`:

Agregar imports:

```ts
import { ProfesorNuevoModalComponent } from './profesor-nuevo-modal.component';
import { NewUserInput } from '@domain/entities/new-user';
```

Agregarlo a `imports` del decorador:

```ts
  imports: [ProfesorFormModalComponent, ProfesorNuevoModalComponent],
```

Agregar el viewChild y los dos métodos:

```ts
  private readonly nuevo = viewChild.required(ProfesorNuevoModalComponent);

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en el modal. */
  protected openNuevo(): void {
    this.facade.clearError();
    this.nuevo().open();
  }

  protected async onNuevoGuardado(input: NewUserInput): Promise<void> {
    const creado = await this.facade.crear(input);
    if (!creado) {
      // El modal queda ABIERTO: es donde se corrige. markFailed() libera su guard de doble
      // submit, que si no dejaría el botón deshabilitado para siempre.
      this.nuevo().markFailed();
      return;
    }
    this.nuevo().close();
    this.toast.show(
      'ok',
      'Profesor creado',
      `Le mandamos a ${input.email} un mail con su contraseña temporal.`,
    );
  }
```

- [ ] **Step 6: Cablear el template y corregir el copy obsoleto**

En `src/app/features/configuracion/profesores/profesores-page.component.html`:

**6a.** El `.panel-head`, con el botón en la misma posición que en Canchas:

```html
  <div class="panel-head">
    <h3>Profesores</h3>
    <button type="button" class="btn btn-primary" data-test="new"
            (click)="openNuevo()">+ Nuevo profesor</button>
  </div>
```

**6b.** La nota bajo el título — hoy explica por qué la pantalla no puede crear profesores, que ya es falso:

```html
  <p class="a-body">
    Al crear un profesor se le da de alta una cuenta y se le manda un mail con una contraseña
    temporal. Su descripción se edita desde la tabla.
  </p>
```

**6c.** El estado vacío — misma razón:

```html
    <div class="a-empty">
      Todavía no hay profesores en este club.
    </div>
```

**6d.** El modal nuevo, al final del archivo junto al que ya está:

```html
<app-profesor-nuevo-modal
  [error]="errorText()"
  (saved)="onNuevoGuardado($event)" />
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npx ng test --include src/app/features/configuracion/profesores/profesores-page.component.spec.ts`
Expected: PASS — los que ya estaban más los 3 nuevos.

- [ ] **Step 8: Corregir los dos comentarios obsoletos del dominio**

En `src/app/core/domain/entities/coach.ts`, reemplazar el docstring de `Coach`:

```ts
/**
 * Sin delete: no hay endpoint para dar de baja un profesor. El alta SÍ existe, pero no pasa
 * por acá: crear un profesor es crear un usuario con rol 'profesor' vía `POST /users`, que
 * es lo que crea el `CoachProfile` del lado del backend. Ver `new-user.ts`.
 */
```

En `src/app/core/domain/contracts/coaches.repository.ts`, reemplazar el docstring:

```ts
/**
 * Sin create: crear un profesor es crear un USUARIO (`POST /users` con rol 'profesor'), y no
 * existe `POST /coaches`. Meterlo acá haría creer lo contrario — la asimetría es del backend
 * y conviene que se vea. Ver `UsersRepository.create()`.
 *
 * `update()` escribe sólo `description`, que es lo único que el backend toca.
 */
```

- [ ] **Step 9: Correr TODA la suite y el lint**

Run: `npm test`
Expected: PASS, sin regresiones.

Run: `npm run lint`
Expected: sin errores. En particular confirma que ningún import cruzó un boundary.

- [ ] **Step 10: Commit**

```bash
git add src/app/features/configuracion/profesores/ src/app/core/domain/entities/coach.ts src/app/core/domain/contracts/coaches.repository.ts
git commit -m "feat(profesores): botón de alta y copy actualizado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificación final a mano

Los tests con jsdom no cubren el `<dialog>` real (foco atrapado, Esc, `::backdrop`), así que esto se mira en pantalla:

1. `npm start`, entrar a `/configuracion/profesores`.
2. **El botón abre el modal** y el foco cae en el campo de email.
3. **Email inválido** → el aviso aparece y no se manda nada.
4. **Alta válida** → el modal cierra, el profesor aparece en la tabla ordenado por nombre, sale el toast.
5. **Alta repetida con el mismo email** → el modal queda abierto con «Ya existe un usuario con ese email».
6. **Esc y click en el backdrop** cierran el modal.

> **§3.1 — leer antes de probar:** si la cuenta de prueba se creó como `particular` y no como `club`, el paso 4 va a fallar siempre con «Tu cuenta no tiene configurado el rol de profesor», porque ese signup sólo crea el rol `superprofesor`. No es un bug del slice. Para probar el camino feliz hace falta una cuenta creada como club, o insertar el rol `profesor` a mano en la tabla `role` con el `club_id` correspondiente.

## Qué queda afuera (del spec §2)

Selector de rol · listar/editar/borrar usuarios · reenviar la contraseña temporal · arreglar la atomicidad de `POST /users` (es del backend).
