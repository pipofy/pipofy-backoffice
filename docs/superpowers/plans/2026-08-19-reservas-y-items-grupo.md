# Reservas e items de grupo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar el motor de reservas y la lista de espera que la API ya expone, más la carga de items de grupo de categoría que hoy hace que toda reserva devuelva 400.

**Architecture:** Slice vertical estándar del repo — DTO valibot en el borde HTTP, mapper, contrato abstracto en `domain`, repositorio HTTP en `data`, facade `SignalStore` y página standalone. Dos contratos nuevos (`ClassSessionsRepository`, `ReservationsRepository`), una feature nueva (`features/reservas`), un modal nuevo en Configuración, y un refactor de `HttpDashboardRepository` para que consuma el contrato nuevo en vez de pegarle crudo a `/class-sessions`.

**Tech Stack:** Angular 20 standalone + zoneless + signals, valibot, vitest + `TestBed`, eslint-plugin-boundaries.

**Spec:** [docs/superpowers/specs/2026-08-19-reservas-y-items-grupo-design.md](../specs/2026-08-19-reservas-y-items-grupo-design.md)

## Global Constraints

- **No se toca la API del repo hermano `pipofy-backend`.** Ninguna tarea edita nada fuera de este repositorio.
- **No se tocan `core/data/http/to-domain-error.ts` ni `domainErrorMessage()` de `core/domain/errors.ts`.** El `switch` de `domainErrorMessage` es exhaustivo sin `default`: agregar un `kind` rompe el build. 400 y 409 ya salen como `{kind:'domain', message}` con el texto del backend, que es el copy que queremos.
- **Capas (las impone eslint):** `domain` no importa `@angular/*` ni nada de `data`/`features`/`shared`. `data` importa `domain`. `features/*` importa `domain`/`data`/`shared`, **nunca** otra feature. `shared` sólo `shared`.
- **Comentarios y copy en español.** Nombres de feature en español, `core/` en inglés.
- Todo spec nuevo lleva `provideZonelessChangeDetection()` en los providers del `TestBed`.
- Los dobles son objetos planos casteados al contrato (`as CourtsRepository`). No hay librería de mocks.
- Prettier: `printWidth: 100`, `singleQuote: true`.
- Correr un spec solo: `npx ng test --include <ruta al spec>`. Toda la suite: `npm test`.
- Los ids de la API llegan **siempre como string** (el backend polyfillea `BigInt.prototype.toJSON`); las fechas, como ISO.
- Toda simplificación deliberada con techo conocido lleva comentario `ponytail:` nombrando el techo y su salida.

---

## Estructura de archivos

**Crear**

| Archivo | Responsabilidad |
|---|---|
| `src/app/core/domain/entities/class-session.ts` | Entidad `ClassSession` |
| `src/app/core/domain/entities/waiting-list.ts` | Entidad `WaitingListEntry` |
| `src/app/core/domain/entities/reservation.ts` | `Reservation`, `ReservationDraft`, `createReservationDraft` |
| `src/app/core/domain/contracts/class-sessions.repository.ts` | Contrato: sesiones + lista de espera |
| `src/app/core/domain/contracts/reservations.repository.ts` | Contrato: ciclo de vida de la reserva |
| `src/app/core/data/mappers/class-session.mapper.ts` | DTO → `ClassSession` / `WaitingListEntry` |
| `src/app/core/data/mappers/reservation.mapper.ts` | DTO → `Reservation` |
| `src/app/core/data/repositories/http-class-sessions.repository.ts` | HTTP + ventana ±1 día |
| `src/app/core/data/repositories/http-reservations.repository.ts` | HTTP del ciclo de la reserva |
| `src/app/features/configuracion/grupos-categoria/grupo-items-store.ts` | Pista de asignación en `localStorage` |
| `src/app/features/configuracion/grupos-categoria/grupo-items.facade.ts` | Escrituras de items |
| `src/app/features/configuracion/grupos-categoria/grupo-items-modal.component.ts` | Modal de checkboxes |
| `src/app/features/reservas/reservas.routes.ts` | Ruta lazy + providers |
| `src/app/features/reservas/reservas.providers.ts` | Bindings de repositorios |
| `src/app/features/reservas/reservas.facade.ts` | Sesiones de la fecha elegida |
| `src/app/features/reservas/sesion.facade.ts` | Lista de espera + holds pendientes |
| `src/app/features/reservas/hold-countdown.ts` | `minutosRestantes`, función pura |
| `src/app/features/reservas/pages/reservas-page.component.{ts,html,css}` | Tabla + selector de fecha |
| `src/app/features/reservas/components/sesion-modal.component.ts` | Los tres bloques del modal |

**Modificar**

| Archivo | Cambio |
|---|---|
| `src/app/core/domain/errors.ts` | + `InvalidReservationError` |
| `src/app/core/domain/local-date.ts` | + `isOnLocalDate` (mudada desde `dashboard.mapper.ts`) |
| `src/app/core/domain/contracts/category-groups.repository.ts` | + `addItem`, `removeItem` |
| `src/app/core/data/dto/class-session.dto.ts` | + `ReservationDtoSchema`; `WaitingListDtoSchema` pasa a validar campos |
| `src/app/core/data/repositories/http-category-groups.repository.ts` | + los dos métodos idempotentes |
| `src/app/core/data/repositories/http-dashboard.repository.ts` | Consume `ClassSessionsRepository` |
| `src/app/core/data/mappers/dashboard.mapper.ts` | Recibe `ClassSession[]`; pierde `isOnLocalDate` |
| `src/app/features/dashboard/dashboard.providers.ts` | + binding de `ClassSessionsRepository` |
| `src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.ts` | `remove()` limpia el store |
| `src/app/features/configuracion/grupos-categoria/grupos-categoria-page.component.{ts,html}` | Botón *Categorías* |
| `src/app/features/configuracion/configuracion.routes.ts` | Provee `GrupoItemsFacade` |
| `src/app/app.routes.ts` | Ruta `/reservas` |
| `src/app/layout/nav.model.ts` | `NavIcon` `'reservas'` + `NavItem` |
| `src/app/layout/shell.component.html` | `@case ('reservas')` con su `<svg>` |

---

### Task 1: Items de grupo — contrato y repositorio idempotente

Es el prerequisito duro de todo el resto: `ClassSessionsService.reserve()` y `WaitingListService.join()` rechazan con 400 si la categoría del alumno no está en el `categoryGroup` de la sesión, y `prisma/seed.ts` no siembra ningún `category_group_item`.

**Files:**
- Modify: `src/app/core/domain/contracts/category-groups.repository.ts`
- Modify: `src/app/core/data/repositories/http-category-groups.repository.ts`
- Test: `src/app/core/data/repositories/http-category-groups.repository.spec.ts`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `CategoryGroupsRepository.addItem(groupId: string, categoryId: string): Promise<void>` y `removeItem(groupId: string, categoryId: string): Promise<void>`, ambos **idempotentes**: no lanzan si el estado final ya era el pedido.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/app/core/data/repositories/http-category-groups.repository.spec.ts`. El `setup()` existente sólo provee un doble de `ApiClient`; estos métodos usan `HttpClient` directo, así que hace falta un setup propio:

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';   // si el archivo ya importa `of`, sumar sólo throwError
import { API_CONFIG } from '../config/api-config.token';

interface HttpCall { readonly method: string; readonly url: string; readonly body?: unknown }

function setupItems(fail?: HttpErrorResponse) {
  const calls: HttpCall[] = [];
  const http = {
    post: (url: string, body: unknown) => {
      calls.push({ method: 'post', url, body });
      return fail ? throwError(() => fail) : of({});
    },
    delete: (url: string) => {
      calls.push({ method: 'delete', url });
      return fail ? throwError(() => fail) : of({});
    },
  } as unknown as HttpClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpCategoryGroupsRepository,
      { provide: ApiClient, useValue: {} as ApiClient },
      { provide: HttpClient, useValue: http },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
    ],
  });
  return { repo: TestBed.inject(HttpCategoryGroupsRepository), calls };
}

describe('HttpCategoryGroupsRepository.addItem', () => {
  it('postea la categoría al grupo', async () => {
    const { repo, calls } = setupItems();
    await repo.addItem('7', '3');
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/api/category-groups/7/items',
      body: { categoryId: '3' },
    });
  });

  it('un 409 NO lanza: la categoría ya estaba, el estado final es el pedido', async () => {
    // Es la pieza que sostiene todo el modal: sin poder LEER la asignación, la única forma
    // de que la vista se autocorrija es que "ya estaba" cuente como éxito.
    const { repo } = setupItems(new HttpErrorResponse({ status: 409 }));
    await expect(repo.addItem('7', '3')).resolves.toBeUndefined();
  });

  it('un 400 sí lanza, con el mensaje del backend', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'categoryId inválido: no pertenece a este club' },
    });
    const { repo } = setupItems(err);
    await expect(repo.addItem('7', '3')).rejects.toEqual({
      kind: 'domain',
      message: 'categoryId inválido: no pertenece a este club',
    });
  });
});

describe('HttpCategoryGroupsRepository.removeItem', () => {
  it('borra la categoría del grupo', async () => {
    const { repo, calls } = setupItems();
    await repo.removeItem('7', '3');
    expect(calls[0]).toEqual({ method: 'delete', url: '/api/category-groups/7/items/3' });
  });

  it('un 404 NO lanza: la categoría no estaba, el estado final es el pedido', async () => {
    const { repo } = setupItems(new HttpErrorResponse({ status: 404 }));
    await expect(repo.removeItem('7', '3')).resolves.toBeUndefined();
  });

  it('un 403 sí lanza', async () => {
    const { repo } = setupItems(new HttpErrorResponse({ status: 403 }));
    await expect(repo.removeItem('7', '3')).rejects.toEqual({ kind: 'forbidden' });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx ng test --include src/app/core/data/repositories/http-category-groups.repository.spec.ts`
Expected: FAIL — `repo.addItem is not a function`.

- [ ] **Step 3: Agregar los métodos al contrato**

En `src/app/core/domain/contracts/category-groups.repository.ts`, dentro de la clase abstracta:

```ts
  /**
   * IDEMPOTENTES POR CONTRATO: `addItem` no falla si la categoría ya estaba, y `removeItem`
   * no falla si no estaba. En los dos casos el estado final es el que se pidió.
   *
   * No es cosmético. Ningún GET del backend devuelve los items de un grupo
   * (`CategoryGroupsService.list()` y `getOne()` son findMany/findUnique pelados), así que la
   * pantalla no puede leer la asignación y trabaja con una pista guardada en el navegador.
   * Que "ya estaba" y "no estaba" cuenten como éxito es lo que hace que esa pista se corrija
   * sola con cada click en vez de quedar mintiendo para siempre.
   */
  abstract addItem(groupId: string, categoryId: string): Promise<void>;
  abstract removeItem(groupId: string, categoryId: string): Promise<void>;
```

- [ ] **Step 4: Implementar en el repositorio HTTP**

En `src/app/core/data/repositories/http-category-groups.repository.ts`, agregar imports y métodos:

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_CONFIG } from '../config/api-config.token';
```

Dentro de la clase, junto a `private readonly api = inject(ApiClient);`:

```ts
  /**
   * `HttpClient` directo y NO `ApiClient` para los dos métodos de items: `ApiClient` normaliza
   * a `DomainError` en su `catchError`, y ahí un 409 y un 400 llegan los dos como
   * `{kind:'domain'}` — indistinguibles, justo lo que estos métodos necesitan distinguir.
   *
   * Es el mismo movimiento y el mismo motivo que documenta `http-auth.repository.ts`: el
   * significado de un código HTTP depende del endpoint, así que el mapeo específico vive en el
   * repositorio y `to-domain-error.ts` no se toca.
   */
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_CONFIG).apiBaseUrl;

  async addItem(groupId: string, categoryId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/category-groups/${groupId}/items`, { categoryId }),
      );
    } catch (err) {
      // 409 = 'La categoría ya está en el grupo'. Ver el contrato: es éxito, no error.
      if (err instanceof HttpErrorResponse && err.status === 409) return;
      throw toDomainError(err);
    }
  }

  async removeItem(groupId: string, categoryId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/category-groups/${groupId}/items/${categoryId}`),
      );
    } catch (err) {
      // 404 = 'La categoría no está en el grupo'. Idem: el estado final es el pedido.
      if (err instanceof HttpErrorResponse && err.status === 404) return;
      throw toDomainError(err);
    }
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx ng test --include src/app/core/data/repositories/http-category-groups.repository.spec.ts`
Expected: PASS, incluidos los tests que ya existían.

- [ ] **Step 6: Verificar capas y commit**

Run: `npm run lint`
Expected: sin errores de `boundaries`.

```bash
git add src/app/core/domain/contracts/category-groups.repository.ts \
        src/app/core/data/repositories/http-category-groups.repository.ts \
        src/app/core/data/repositories/http-category-groups.repository.spec.ts
git commit -m "feat(data): items de grupo de categoría, idempotentes por contrato"
```

---

### Task 2: Store de la pista de asignación

**Files:**
- Create: `src/app/features/configuracion/grupos-categoria/grupo-items-store.ts`
- Test: `src/app/features/configuracion/grupos-categoria/grupo-items-store.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: clase `GrupoItemsStore` con `read(groupId: string): string[]`, `write(groupId: string, categoryIds: readonly string[]): void`, `forget(groupId: string): void`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/features/configuracion/grupos-categoria/grupo-items-store.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GrupoItemsStore } from './grupo-items-store';

describe('GrupoItemsStore', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve [] para un grupo del que no sabe nada', () => {
    expect(new GrupoItemsStore().read('7')).toEqual([]);
  });

  it('round-trip por grupo, sin pisar a los vecinos', () => {
    const store = new GrupoItemsStore();
    store.write('7', ['1', '3']);
    store.write('8', ['2']);
    expect(store.read('7')).toEqual(['1', '3']);
    expect(store.read('8')).toEqual(['2']);
  });

  it('forget() borra sólo ese grupo', () => {
    const store = new GrupoItemsStore();
    store.write('7', ['1']);
    store.write('8', ['2']);
    store.forget('7');
    expect(store.read('7')).toEqual([]);
    expect(store.read('8')).toEqual(['2']);
  });

  it('un valor corrupto en storage devuelve [] en vez de tirar', () => {
    // La pista es decorativa: si el storage quedó sucio, la pantalla arranca sin pista y se
    // corrige al primer click. Tirar acá tumbaría el modal entero por un dato de adorno.
    localStorage.setItem('PipoFy:grupo-items:v1', '{no es json');
    expect(new GrupoItemsStore().read('7')).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupo-items-store.spec.ts`
Expected: FAIL — no existe `./grupo-items-store`.

- [ ] **Step 3: Implementar**

Crear `src/app/features/configuracion/grupos-categoria/grupo-items-store.ts`:

```ts
import { Injectable } from '@angular/core';

const LS_KEY = 'PipoFy:grupo-items:v1';

type Snapshot = Record<string, string[]>;

/**
 * Qué categorías tiene cada grupo, SEGÚN ESTE NAVEGADOR.
 *
 * No es un cache de la API: es una pista. Ningún endpoint del backend devuelve los items de un
 * grupo, así que sin esto el modal no tendría nada que mostrar. Puede estar desactualizada
 * (otro navegador, otro usuario, una carga por SQL) y el modal lo dice al pie; el repositorio
 * la corrige sola tratando el 409 y el 404 como éxito.
 *
 * `localStorage` y no `sessionStorage` — a diferencia de OnboardingPersistenceService, que
 * persiste el borrador de UN wizard —: la asignación se carga una vez y tiene que seguir ahí
 * la semana que viene.
 *
 * Todo va envuelto en try/catch porque el storage puede estar lleno, bloqueado por el navegador
 * o sucio de una versión anterior, y ninguna de esas tres cosas justifica tumbar la pantalla.
 */
@Injectable()
export class GrupoItemsStore {
  read(groupId: string): string[] {
    return this.all()[groupId] ?? [];
  }

  write(groupId: string, categoryIds: readonly string[]): void {
    const next = { ...this.all(), [groupId]: [...categoryIds] };
    this.persist(next);
  }

  forget(groupId: string): void {
    const next = this.all();
    delete next[groupId];
    this.persist(next);
  }

  private all(): Snapshot {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? (parsed as Snapshot) : {};
    } catch {
      return {};
    }
  }

  private persist(snapshot: Snapshot): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage lleno o bloqueado: la pista se pierde, el modal sigue funcionando */
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupo-items-store.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/configuracion/grupos-categoria/grupo-items-store.ts \
        src/app/features/configuracion/grupos-categoria/grupo-items-store.spec.ts
git commit -m "feat(configuracion): store de la pista de items de grupo"
```

---

### Task 3: Modal de items — facade, componente y enganche en la página

**Files:**
- Create: `src/app/features/configuracion/grupos-categoria/grupo-items.facade.ts`
- Create: `src/app/features/configuracion/grupos-categoria/grupo-items-modal.component.ts`
- Modify: `src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.ts`
- Modify: `src/app/features/configuracion/grupos-categoria/grupos-categoria-page.component.ts`
- Modify: `src/app/features/configuracion/grupos-categoria/grupos-categoria-page.component.html`
- Modify: `src/app/features/configuracion/configuracion.routes.ts`
- Test: `src/app/features/configuracion/grupos-categoria/grupo-items.facade.spec.ts`
- Test: `src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.spec.ts` (agregar un caso)

**Interfaces:**
- Consumes: `CategoryGroupsRepository.addItem/removeItem` (Task 1), `GrupoItemsStore` (Task 2).
- Produces: `GrupoItemsFacade` con `open(groupId: string): void`, `selected(): readonly string[]`, `toggle(categoryId: string, next: boolean): Promise<void>`, `clearError(): void`, y `error()` heredado de `SignalStore`.

- [ ] **Step 1: Escribir el test de la facade**

Crear `src/app/features/configuracion/grupos-categoria/grupo-items.facade.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GrupoItemsFacade } from './grupo-items.facade';
import { GrupoItemsStore } from './grupo-items-store';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';

function setup(over: Partial<CategoryGroupsRepository> = {}) {
  const calls: string[] = [];
  const repo = {
    addItem: async (_g: string, c: string) => { calls.push(`add:${c}`); },
    removeItem: async (_g: string, c: string) => { calls.push(`remove:${c}`); },
    ...over,
  } as CategoryGroupsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GrupoItemsFacade,
      GrupoItemsStore,
      { provide: CategoryGroupsRepository, useValue: repo },
    ],
  });
  return { facade: TestBed.inject(GrupoItemsFacade), calls };
}

describe('GrupoItemsFacade', () => {
  beforeEach(() => localStorage.clear());

  it('open() siembra la selección con la pista guardada', () => {
    const { facade } = setup();
    TestBed.inject(GrupoItemsStore).write('7', ['1', '3']);
    facade.open('7');
    expect(facade.selected()).toEqual(['1', '3']);
  });

  it('tildar agrega, persiste la pista y no deja error', async () => {
    const { facade, calls } = setup();
    facade.open('7');
    await facade.toggle('3', true);
    expect(calls).toEqual(['add:3']);
    expect(facade.selected()).toEqual(['3']);
    expect(TestBed.inject(GrupoItemsStore).read('7')).toEqual(['3']);
    expect(facade.error()).toBeNull();
  });

  it('destildar quita y persiste', async () => {
    const { facade, calls } = setup();
    TestBed.inject(GrupoItemsStore).write('7', ['1', '3']);
    facade.open('7');
    await facade.toggle('1', false);
    expect(calls).toEqual(['remove:1']);
    expect(facade.selected()).toEqual(['3']);
    expect(TestBed.inject(GrupoItemsStore).read('7')).toEqual(['3']);
  });

  it('si la escritura falla, la selección VUELVE atrás y queda el error', async () => {
    // Sin el rollback la checkbox mentiría con una categoría que la API rechazó.
    const { facade } = setup({
      addItem: () => Promise.reject({ kind: 'forbidden' as const }),
    });
    facade.open('7');
    await facade.toggle('3', true);
    expect(facade.selected()).toEqual([]);
    expect(facade.error()).toEqual({ kind: 'forbidden' });
    expect(TestBed.inject(GrupoItemsStore).read('7')).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupo-items.facade.spec.ts`
Expected: FAIL — no existe `./grupo-items.facade`.

- [ ] **Step 3: Implementar la facade**

Crear `src/app/features/configuracion/grupos-categoria/grupo-items.facade.ts`:

```ts
import { Injectable, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { GrupoItemsStore } from './grupo-items-store';

/**
 * Las categorías de UN grupo. Separada de GruposCategoriaFacade a propósito, igual que
 * AlumnoPlanesFacade: SignalStore tiene una sola tríada data/loading/error, y con una sola
 * facade tildar una checkbox prendería el spinner de la tabla de grupos.
 *
 * `data` es la selección visible. No viene de la API — no hay GET que devuelva los items —,
 * sale de la pista del navegador y se corrige con cada escritura.
 */
@Injectable()
export class GrupoItemsFacade extends SignalStore<string[], DomainError> {
  private readonly repo = inject(CategoryGroupsRepository);
  private readonly store = inject(GrupoItemsStore);

  private readonly _groupId = signal<string | null>(null);

  selected(): readonly string[] {
    return this.data() ?? [];
  }

  open(groupId: string): void {
    this._groupId.set(groupId);
    this.setError(null);
    this.setData(this.store.read(groupId));
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * Optimista con rollback: la checkbox se pinta antes de salir a la red y vuelve atrás si la
   * API rechaza. `addItem`/`removeItem` son idempotentes por contrato, así que un 409 o un 404
   * —la pista estaba desactualizada— llegan acá como éxito y la vista termina en la verdad.
   *
   * No usa run(): run() reemplaza `data` con lo que resuelve la promesa, y acá el valor nuevo
   * se conoce ANTES de la escritura. Lo que sí se replica es su contrato: nunca rechaza, el
   * fallo queda en error().
   */
  async toggle(categoryId: string, next: boolean): Promise<void> {
    const groupId = this._groupId();
    if (groupId === null) return;

    const before = this.selected();
    const after = next
      ? [...before, categoryId]
      : before.filter((id) => id !== categoryId);

    this.setError(null);
    this.setData([...after]);
    try {
      await (next
        ? this.repo.addItem(groupId, categoryId)
        : this.repo.removeItem(groupId, categoryId));
      this.store.write(groupId, after);
    } catch (err) {
      this.setData([...before]);
      this.setError(toDomainError(err));
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupo-items.facade.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Escribir el test de la limpieza al borrar un grupo**

Agregar a `src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.spec.ts`:

```ts
it('remove() olvida también la pista de items del grupo', async () => {
  // Sin esto, crear un grupo nuevo que reusa un id liberado heredaría la pista del borrado.
  const { facade } = setup();
  const store = TestBed.inject(GrupoItemsStore);
  store.write('1', ['3']);
  await facade.remove('1');
  expect(store.read('1')).toEqual([]);
});
```

En el `setup()` de ese archivo hay que sumar `GrupoItemsStore` a los `providers` e importarlo:

```ts
import { GrupoItemsStore } from './grupo-items-store';
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.spec.ts`
Expected: FAIL — la pista sigue en `['3']`.

- [ ] **Step 7: Limpiar la pista en `remove()`**

En `src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.ts`, agregar el import y el inject:

```ts
import { GrupoItemsStore } from './grupo-items-store';
```

```ts
  private readonly items = inject(GrupoItemsStore);
```

y reemplazar `remove()`:

```ts
  remove(id: string): Promise<void> {
    return this.run(
      this.repo
        .remove(id)
        // La pista de items vive en el navegador y el backend no la conoce: si no se borra acá,
        // queda huérfana para siempre.
        .then(() => this.items.forget(id))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npx ng test --include src/app/features/configuracion/grupos-categoria/grupos-categoria.facade.spec.ts`
Expected: PASS.

- [ ] **Step 9: Crear el modal**

Crear `src/app/features/configuracion/grupos-categoria/grupo-items-modal.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { Category } from '@domain/entities/category';
import { CategoryGroup } from '@domain/entities/category-group';
import { GrupoItemsFacade } from './grupo-items.facade';
import { domainErrorMessage } from '@domain/errors';

/**
 * Qué categorías arma este grupo. Es la pantalla que desbloquea reservar: el backend valida
 * la categoría del alumno contra los items del grupo, y sin items rechaza todo con un 400.
 *
 * El pie dice la verdad incómoda a propósito: la API no devuelve la asignación, así que esto
 * muestra lo cargado desde este navegador. Esconderlo haría que un desfase parezca un bug.
 */
@Component({
  selector: 'app-grupo-items-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Categorías del grupo" [subtitle]="group()?.name ?? ''" icon="primary">
      @if (errorText()) { <p class="notice hold form-error" role="alert">{{ errorText() }}</p> }

      @for (cat of categories(); track cat.id) {
        <div class="field field-dense field-check">
          <input
            type="checkbox"
            [id]="'cat-' + cat.id"
            [checked]="isSelected(cat.id)"
            (change)="onToggle(cat.id, $event)" />
          <label [for]="'cat-' + cat.id">{{ cat.name || '(sin nombre)' }}</label>
        </div>
      } @empty {
        <p class="a-empty">Todavía no cargaste ninguna categoría.</p>
      }

      <p class="m-sub hint">
        La API no devuelve qué categorías tiene un grupo: esta lista recuerda lo que cargaste
        desde este navegador y se corrige sola al tildar o destildar.
      </p>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cerrar</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .form-error{margin-bottom:var(--space-md)}
    .field-check{display:flex;align-items:center;gap:var(--space-sm)}
    .hint{margin-top:var(--space-md)}
  `],
})
export class GrupoItemsModalComponent {
  readonly categories = input.required<readonly Category[]>();

  protected readonly facade = inject(GrupoItemsFacade);
  private readonly modal = viewChild.required(ModalComponent);

  /** Sólo para el subtítulo. Lo pone open() por parámetro, igual que el form modal. */
  protected readonly group = signal<CategoryGroup | null>(null);

  open(group: CategoryGroup): void {
    this.group.set(group);
    this.facade.open(group.id);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected isSelected(categoryId: string): boolean {
    return this.facade.selected().includes(categoryId);
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onToggle(categoryId: string, e: Event): void {
    void this.facade.toggle(categoryId, (e.target as HTMLInputElement).checked);
  }
}
```

- [ ] **Step 10: Enganchar el modal en la página**

En `src/app/features/configuracion/grupos-categoria/grupos-categoria-page.component.ts`: agregar a `imports` `GrupoItemsModalComponent`, y dentro de la clase:

```ts
  private readonly items = viewChild.required(GrupoItemsModalComponent);
  private readonly categoriesRepo = inject(CategoriesRepository);
  protected readonly categories = signal<readonly Category[]>([]);

  protected openItems(group: CategoryGroup): void {
    this.items().open(group);
  }
```

En el constructor, junto a lo que ya hay:

```ts
    // Fallan en silencio, igual que los catálogos de canchas: sin categorías el modal queda
    // vacío, pero la tabla de grupos sigue siendo usable.
    void this.categoriesRepo.list().then((v) => this.categories.set(v)).catch(() => undefined);
```

Con los imports:

```ts
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category } from '@domain/entities/category';
import { GrupoItemsModalComponent } from './grupo-items-modal.component';
```

En `grupos-categoria-page.component.html`, agregar el botón como PRIMERO de la celda de acciones:

```html
                <button type="button" class="btn btn-ghost btn-sm" (click)="openItems(group)">Categorías</button>
```

y al final del archivo:

```html
<app-grupo-items-modal [categories]="categories()" />
```

- [ ] **Step 11: Proveer la facade y el store en la ruta**

En `src/app/features/configuracion/configuracion.routes.ts`, agregar a los `providers` del padre — junto a `GruposCategoriaFacade`, porque `GruposCategoriaFacade.remove()` ahora inyecta el store:

```ts
      GrupoItemsFacade,
      GrupoItemsStore,
```

con sus imports:

```ts
import { GrupoItemsFacade } from './grupos-categoria/grupo-items.facade';
import { GrupoItemsStore } from './grupos-categoria/grupo-items-store';
```

- [ ] **Step 12: Correr toda la suite y el lint**

Run: `npm test`
Expected: PASS. En particular `grupos-categoria-page.component.spec.ts`, que monta la página y ahora resuelve dos providers nuevos.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 13: Commit**

```bash
git add src/app/features/configuracion
git commit -m "feat(configuracion): modal de categorías por grupo"
```

---

### Task 4: Entidades, DTOs y mappers del slice de reservas

**Files:**
- Create: `src/app/core/domain/entities/class-session.ts`
- Create: `src/app/core/domain/entities/waiting-list.ts`
- Create: `src/app/core/domain/entities/reservation.ts`
- Modify: `src/app/core/domain/errors.ts`
- Modify: `src/app/core/data/dto/class-session.dto.ts`
- Create: `src/app/core/data/mappers/class-session.mapper.ts`
- Create: `src/app/core/data/mappers/reservation.mapper.ts`
- Test: `src/app/core/domain/entities/reservation.spec.ts`
- Test: `src/app/core/data/mappers/class-session.mapper.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ClassSession { id, courtId, coachId, categoryGroupId, startAt: string|null, capacity: number, availableSpots: number }`
  - `WaitingListEntry { id, studentId, requestedAt: string|null }`
  - `Reservation { id, holdExpiresAt: string|null }`
  - `ReservationInput { sessionId, studentId, studentPlanId }` (strings, `''` = vacío)
  - `ReservationDraft { sessionId, studentId, studentPlanId }`
  - `createReservationDraft(input: ReservationInput): ReservationDraft`
  - `toClassSession(dto)`, `toWaitingListEntry(dto)`, `toReservation(dto)`
  - `ReservationDtoSchema`, `WaitingListEntryDtoSchema`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/app/core/domain/entities/reservation.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createReservationDraft } from './reservation';
import { InvalidReservationError } from '../errors';

const input = { sessionId: '10', studentId: '4', studentPlanId: '9' };

describe('createReservationDraft', () => {
  it('devuelve el draft cuando están los tres datos', () => {
    expect(createReservationDraft(input)).toEqual(input);
  });

  it('exige alumno', () => {
    expect(() => createReservationDraft({ ...input, studentId: '' }))
      .toThrow(InvalidReservationError);
  });

  it('exige plan: sin plan la reserva no se puede confirmar', () => {
    // `ReservationsService.confirm()` responde 409 'Requiere pago manual' si la reserva no
    // tiene plan con créditos, y confirm-payment está bloqueado (no hay catálogo de métodos
    // de pago). Un hold sin plan es un cupo tomado que nadie puede cerrar.
    expect(() => createReservationDraft({ ...input, studentPlanId: '' }))
      .toThrow('Elegí un plan con créditos: sin plan la reserva no se puede confirmar.');
  });
});
```

Crear `src/app/core/data/mappers/class-session.mapper.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toClassSession, toWaitingListEntry } from './class-session.mapper';

describe('toClassSession', () => {
  it('mapea la fila tal cual', () => {
    expect(toClassSession({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
    })).toEqual({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
    });
  });

  it('normaliza capacity null a 0', () => {
    // `ClassSession.capacity` es nullable en Prisma. La normalización vive acá y no en cada
    // pantalla para que "cupo" sea siempre un número.
    expect(toClassSession({
      id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
      startAt: null, capacity: null, availableSpots: 0,
    }).capacity).toBe(0);
  });
});

describe('toWaitingListEntry', () => {
  it('mapea id, alumno y fecha de pedido', () => {
    expect(toWaitingListEntry({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' }))
      .toEqual({ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' });
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx ng test --include src/app/core/domain/entities/reservation.spec.ts`
Expected: FAIL — no existe `./reservation`.

- [ ] **Step 3: Crear las entidades**

`src/app/core/domain/entities/class-session.ts`:

```ts
/**
 * Una clase de la agenda: `GET /class-sessions`.
 *
 * `startAt` queda como el ISO CRUDO del backend, sin parsear: quién lo interpreta decide en
 * qué zona hacerlo, y el proyecto ya se quemó dos veces resolviendo eso en UTC (ver
 * local-date.ts). `capacity` sí se normaliza — es nullable en Prisma y ninguna pantalla
 * quiere pensar en un cupo que no existe.
 */
export interface ClassSession {
  readonly id: string;
  readonly courtId: string;
  readonly coachId: string;
  readonly categoryGroupId: string;
  readonly startAt: string | null;
  readonly capacity: number;
  /** Calculado por el backend: capacity − (confirmadas + held vigentes). */
  readonly availableSpots: number;
}

/** Lugares tomados. `capacity - availableSpots`, con piso en 0 por si el backend deriva. */
export function occupiedSpots(session: ClassSession): number {
  return Math.max(0, session.capacity - session.availableSpots);
}
```

`src/app/core/domain/entities/waiting-list.ts`:

```ts
/**
 * Una anotación en la lista de espera de una clase: `GET /class-sessions/:id/waiting-list`,
 * que devuelve sólo las que están en estado 'esperando'.
 *
 * `id` es el de la ANOTACIÓN, no el del alumno: es lo que pide `DELETE /waiting-list/:id`.
 * El nombre del alumno no viene — el backend no incluye la relación —, así que la pantalla
 * lo resuelve contra la lista de alumnos que ya tiene cargada.
 */
export interface WaitingListEntry {
  readonly id: string;
  readonly studentId: string;
  readonly requestedAt: string | null;
}
```

`src/app/core/domain/entities/reservation.ts`:

```ts
import { InvalidReservationError } from '../errors';

/**
 * Lo que devuelve `POST /class-sessions/:id/reservations`, recortado a lo que el front no
 * puede saber por su cuenta.
 *
 * Dos campos y no doce a propósito: el alumno y la clase ya los tiene la pantalla en memoria.
 * Lo único que sólo la API sabe es el id de la reserva —imprescindible, porque NO existe
 * `GET /reservations` y este es el único momento en que el front lo ve— y hasta cuándo vive
 * el hold.
 */
export interface Reservation {
  readonly id: string;
  readonly holdExpiresAt: string | null;
}

/** Lo que sale de los selects del modal: vacío es '', no null. */
export interface ReservationInput {
  readonly sessionId: string;
  readonly studentId: string;
  readonly studentPlanId: string;
}

export interface ReservationDraft {
  readonly sessionId: string;
  readonly studentId: string;
  readonly studentPlanId: string;
}

/**
 * El plan es OBLIGATORIO, y no es una preferencia de UI.
 *
 * `ReservationsService.confirm()` exige que la reserva tenga un plan con créditos; sin eso
 * responde 409 'Requiere pago manual, usar /reservations/:id/confirm-payment', y ese endpoint
 * está bloqueado porque pide un `paymentMethodId` que ningún catálogo de la API expone.
 * Reservar sin plan es fabricar un cupo tomado que nadie puede confirmar y que se evapora
 * solo en 30 minutos.
 *
 * El modal ya deshabilita el botón; la entidad no confía en la UI.
 */
export function createReservationDraft(input: ReservationInput): ReservationDraft {
  if (!input.studentId) {
    throw new InvalidReservationError('Elegí un alumno.');
  }
  if (!input.studentPlanId) {
    throw new InvalidReservationError(
      'Elegí un plan con créditos: sin plan la reserva no se puede confirmar.',
    );
  }
  return {
    sessionId: input.sessionId,
    studentId: input.studentId,
    studentPlanId: input.studentPlanId,
  };
}
```

- [ ] **Step 4: Agregar el error de dominio**

En `src/app/core/domain/errors.ts`, junto a las demás subclases de `DomainRuleError`:

```ts
export class InvalidReservationError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReservationError';
  }
}
```

No se toca `domainErrorMessage()`: `toDomainError` ya convierte cualquier `DomainRuleError` en `{kind:'domain', message}`.

- [ ] **Step 5: Extender los DTOs**

En `src/app/core/data/dto/class-session.dto.ts`, **reemplazar** el bloque de `WaitingListDtoSchema` (su comentario dice que ningún consumidor lee los campos — a partir de acá sí) y agregar el de reserva:

```ts
/**
 * `GET /class-sessions/:id/waiting-list` devuelve las entradas en estado 'esperando' de UNA
 * sesión, como filas crudas de Prisma.
 *
 * Antes esto era `v.array(v.unknown())` porque el único consumidor —el dashboard— sólo usaba
 * el LARGO del array. La pantalla de reservas sí lee adentro: muestra al alumno y necesita el
 * `id` de la anotación para poder darla de baja.
 */
export const WaitingListEntryDtoSchema = v.object({
  id: v.string(),
  studentId: v.string(),
  requestedAt: v.nullable(v.string()),
});
export type WaitingListEntryDto = v.InferOutput<typeof WaitingListEntryDtoSchema>;

export const WaitingListDtoSchema = v.array(WaitingListEntryDtoSchema);

/**
 * Lo que devuelve `POST /class-sessions/:id/reservations`: la fila de Prisma entera. Se
 * declaran sólo los dos campos que la pantalla no puede reconstruir; valibot descarta el resto.
 */
export const ReservationDtoSchema = v.object({
  id: v.string(),
  holdExpiresAt: v.nullable(v.string()),
});
export type ReservationDto = v.InferOutput<typeof ReservationDtoSchema>;
```

- [ ] **Step 6: Crear los mappers**

`src/app/core/data/mappers/class-session.mapper.ts`:

```ts
import { ClassSession } from '@domain/entities/class-session';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { ClassSessionDto, WaitingListEntryDto } from '../dto/class-session.dto';

export function toClassSession(dto: ClassSessionDto): ClassSession {
  return {
    id: dto.id,
    courtId: dto.courtId,
    coachId: dto.coachId,
    categoryGroupId: dto.categoryGroupId,
    startAt: dto.startAt,
    // Nullable en Prisma; normalizado acá para que ninguna pantalla tenga que decidirlo.
    capacity: dto.capacity ?? 0,
    availableSpots: dto.availableSpots,
  };
}

export function toWaitingListEntry(dto: WaitingListEntryDto): WaitingListEntry {
  return { id: dto.id, studentId: dto.studentId, requestedAt: dto.requestedAt };
}
```

`src/app/core/data/mappers/reservation.mapper.ts`:

```ts
import { Reservation } from '@domain/entities/reservation';
import { ReservationDto } from '../dto/class-session.dto';

export function toReservation(dto: ReservationDto): Reservation {
  return { id: dto.id, holdExpiresAt: dto.holdExpiresAt };
}
```

- [ ] **Step 7: Correr y verificar que pasan**

Run: `npx ng test --include src/app/core/domain/entities/reservation.spec.ts`
Expected: PASS, 3 tests.

Run: `npx ng test --include src/app/core/data/mappers/class-session.mapper.spec.ts`
Expected: PASS, 3 tests.

Run: `npm test`
Expected: PASS. `http-dashboard.repository.ts` hace `v.parse(WaitingListDtoSchema, raw).length` y ahora el schema valida campos: si algún fixture de su spec devuelve entradas vacías, hay que darles `id`, `studentId` y `requestedAt`.

- [ ] **Step 8: Commit**

```bash
git add src/app/core/domain src/app/core/data
git commit -m "feat(domain): entidades y mappers de clase, reserva y lista de espera"
```

---

### Task 5: `ClassSessionsRepository` con la ventana ±1 día

**Files:**
- Create: `src/app/core/domain/contracts/class-sessions.repository.ts`
- Create: `src/app/core/data/repositories/http-class-sessions.repository.ts`
- Modify: `src/app/core/domain/local-date.ts` (recibe `isOnLocalDate`)
- Modify: `src/app/core/domain/local-date.spec.ts` (recibe sus tests)
- Modify: `src/app/core/data/mappers/dashboard.mapper.ts` (deja de exportarla)
- Modify: `src/app/core/data/mappers/dashboard.mapper.spec.ts` (saca esos tests)
- Modify: `src/app/core/data/repositories/http-dashboard.repository.ts` (import nuevo)
- Test: `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`

**Interfaces:**
- Consumes: `ClassSession`, `WaitingListEntry`, `toClassSession`, `toWaitingListEntry` (Task 4).
- Produces: `ClassSessionsRepository` abstracta con `list(dateKey: string): Promise<ClassSession[]>`, `waitingList(sessionId: string): Promise<WaitingListEntry[]>`, `joinWaitingList(sessionId: string, studentId: string): Promise<void>`, `leaveWaitingList(entryId: string): Promise<void>`. Y `isOnLocalDate(startAt: string|null, dateKey: string): boolean` exportada ahora desde `@domain/local-date`.

- [ ] **Step 1: Mudar `isOnLocalDate` a `local-date.ts`**

Es un movimiento mecánico: la función ya existe en `dashboard.mapper.ts` y va a tener un segundo consumidor en `data` que no debería importar del mapper del dashboard.

Cortar la función y su docstring de `src/app/core/data/mappers/dashboard.mapper.ts` y pegarla al final de `src/app/core/domain/local-date.ts`, agregando arriba:

```ts
/**
 * ¿Este `startAt` crudo del backend cae en `dateKey`, en hora LOCAL?
 *
 * Vive junto a localDateKey porque es la otra mitad de la misma pregunta, y en `domain`
 * porque la usan `data` (el repositorio de clases, para recortar la ventana ±1 día) y el
 * mapper del dashboard. Estuvo escrita dos veces y ya había divergido una vez.
 *
 * Tolera `null` y basura porque `startAt` es nullable en Prisma y nadie lo valida del otro
 * lado. No avisa por consola a propósito: quien la llama distingue el motivo del descarte.
 */
export function isOnLocalDate(startAt: string | null, dateKey: string): boolean {
  if (startAt === null) return false;
  const at = new Date(startAt);
  return !Number.isNaN(at.getTime()) && localDateKey(at) === dateKey;
}
```

En `src/app/core/data/repositories/http-dashboard.repository.ts`, cambiar el import:

```ts
import { localDateKey, isOnLocalDate } from '@domain/local-date';
import { toDashboardSnapshot } from '../mappers/dashboard.mapper';
```

Mover los `describe`/`it` de `isOnLocalDate` de `dashboard.mapper.spec.ts` a `local-date.spec.ts`, ajustando el import a `./local-date`.

- [ ] **Step 2: Correr la suite para confirmar que la mudanza no cambió nada**

Run: `npm test`
Expected: PASS, misma cantidad de tests que antes.

- [ ] **Step 3: Escribir el test que falla**

Crear `src/app/core/data/repositories/http-class-sessions.repository.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpClassSessionsRepository } from './http-class-sessions.repository';
import { ApiClient } from '../http/api-client';

interface Call { readonly method: string; readonly path: string; readonly body?: unknown }

function setup(responses: Partial<Record<'get' | 'post' | 'delete', Observable<unknown>>> = {}) {
  const calls: Call[] = [];
  const api = {
    get: (path: string) => { calls.push({ method: 'get', path }); return responses.get ?? of([]); },
    post: (path: string, body: unknown) => { calls.push({ method: 'post', path, body }); return responses.post ?? of({}); },
    delete: (path: string) => { calls.push({ method: 'delete', path }); return responses.delete ?? of({}); },
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpClassSessionsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(HttpClassSessionsRepository), calls };
}

const session = (over: Record<string, unknown> = {}) => ({
  id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
  startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1, ...over,
});

describe('HttpClassSessionsRepository.list', () => {
  it('pide un día de más de cada lado', async () => {
    // `ClassSessionsService.list()` arma la ventana con new Date(`${from}T00:00:00Z`): la Z es
    // LITERAL, así que interpreta en UTC. Pidiendo sólo 2026-08-19 desde Argentina (UTC-3) se
    // pierden las clases de 21:00 a 23:59, que en UTC ya son del día 20.
    const { repo, calls } = setup();
    await repo.list('2026-08-19');
    expect(calls[0].path).toBe('/class-sessions?from=2026-08-18&to=2026-08-20');
  });

  it('cruza el fin de mes sin romperse', async () => {
    const { repo, calls } = setup();
    await repo.list('2026-08-31');
    expect(calls[0].path).toBe('/class-sessions?from=2026-08-30&to=2026-09-01');
  });

  it('filtra por fecha LOCAL y descarta lo que quedó fuera del día pedido', async () => {
    // El test-setup fija TZ=America/Argentina/Buenos_Aires: 21:00Z del 19 es 18:00 local del 19.
    const dentro = session({ id: 'dentro', startAt: '2026-08-19T21:00:00.000Z' });
    const fuera = session({ id: 'fuera', startAt: '2026-08-20T21:00:00.000Z' });
    const sinHora = session({ id: 'sin-hora', startAt: null });
    const { repo } = setup({ get: of([dentro, fuera, sinHora]) });
    const sessions = await repo.list('2026-08-19');
    expect(sessions.map((s) => s.id)).toEqual(['dentro']);
  });

  it('rechaza con un DomainError de validación si el payload deriva', async () => {
    const { repo } = setup({ get: of([{ id: 10 }]) });
    await expect(repo.list('2026-08-19')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpClassSessionsRepository — lista de espera', () => {
  it('lee las anotaciones de una sesión', async () => {
    const raw = [{ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' }];
    const { repo, calls } = setup({ get: of(raw) });
    expect(await repo.waitingList('10')).toEqual([
      { id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' },
    ]);
    expect(calls[0].path).toBe('/class-sessions/10/waiting-list');
  });

  it('anota a un alumno', async () => {
    const { repo, calls } = setup();
    await repo.joinWaitingList('10', '4');
    expect(calls[0]).toMatchObject({
      method: 'post',
      path: '/class-sessions/10/waiting-list',
      body: { studentId: '4' },
    });
  });

  it('da de baja una anotación por SU id, no por el del alumno', async () => {
    const { repo, calls } = setup();
    await repo.leaveWaitingList('77');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/waiting-list/77' });
  });

  it('propaga el mensaje del backend cuando el alumno ya estaba anotado', async () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { message: 'El alumno ya está en la lista de espera de esta clase' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.joinWaitingList('10', '4')).rejects.toEqual({
      kind: 'domain',
      message: 'El alumno ya está en la lista de espera de esta clase',
    });
  });
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `npx ng test --include src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
Expected: FAIL — no existe `./http-class-sessions.repository`.

- [ ] **Step 5: Crear el contrato**

`src/app/core/domain/contracts/class-sessions.repository.ts`:

```ts
import { ClassSession } from '../entities/class-session';
import { WaitingListEntry } from '../entities/waiting-list';

/**
 * Las clases de la agenda y su lista de espera. Clase abstracta por el mismo motivo que el
 * resto de los contratos: hace de token DI sin arrastrar @angular/core al dominio.
 *
 * `list` toma UNA fecha local ('yyyy-MM-dd') y no un rango: el ajuste de la ventana UTC del
 * backend es un detalle del borde HTTP y vive en la implementación, no en cada consumidor. Ya
 * estuvo repartido entre el repositorio del dashboard y su mapper.
 *
 * La lista de espera cuelga de acá, y no de un contrato propio, por el mismo criterio que puso
 * `/students/:id/plans` dentro de StudentsRepository: el endpoint es
 * `/class-sessions/:id/waiting-list` y un contrato aparte sólo agregaría un binding más.
 * `leaveWaitingList` es la excepción — pega a `/waiting-list/:id` — y se queda igual acá para
 * no partir en dos una operación y su inversa.
 */
export abstract class ClassSessionsRepository {
  abstract list(dateKey: string): Promise<ClassSession[]>;
  abstract waitingList(sessionId: string): Promise<WaitingListEntry[]>;
  abstract joinWaitingList(sessionId: string, studentId: string): Promise<void>;
  /** `entryId` es el id de la ANOTACIÓN (`WaitingListEntry.id`), no el del alumno. */
  abstract leaveWaitingList(entryId: string): Promise<void>;
}
```

- [ ] **Step 6: Implementar el repositorio**

`src/app/core/data/repositories/http-class-sessions.repository.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { isOnLocalDate, localDateKey } from '@domain/local-date';
import { ClassSessionListDtoSchema, WaitingListDtoSchema } from '../dto/class-session.dto';
import { toClassSession, toWaitingListEntry } from '../mappers/class-session.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/** 'yyyy-MM-dd' ± n días, en el calendario local. `new Date(y, m, d)` normaliza el desborde. */
function shiftDay(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera del
 * observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpClassSessionsRepository extends ClassSessionsRepository {
  private readonly api = inject(ApiClient);

  /**
   * `ClassSessionsService.list()` arma la ventana con new Date(`${from}T00:00:00Z`). La Z es
   * LITERAL: interpreta las fechas en UTC y no en la zona del club, así que pedir sólo "hoy"
   * desde Argentina pierde las clases de 21:00 a 23:59 — prime time. Se pide un día de más de
   * cada lado y se recorta acá con la fecha local exacta.
   *
   * El recorte vive en el repositorio y no en el consumidor a propósito: antes estaba repartido
   * entre `HttpDashboardRepository` (que pedía ±1 día) y `dashboard.mapper` (que filtraba), y
   * cualquier pantalla nueva tenía que acordarse de las dos mitades.
   */
  async list(dateKey: string): Promise<ClassSession[]> {
    try {
      const from = shiftDay(dateKey, -1);
      const to = shiftDay(dateKey, 1);
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions?from=${from}&to=${to}`),
      );
      return v
        .parse(ClassSessionListDtoSchema, raw)
        .filter((dto) => isOnLocalDate(dto.startAt, dateKey))
        .map(toClassSession);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async waitingList(sessionId: string): Promise<WaitingListEntry[]> {
    try {
      const raw = await firstValueFrom(
        this.api.get<unknown>(`/class-sessions/${sessionId}/waiting-list`),
      );
      return v.parse(WaitingListDtoSchema, raw).map(toWaitingListEntry);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async joinWaitingList(sessionId: string, studentId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${sessionId}/waiting-list`, { studentId }),
      );
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async leaveWaitingList(entryId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/waiting-list/${entryId}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx ng test --include src/app/core/data/repositories/http-class-sessions.repository.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 8: Lint y commit**

Run: `npm run lint`
Expected: sin errores.

```bash
git add src/app/core
git commit -m "feat(data): ClassSessionsRepository con la ventana UTC arreglada de raíz"
```

---

### Task 6: `ReservationsRepository`

**Files:**
- Create: `src/app/core/domain/contracts/reservations.repository.ts`
- Create: `src/app/core/data/repositories/http-reservations.repository.ts`
- Test: `src/app/core/data/repositories/http-reservations.repository.spec.ts`

**Interfaces:**
- Consumes: `Reservation`, `ReservationDraft`, `toReservation`, `ReservationDtoSchema` (Task 4).
- Produces: `ReservationsRepository` con `reserve(draft: ReservationDraft): Promise<Reservation>`, `confirm(id: string): Promise<void>`, `cancel(id: string): Promise<void>`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/core/data/repositories/http-reservations.repository.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpReservationsRepository } from './http-reservations.repository';
import { ApiClient } from '../http/api-client';

interface Call { readonly method: string; readonly path: string; readonly body?: unknown }

function setup(responses: Partial<Record<'post' | 'delete', Observable<unknown>>> = {}) {
  const calls: Call[] = [];
  const api = {
    post: (path: string, body: unknown) => {
      calls.push({ method: 'post', path, body });
      return responses.post ?? of({ id: '55', holdExpiresAt: '2026-08-19T21:30:00.000Z' });
    },
    delete: (path: string) => { calls.push({ method: 'delete', path }); return responses.delete ?? of({}); },
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpReservationsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(HttpReservationsRepository), calls };
}

const draft = { sessionId: '10', studentId: '4', studentPlanId: '9' };

describe('HttpReservationsRepository.reserve', () => {
  it('postea a la sesión y devuelve el id del hold', async () => {
    // Es el ÚNICO momento en que el front ve este id: no existe GET /reservations.
    const { repo, calls } = setup();
    expect(await repo.reserve(draft)).toEqual({
      id: '55',
      holdExpiresAt: '2026-08-19T21:30:00.000Z',
    });
    expect(calls[0]).toEqual({
      method: 'post',
      path: '/class-sessions/10/reservations',
      body: { studentId: '4', studentPlanId: '9' },
    });
  });

  it('no manda sessionId en el cuerpo: va en la URL y el ValidationPipe rechaza los extras', async () => {
    const { repo, calls } = setup();
    await repo.reserve(draft);
    expect(Object.keys(calls[0].body as object).sort()).toEqual(['studentId', 'studentPlanId'].sort());
  });

  it('propaga el mensaje del backend cuando no hay cupo', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'No hay cupo disponible' } });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.reserve(draft)).rejects.toEqual({
      kind: 'domain',
      message: 'No hay cupo disponible',
    });
  });

  it('propaga el 400 de categoría, que el front no puede prevenir', async () => {
    // No hay GET que devuelva los items de un grupo, así que el modal no puede filtrar el
    // select de alumnos por categoría: el mensaje del backend ES el feedback.
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'El alumno no pertenece a la categoría de esta clase' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.reserve(draft)).rejects.toEqual({
      kind: 'domain',
      message: 'El alumno no pertenece a la categoría de esta clase',
    });
  });
});

describe('HttpReservationsRepository.confirm / cancel', () => {
  it('confirm postea al endpoint de la reserva', async () => {
    const { repo, calls } = setup();
    await repo.confirm('55');
    expect(calls[0]).toMatchObject({ method: 'post', path: '/reservations/55/confirm' });
  });

  it('cancel borra la reserva', async () => {
    const { repo, calls } = setup();
    await repo.cancel('55');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/reservations/55' });
  });

  it('confirm propaga el 409 del hold vencido', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'El hold expiró' } });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.confirm('55')).rejects.toEqual({ kind: 'domain', message: 'El hold expiró' });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx ng test --include src/app/core/data/repositories/http-reservations.repository.spec.ts`
Expected: FAIL — no existe `./http-reservations.repository`.

- [ ] **Step 3: Crear el contrato**

`src/app/core/domain/contracts/reservations.repository.ts`:

```ts
import { Reservation, ReservationDraft } from '../entities/reservation';

/**
 * El ciclo de vida de una reserva: se toma el cupo (hold), y después se confirma o se cancela.
 *
 * `reserve` pega a `/class-sessions/:id/reservations` y aun así vive acá y no en
 * ClassSessionsRepository: el contrato se corta por CONCEPTO, y los tres pasos son el mismo
 * recorrido que hace la pantalla.
 *
 * DESVÍO CONSCIENTE de "las escrituras devuelven void": `reserve` devuelve la Reservation.
 * No existe `GET /reservations`, así que la respuesta de este POST es el único lugar del que
 * el front puede sacar el id — y sin id no hay confirm ni cancel posibles.
 *
 * OJO con `confirm`: el backend exige que la reserva tenga un plan con créditos. Si no, 409
 * 'Requiere pago manual' y no hay salida, porque confirm-payment pide un paymentMethodId que
 * ningún catálogo expone. Por eso `createReservationDraft` no deja armar un draft sin plan.
 */
export abstract class ReservationsRepository {
  abstract reserve(draft: ReservationDraft): Promise<Reservation>;
  abstract confirm(id: string): Promise<void>;
  abstract cancel(id: string): Promise<void>;
}
```

- [ ] **Step 4: Implementar el repositorio**

`src/app/core/data/repositories/http-reservations.repository.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { Reservation, ReservationDraft } from '@domain/entities/reservation';
import { ReservationDtoSchema } from '../dto/class-session.dto';
import { toReservation } from '../mappers/reservation.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

@Injectable()
export class HttpReservationsRepository extends ReservationsRepository {
  private readonly api = inject(ApiClient);

  /**
   * `sessionId` va en la URL y NO en el cuerpo: el ValidationPipe corre con
   * forbidNonWhitelisted, así que una clave de más devuelve 400.
   */
  async reserve(draft: ReservationDraft): Promise<Reservation> {
    try {
      const raw = await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${draft.sessionId}/reservations`, {
          studentId: draft.studentId,
          studentPlanId: draft.studentPlanId,
        }),
      );
      return toReservation(v.parse(ReservationDtoSchema, raw));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async confirm(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post<unknown>(`/reservations/${id}/confirm`, {}));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Cancelar NO es sólo liberar el cupo: el backend promueve al primero de la lista de espera
   * creando un hold nuevo y marcando su anotación como 'notificado'. Quien llame a esto tiene
   * que releer también la lista de espera.
   */
  async cancel(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/reservations/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx ng test --include src/app/core/data/repositories/http-reservations.repository.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/core
git commit -m "feat(data): ReservationsRepository (hold, confirmar, cancelar)"
```

---

### Task 7: El dashboard consume `ClassSessionsRepository`

Sin esto, `/reservas` y el dashboard tendrían dos lecturas distintas de `/class-sessions` y dos copias del ajuste de la ventana UTC.

**Files:**
- Modify: `src/app/core/data/repositories/http-dashboard.repository.ts`
- Modify: `src/app/core/data/mappers/dashboard.mapper.ts`
- Modify: `src/app/features/dashboard/dashboard.providers.ts`
- Test: `src/app/core/data/repositories/http-dashboard.repository.spec.ts` (migrar)
- Test: `src/app/core/data/mappers/dashboard.mapper.spec.ts` (migrar)

**Interfaces:**
- Consumes: `ClassSessionsRepository` (Task 5), `ClassSession` (Task 4).
- Produces: `DashboardSources.sessions` pasa de `readonly ClassSessionDto[]` a `readonly ClassSession[]`. Ningún otro consumidor cambia.

- [ ] **Step 1: Migrar el mapper a la entidad**

En `src/app/core/data/mappers/dashboard.mapper.ts`:

1. Cambiar el import `ClassSessionDto` por `import { ClassSession } from '@domain/entities/class-session';`.
2. En `DashboardSources`, `readonly sessions: readonly ClassSession[];`.
3. En el loop, renombrar la variable `dto` a `session` y su tipo a `ClassSession`.
4. Borrar la línea `if (localDateKey(at) !== todayKey) continue;` y su comentario, reemplazándolos por:

```ts
    // El filtro de fecha ya lo hizo ClassSessionsRepository.list(): lo que llega acá es del
    // día pedido. Lo que sigue vivo es la validación de startAt, que además distingue POR QUÉ
    // descarta para poder avisar.
```

5. `todayKey` sigue haciendo falta para `localDateKey(src.today)`; si queda sin usar, borrar esa línea.
6. Donde el loop usaba `dto.capacity ?? 0`, ahora es `session.capacity` a secas.

- [ ] **Step 2: Migrar las fixtures del spec del mapper**

En `src/app/core/data/mappers/dashboard.mapper.spec.ts`, las sesiones de las fixtures dejan de ser DTOs: quitar cualquier `capacity: null` reemplazándolo por `capacity: 0`, y quitar los campos que la entidad no tiene.

Agregar un caso que fija el contrato nuevo:

```ts
it('ya no filtra por fecha: confía en que el repositorio entregó el día pedido', () => {
  // Contrato con ClassSessionsRepository.list(). Si el mapper volviera a filtrar, una sesión
  // de las 23:00 local pasaría dos filtros distintos y sólo uno de los dos estaría bien.
  const snapshot = toDashboardSnapshot({
    ...sources,
    sessions: [{ id: '1', courtId: '1', coachId: '1', categoryGroupId: '1',
                 startAt: '2026-08-20T02:00:00.000Z', capacity: 4, availableSpots: 0 }],
    today: new Date('2026-08-19T15:00:00.000Z'),
  });
  expect(snapshot.grid.sessions.flat().filter(Boolean)).toHaveLength(1);
});
```

- [ ] **Step 3: Correr el spec del mapper**

Run: `npx ng test --include src/app/core/data/mappers/dashboard.mapper.spec.ts`
Expected: PASS.

- [ ] **Step 4: Reescribir el repositorio del dashboard**

En `src/app/core/data/repositories/http-dashboard.repository.ts`:

1. Borrar la función `addDays` y los métodos privados `fetchSessions` y `fetchWaitingCounts`.
2. Borrar los imports de `ApiClient`, `firstValueFrom`, `valibot`, `ClassSessionDto`, `ClassSessionListDtoSchema`, `WaitingListDtoSchema` e `isOnLocalDate` si quedan sin uso.
3. Inyectar el contrato nuevo y reemplazar el cuerpo:

```ts
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
```

```ts
  private readonly classSessions = inject(ClassSessionsRepository);
```

```ts
  async getSnapshot(clubId: string): Promise<DashboardSnapshot> {
    try {
      const today = new Date();
      const todayKey = localDateKey(today);
      // La lista de espera depende SÓLO de las sesiones. Encadenarla acá la larga apenas
      // responde /class-sessions en vez de esperar a la más lenta de la ola: con /coaches
      // tardando 400 ms, esperar la ola entera le sumaba esos 400 ms a cada carga.
      const sessionsPromise = this.classSessions.list(todayKey);
      const waitingPromise = sessionsPromise.then((s) => this.fetchWaitingCounts(s));
      const [courts, coaches, categoryGroups, surfaceTypes, sessions, waitingCounts] =
        await Promise.all([
          this.courts.list(),
          this.coaches.list(),
          this.categoryGroups.list(),
          this.catalogs.surfaceTypes(),
          sessionsPromise,
          waitingPromise,
        ]);
      return toDashboardSnapshot({
        clubId, courts, coaches, categoryGroups, surfaceTypes, sessions, waitingCounts, today,
      });
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Sólo las sesiones LLENAS: una con cupo no puede tener lista de espera con sentido. Ya no
   * hace falta filtrar por fecha — `list(todayKey)` devuelve exactamente el día pedido.
   *
   * ponytail: N+1 acotado a las sesiones llenas del día. Es el precio de no tener endpoint
   * agregador ni un contador embebido en /class-sessions, y ninguna de las dos se puede hacer
   * sin tocar el backend.
   */
  private async fetchWaitingCounts(
    sessions: readonly ClassSession[],
  ): Promise<ReadonlyMap<string, number>> {
    const full = sessions.filter((s) => s.availableSpots === 0);
    const entries = await Promise.all(
      full.map(async (s): Promise<readonly [string, number]> => {
        try {
          return [s.id, (await this.classSessions.waitingList(s.id)).length];
        } catch {
          console.warn(`[dashboard] no se pudo leer la lista de espera de la sesión ${s.id}`);
          return [s.id, 0];
        }
      }),
    );
    return new Map(entries);
  }
```

- [ ] **Step 5: Migrar el spec del repositorio**

En `src/app/core/data/repositories/http-dashboard.repository.spec.ts`, reemplazar el doble de `ApiClient` por uno de `ClassSessionsRepository`:

```ts
const classSessions = {
  list: async (_dateKey: string) => sessions,
  waitingList: async (_id: string) => waiting,
  joinWaitingList: async () => undefined,
  leaveWaitingList: async () => undefined,
} as ClassSessionsRepository;
```

y en los providers `{ provide: ClassSessionsRepository, useValue: classSessions }`. Los tests que verificaban la ventana `from`/`to` ya viven en `http-class-sessions.repository.spec.ts` (Task 5): borrarlos de acá en vez de duplicarlos. El que verifica que la lista de espera **no** tumba el snapshot se queda, haciendo que `waitingList` rechace.

- [ ] **Step 6: Bindear el contrato en la ruta del dashboard**

En `src/app/features/dashboard/dashboard.providers.ts`, agregar:

```ts
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { HttpClassSessionsRepository } from '@data/repositories/http-class-sessions.repository';
```

```ts
  { provide: ClassSessionsRepository, useClass: HttpClassSessionsRepository },
```

Y actualizar el comentario de cabecera: el snapshot ahora se compone desde `ClassSessionsRepository` más los otros tres repositorios y el catálogo de superficies.

- [ ] **Step 7: Correr toda la suite y el lint**

Run: `npm test`
Expected: PASS.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/app/core src/app/features/dashboard
git commit -m "refactor(dashboard): consumir ClassSessionsRepository en vez de HTTP crudo"
```

---

### Task 8: Facades de reservas

**Files:**
- Create: `src/app/features/reservas/hold-countdown.ts`
- Create: `src/app/features/reservas/reservas.facade.ts`
- Create: `src/app/features/reservas/sesion.facade.ts`
- Test: `src/app/features/reservas/hold-countdown.spec.ts`
- Test: `src/app/features/reservas/reservas.facade.spec.ts`
- Test: `src/app/features/reservas/sesion.facade.spec.ts`

**Interfaces:**
- Consumes: `ClassSessionsRepository` (Task 5), `ReservationsRepository` (Task 6), `createReservationDraft` y las entidades (Task 4).
- Produces:
  - `minutosRestantes(holdExpiresAt: string|null, now: Date): number`
  - `ReservasFacade`: `date()`, `sorted()`, `load()`, `setDate(dateKey)`, `clearError()`
  - `SesionFacade`: `holdsOf(sessionId)`, `open(sessionId)`, `reservar(sessionId, input)`, `confirmar(sessionId, reservationId)`, `cancelar(sessionId, reservationId)`, `anotar(sessionId, studentId)`, `quitar(sessionId, entryId)`, `clearError()`
  - `PendingHold { reservation: Reservation; studentId: string }`

- [ ] **Step 1: Escribir el test de la cuenta regresiva**

Crear `src/app/features/reservas/hold-countdown.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { minutosRestantes } from './hold-countdown';

const now = new Date('2026-08-19T21:00:00.000Z');

describe('minutosRestantes', () => {
  it('redondea hacia arriba: 29:01 todavía es "30 min"', () => {
    // Hacia arriba y no hacia abajo: mostrar 29 cuando quedan 29 minutos y 1 segundo hace que
    // el número baje apenas se abre el modal y parezca que ya se está venciendo.
    expect(minutosRestantes('2026-08-19T21:29:01.000Z', now)).toBe(30);
  });

  it('0 cuando ya venció', () => {
    expect(minutosRestantes('2026-08-19T20:59:00.000Z', now)).toBe(0);
  });

  it('0 sin fecha y 0 con basura, en vez de NaN', () => {
    expect(minutosRestantes(null, now)).toBe(0);
    expect(minutosRestantes('no-es-una-fecha', now)).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx ng test --include src/app/features/reservas/hold-countdown.spec.ts`
Expected: FAIL — no existe `./hold-countdown`.

- [ ] **Step 3: Implementar**

Crear `src/app/features/reservas/hold-countdown.ts`:

```ts
/**
 * Minutos que le quedan al hold. Pura y con `now` por parámetro: así se testea sin tocar el
 * reloj ni usar timers falsos, igual que el resto de la lógica de fechas del proyecto.
 *
 * Redondea hacia ARRIBA para que un hold recién creado muestre los 30 minutos completos.
 */
export function minutosRestantes(holdExpiresAt: string | null, now: Date): number {
  if (holdExpiresAt === null) return 0;
  const at = new Date(holdExpiresAt);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 60_000));
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx ng test --include src/app/features/reservas/hold-countdown.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Escribir el test de `ReservasFacade`**

Crear `src/app/features/reservas/reservas.facade.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReservasFacade } from './reservas.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';

const late: ClassSession = {
  id: 'tarde', courtId: '1', coachId: '1', categoryGroupId: '1',
  startAt: '2026-08-19T22:00:00.000Z', capacity: 4, availableSpots: 0,
};
const early: ClassSession = { ...late, id: 'temprano', startAt: '2026-08-19T18:00:00.000Z' };

function setup(over: Partial<ClassSessionsRepository> = {}) {
  const dates: string[] = [];
  const repo = {
    list: async (dateKey: string) => { dates.push(dateKey); return [late, early]; },
    waitingList: async () => [],
    joinWaitingList: async () => undefined,
    leaveWaitingList: async () => undefined,
    ...over,
  } as ClassSessionsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ReservasFacade,
      { provide: ClassSessionsRepository, useValue: repo },
    ],
  });
  return { facade: TestBed.inject(ReservasFacade), dates };
}

describe('ReservasFacade', () => {
  it('arranca en la fecha de HOY en hora local', () => {
    // Con toISOString() esto se rompe todas las noches después de las 21:00 en Argentina.
    const { facade } = setup();
    const hoy = new Date();
    const esperado = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    expect(facade.date()).toBe(esperado);
  });

  it('load() pide la fecha seleccionada y ordena por hora', () => {
    // El backend no ordena: class-sessions.service.list() no tiene ORDER BY.
    const { facade } = setup();
    return facade.load().then(() => {
      expect(facade.sorted().map((s) => s.id)).toEqual(['temprano', 'tarde']);
    });
  });

  it('setDate() cambia la fecha y recarga', async () => {
    const { facade, dates } = setup();
    await facade.setDate('2026-09-01');
    expect(facade.date()).toBe('2026-09-01');
    expect(dates.at(-1)).toBe('2026-09-01');
  });

  it('un fallo del repo se normaliza y NO rechaza', async () => {
    const { facade } = setup({ list: () => Promise.reject({ kind: 'forbidden' as const }) });
    await facade.load();
    expect(facade.error()).toEqual({ kind: 'forbidden' });
    expect(facade.data()).toBeNull();
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npx ng test --include src/app/features/reservas/reservas.facade.spec.ts`
Expected: FAIL — no existe `./reservas.facade`.

- [ ] **Step 7: Implementar `ReservasFacade`**

Crear `src/app/features/reservas/reservas.facade.ts`:

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';
import { DomainError } from '@domain/errors';
import { localDateKey } from '@domain/local-date';
import { toDomainError } from '@data/http/to-domain-error';

/**
 * Las clases de UNA fecha. La fecha es estado de la facade y no de la página para que
 * volver a /reservas después de abrir otra pantalla no te devuelva a hoy.
 */
@Injectable()
export class ReservasFacade extends SignalStore<ClassSession[], DomainError> {
  private readonly repo = inject(ClassSessionsRepository);

  private readonly _date = signal(localDateKey(new Date()));
  readonly date = this._date.asReadonly();

  /**
   * `class-sessions.service.list()` no tiene ORDER BY: sin esto la tabla sale en el orden
   * físico del heap de Postgres. Se ordena por el ISO crudo, que es lexicográficamente
   * ordenable; las sesiones sin hora caen primero y son visiblemente raras, que es lo correcto.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  });

  load(): Promise<void> {
    return this.run(this.repo.list(this._date()), toDomainError);
  }

  setDate(dateKey: string): Promise<void> {
    this._date.set(dateKey);
    return this.load();
  }

  clearError(): void {
    this.setError(null);
  }
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npx ng test --include src/app/features/reservas/reservas.facade.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Escribir el test de `SesionFacade`**

Crear `src/app/features/reservas/sesion.facade.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SesionFacade } from './sesion.facade';
import { ReservasFacade } from './reservas.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { WaitingListEntry } from '@domain/entities/waiting-list';

const entry: WaitingListEntry = { id: '77', studentId: '4', requestedAt: null };
const input = { sessionId: '10', studentId: '4', studentPlanId: '9' };

function setup(over: Partial<ReservationsRepository> = {}) {
  const calls: string[] = [];
  const sessions = {
    list: async () => { calls.push('sessions.list'); return []; },
    waitingList: async () => { calls.push('waitingList'); return [entry]; },
    joinWaitingList: async () => { calls.push('join'); },
    leaveWaitingList: async () => { calls.push('leave'); },
  } as ClassSessionsRepository;

  const reservations = {
    reserve: async () => { calls.push('reserve'); return { id: '55', holdExpiresAt: null }; },
    confirm: async () => { calls.push('confirm'); },
    cancel: async () => { calls.push('cancel'); },
    ...over,
  } as ReservationsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      SesionFacade,
      ReservasFacade,
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: ReservationsRepository, useValue: reservations },
    ],
  });
  return { facade: TestBed.inject(SesionFacade), calls };
}

describe('SesionFacade', () => {
  it('open() carga la lista de espera', async () => {
    const { facade } = setup();
    await facade.open('10');
    expect(facade.data()).toEqual([entry]);
  });

  it('reservar() deja el hold en pendientes y refresca las sesiones', async () => {
    const { facade, calls } = setup();
    await facade.reservar('10', input);
    expect(facade.holdsOf('10')).toEqual([
      { reservation: { id: '55', holdExpiresAt: null }, studentId: '4' },
    ]);
    expect(calls).toEqual(['reserve', 'sessions.list']);
  });

  it('reservar() sin plan NO llama al repo y deja el error de dominio', async () => {
    const { facade, calls } = setup();
    await facade.reservar('10', { ...input, studentPlanId: '' });
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({
      kind: 'domain',
      message: 'Elegí un plan con créditos: sin plan la reserva no se puede confirmar.',
    });
  });

  it('confirmar() saca el hold de pendientes', async () => {
    const { facade } = setup();
    await facade.reservar('10', input);
    await facade.confirmar('10', '55');
    expect(facade.holdsOf('10')).toEqual([]);
  });

  it('cancelar() refresca las sesiones Y la lista de espera', async () => {
    // El backend promueve al primero de la lista creando un hold nuevo: la lista se acortó
    // sola aunque el usuario no haya tocado ese bloque. Sin este refresco, muestra a alguien
    // que ya no está esperando.
    const { facade, calls } = setup();
    await facade.reservar('10', input);
    calls.length = 0;
    await facade.cancelar('10', '55');
    expect(calls).toEqual(['cancel', 'sessions.list', 'waitingList']);
    expect(facade.holdsOf('10')).toEqual([]);
  });

  it('anotar() y quitar() releen la lista de espera', async () => {
    const { facade, calls } = setup();
    await facade.anotar('10', '4');
    expect(calls).toEqual(['join', 'waitingList']);
    calls.length = 0;
    await facade.quitar('10', '77');
    expect(calls).toEqual(['leave', 'waitingList']);
  });

  it('los holds son por sesión: los de una no aparecen en la otra', async () => {
    const { facade } = setup();
    await facade.reservar('10', input);
    expect(facade.holdsOf('11')).toEqual([]);
  });

  it('un fallo al confirmar deja el error y NO rechaza', async () => {
    const { facade } = setup({
      confirm: () => Promise.reject({ kind: 'domain' as const, message: 'El hold expiró' }),
    });
    await facade.confirmar('10', '55');
    expect(facade.error()).toEqual({ kind: 'domain', message: 'El hold expiró' });
  });
});
```

- [ ] **Step 10: Correr y verificar que falla**

Run: `npx ng test --include src/app/features/reservas/sesion.facade.spec.ts`
Expected: FAIL — no existe `./sesion.facade`.

- [ ] **Step 11: Implementar `SesionFacade`**

Crear `src/app/features/reservas/sesion.facade.ts`:

```ts
import { Injectable, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { Reservation, ReservationInput, createReservationDraft } from '@domain/entities/reservation';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { ReservasFacade } from './reservas.facade';

export interface PendingHold {
  readonly reservation: Reservation;
  readonly studentId: string;
}

/**
 * Lo de UNA sesión: su lista de espera (la tríada de SignalStore) y sus holds sin confirmar.
 *
 * Separada de ReservasFacade igual que AlumnoPlanesFacade de AlumnosFacade: con una sola
 * facade, abrir el modal prendería el spinner de la tabla y un error del modal taparía el de
 * la lista.
 *
 * ReservasFacade se INYECTA acá: las dos están provistas en la misma ruta, y "cancelar refresca
 * también las sesiones" es una regla del flujo, no de la pantalla. Dejarla en el componente la
 * volvía imposible de testear sin montar el modal.
 */
@Injectable()
export class SesionFacade extends SignalStore<WaitingListEntry[], DomainError> {
  private readonly sessions = inject(ClassSessionsRepository);
  private readonly reservations = inject(ReservationsRepository);
  private readonly reservas = inject(ReservasFacade);

  /**
   * sessionId → holds creados en ESTA visita.
   *
   * ponytail: en memoria. Vive en la facade, que está provista en la ruta, así que cerrar y
   * reabrir el modal no los pierde; salir de /reservas sí. Techo aceptado a conciencia: no
   * existe `GET /reservations`, así que un hold sin confirmar es invisible después de un F5
   * aunque siga vivo en la base. Salida: `GET /reservations?status=held` en el backend.
   */
  private readonly _holds = signal<ReadonlyMap<string, readonly PendingHold[]>>(new Map());

  holdsOf(sessionId: string): readonly PendingHold[] {
    return this._holds().get(sessionId) ?? [];
  }

  open(sessionId: string): Promise<void> {
    return this.run(this.sessions.waitingList(sessionId), toDomainError);
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * createReservationDraft tira de forma síncrona sin alumno o sin plan; va DENTRO de la
   * promesa para que run()/toDomainError normalicen la invariante igual que un fallo del repo.
   * Mismo patrón que CanchasFacade.create().
   *
   * Resuelve a `this.data()`: reservar no cambia la lista de espera, y releerla sería un GET
   * al pedo. run() necesita un valor para su tríada, así que se le devuelve el que ya tiene.
   */
  reservar(sessionId: string, input: ReservationInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.reservations.reserve(createReservationDraft(input)))
        .then((reservation) => this.pushHold(sessionId, { reservation, studentId: input.studentId }))
        .then(() => this.reservas.load())
        .then(() => this.data() ?? []),
      toDomainError,
    );
  }

  confirmar(sessionId: string, reservationId: string): Promise<void> {
    return this.run(
      this.reservations
        .confirm(reservationId)
        .then(() => this.dropHold(sessionId, reservationId))
        .then(() => this.reservas.load())
        .then(() => this.data() ?? []),
      toDomainError,
    );
  }

  /**
   * Cancelar refresca DOS cosas. `ReservationsService.cancel()` promueve al primero de la
   * lista de espera creando un hold nuevo y marcando su anotación como 'notificado': la lista
   * se acortó sola, sin que el usuario haya tocado ese bloque.
   */
  cancelar(sessionId: string, reservationId: string): Promise<void> {
    return this.run(
      this.reservations
        .cancel(reservationId)
        .then(() => this.dropHold(sessionId, reservationId))
        .then(() => this.reservas.load())
        .then(() => this.sessions.waitingList(sessionId)),
      toDomainError,
    );
  }

  anotar(sessionId: string, studentId: string): Promise<void> {
    return this.run(
      this.sessions
        .joinWaitingList(sessionId, studentId)
        .then(() => this.sessions.waitingList(sessionId)),
      toDomainError,
    );
  }

  quitar(sessionId: string, entryId: string): Promise<void> {
    return this.run(
      this.sessions
        .leaveWaitingList(entryId)
        .then(() => this.sessions.waitingList(sessionId)),
      toDomainError,
    );
  }

  private pushHold(sessionId: string, hold: PendingHold): void {
    const next = new Map(this._holds());
    next.set(sessionId, [...this.holdsOf(sessionId), hold]);
    this._holds.set(next);
  }

  private dropHold(sessionId: string, reservationId: string): void {
    const next = new Map(this._holds());
    next.set(sessionId, this.holdsOf(sessionId).filter((h) => h.reservation.id !== reservationId));
    this._holds.set(next);
  }
}
```

- [ ] **Step 12: Correr y verificar que pasa**

Run: `npx ng test --include src/app/features/reservas/sesion.facade.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 13: Lint y commit**

Run: `npm run lint`
Expected: sin errores de `boundaries` (las dos facades están en la MISMA feature, así que inyectarse entre sí es legal).

```bash
git add src/app/features/reservas
git commit -m "feat(reservas): facades de sesiones, holds y lista de espera"
```

---

### Task 9: Pantalla `/reservas`, modal y navegación

**Files:**
- Create: `src/app/features/reservas/reservas.providers.ts`
- Create: `src/app/features/reservas/reservas.routes.ts`
- Create: `src/app/features/reservas/components/sesion-modal.component.ts`
- Create: `src/app/features/reservas/pages/reservas-page.component.ts`
- Create: `src/app/features/reservas/pages/reservas-page.component.html`
- Create: `src/app/features/reservas/pages/reservas-page.component.css`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/layout/nav.model.ts`
- Modify: `src/app/layout/shell.component.html`
- Test: `src/app/features/reservas/pages/reservas-page.component.spec.ts`

**Interfaces:**
- Consumes: `ReservasFacade`, `SesionFacade`, `PendingHold`, `minutosRestantes` (Task 8); `occupiedSpots` (Task 4); `StudentsRepository`, `PlansRepository`, `CourtsRepository`, `CoachesRepository`, `CategoryGroupsRepository` (ya existen).
- Produces: la ruta `/reservas`.

- [ ] **Step 1: Crear los providers y la ruta de la feature**

`src/app/features/reservas/reservas.providers.ts`:

```ts
import { Provider } from '@angular/core';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { HttpClassSessionsRepository } from '@data/repositories/http-class-sessions.repository';
import { HttpReservationsRepository } from '@data/repositories/http-reservations.repository';
import { HttpStudentsRepository } from '@data/repositories/http-students.repository';
import { HttpCourtsRepository } from '@data/repositories/http-courts.repository';
import { HttpCoachesRepository } from '@data/repositories/http-coaches.repository';
import { HttpCategoryGroupsRepository } from '@data/repositories/http-category-groups.repository';

// Los tres últimos son sólo para ponerles NOMBRE a los ids que devuelve /class-sessions, que
// trae courtId/coachId/categoryGroupId pelados. Mismo argumento que alumnos.providers.ts:
// son contratos de DOMINIO, no de otra feature, y dos instancias de un repo sin estado no
// cuestan nada. StudentsRepository además aporta los planes del alumno para el select.
export const RESERVAS_PROVIDERS: Provider[] = [
  { provide: ClassSessionsRepository, useClass: HttpClassSessionsRepository },
  { provide: ReservationsRepository, useClass: HttpReservationsRepository },
  { provide: StudentsRepository, useClass: HttpStudentsRepository },
  { provide: CourtsRepository, useClass: HttpCourtsRepository },
  { provide: CoachesRepository, useClass: HttpCoachesRepository },
  { provide: CategoryGroupsRepository, useClass: HttpCategoryGroupsRepository },
];
```

`src/app/features/reservas/reservas.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { RESERVAS_PROVIDERS } from './reservas.providers';
import { ReservasFacade } from './reservas.facade';
import { SesionFacade } from './sesion.facade';

/**
 * Las dos facades van en la ruta: SesionFacade inyecta a ReservasFacade, y sus holds
 * pendientes tienen que sobrevivir a cerrar y reabrir el modal.
 */
export const RESERVAS_ROUTES: Routes = [
  {
    path: '',
    providers: [ReservasFacade, SesionFacade, ...RESERVAS_PROVIDERS],
    loadComponent: () =>
      import('./pages/reservas-page.component').then((m) => m.ReservasPageComponent),
  },
];
```

- [ ] **Step 2: Crear el modal de sesión**

`src/app/features/reservas/components/sesion-modal.component.ts`:

```ts
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal, viewChild,
} from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { Student, studentDisplayName } from '@domain/entities/student';
import { StudentPlan, studentPlanIsUsable } from '@domain/entities/student-plan';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { domainErrorMessage } from '@domain/errors';
import { localDateKey } from '@domain/local-date';
import { SesionFacade } from '../sesion.facade';
import { minutosRestantes } from '../hold-countdown';

@Component({
  selector: 'app-sesion-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Clase" [subtitle]="subtitle()" icon="primary">
      @if (errorText()) { <p class="notice hold form-error" role="alert">{{ errorText() }}</p> }

      <h4>Inscribir</h4>
      <div class="field field-dense">
        <label for="res-alumno">Alumno</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' -->
        <select id="res-alumno" class="control" autofocus
                [value]="studentId()" (change)="onStudent($event)">
          <option value="">Elegí un alumno…</option>
          @for (s of elegibles(); track s.id) {
            <option [value]="s.id">{{ name(s) }}</option>
          }
        </select>
      </div>

      <div class="field field-dense">
        <label for="res-plan">Plan</label>
        <select id="res-plan" class="control" [value]="planId()" (change)="onPlan($event)">
          <option value="">Elegí un plan…</option>
          @for (p of planesUsables(); track p.id) {
            <option [value]="p.id">{{ p.creditsRemaining }} créditos</option>
          }
        </select>
        @if (studentId() && !planesUsables().length) {
          <p class="hint">
            Este alumno no tiene planes con créditos vigentes. Sin plan la reserva no se puede
            confirmar, así que hay que venderle uno antes.
          </p>
        }
      </div>
      <button type="button" class="btn btn-primary" [disabled]="!puedeReservar()"
              (click)="onReservar()">Reservar</button>

      <h4>Pendientes de confirmar</h4>
      @for (h of holds(); track h.reservation.id) {
        <div class="arow">
          <div class="a-main">
            <div class="a-title">{{ nameOf(h.studentId) }}</div>
            <div class="a-meta">{{ minutos(h.reservation.holdExpiresAt) }} min para que venza</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm"
                  (click)="onConfirmar(h.reservation.id)">Confirmar</button>
          <button type="button" class="btn btn-danger btn-sm"
                  (click)="onCancelar(h.reservation.id)">Cancelar</button>
        </div>
      } @empty {
        <p class="a-empty">Ninguna reserva pendiente en esta visita.</p>
      }

      <h4>Lista de espera</h4>
      @for (e of facade.data() ?? []; track e.id) {
        <div class="arow">
          <div class="a-main"><div class="a-title">{{ nameOf(e.studentId) }}</div></div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="onQuitar(e.id)">Quitar</button>
        </div>
      } @empty {
        <p class="a-empty">Sin lista de espera.</p>
      }
      <button type="button" class="btn btn-ghost" [disabled]="!studentId()"
              (click)="onAnotar()">Anotar al alumno elegido</button>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cerrar</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .form-error{margin-bottom:var(--space-md)}
    h4{margin:var(--space-md) 0 var(--space-sm)}
    .hint{font-size:var(--text-2xs);color:var(--color-fg-subtle)}
    .arow{display:flex;align-items:center;gap:var(--space-sm)}
  `],
})
export class SesionModalComponent {
  readonly students = input.required<readonly Student[]>();
  /** id de cancha/profesor/grupo → nombre, ya resuelto por la página. */
  readonly labels = input.required<(session: ClassSession) => string>();

  protected readonly facade = inject(SesionFacade);
  private readonly repo = inject(StudentsRepository);
  private readonly modal = viewChild.required(ModalComponent);

  protected readonly session = signal<ClassSession | null>(null);
  protected readonly studentId = signal('');
  protected readonly planId = signal('');
  private readonly plans = signal<readonly StudentPlan[]>([]);

  /** Avanza cada 30 s. El hold dura 30 minutos: el segundero no aporta nada. */
  private readonly now = signal(new Date());

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Se excluyen los alumnos SIN categoría: de esos el front sabe con certeza que la API los
   * rechaza. Del resto no puede saber nada — ningún GET devuelve los items del grupo —, así
   * que se muestran todos y el 400 del backend es el feedback. Filtrar con la pista guardada
   * escondería alumnos válidos, y equivocarse escondiendo es peor que equivocarse mostrando.
   */
  protected readonly elegibles = computed(() =>
    this.students().filter((s) => s.categoryId !== null),
  );

  protected readonly planesUsables = computed(() => {
    const hoy = localDateKey(this.now());
    return this.plans().filter((p) => studentPlanIsUsable(p, hoy));
  });

  protected readonly holds = computed(() => this.facade.holdsOf(this.session()?.id ?? ''));

  protected puedeReservar(): boolean {
    return this.studentId() !== '' && this.planId() !== '';
  }

  protected subtitle(): string {
    const s = this.session();
    return s ? `${this.labels()(s)} · ${occupiedSpots(s)}/${s.capacity}` : '';
  }

  protected name(s: Student): string { return studentDisplayName(s); }

  protected nameOf(studentId: string): string {
    const hit = this.students().find((s) => s.id === studentId);
    return hit ? studentDisplayName(hit) : `Alumno #${studentId}`;
  }

  protected minutos(holdExpiresAt: string | null): number {
    return minutosRestantes(holdExpiresAt, this.now());
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  open(session: ClassSession): void {
    this.session.set(session);
    this.studentId.set('');
    this.planId.set('');
    this.plans.set([]);
    this.facade.clearError();
    void this.facade.open(session.id);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onStudent(e: Event): void {
    this.studentId.set((e.target as HTMLSelectElement).value);
    this.planId.set('');
    this.plans.set([]);
    const id = this.studentId();
    if (!id) return;
    // Falla en silencio: sin planes el select queda vacío y el cartel explica por qué. Un
    // error acá no debería tapar el de la reserva, que es el que importa.
    void this.repo.plans(id).then((p) => this.plans.set(p)).catch(() => this.plans.set([]));
  }

  protected onPlan(e: Event): void {
    this.planId.set((e.target as HTMLSelectElement).value);
  }

  protected onReservar(): void {
    const s = this.session();
    if (!s) return;
    void this.facade.reservar(s.id, {
      sessionId: s.id,
      studentId: this.studentId(),
      studentPlanId: this.planId(),
    });
  }

  protected onConfirmar(reservationId: string): void {
    const s = this.session();
    if (s) void this.facade.confirmar(s.id, reservationId);
  }

  protected onCancelar(reservationId: string): void {
    const s = this.session();
    if (s) void this.facade.cancelar(s.id, reservationId);
  }

  protected onAnotar(): void {
    const s = this.session();
    if (s) void this.facade.anotar(s.id, this.studentId());
  }

  protected onQuitar(entryId: string): void {
    const s = this.session();
    if (s) void this.facade.quitar(s.id, entryId);
  }
}
```

- [ ] **Step 3: Crear la página**

`src/app/features/reservas/pages/reservas-page.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ReservasFacade } from '../reservas.facade';
import { SesionModalComponent } from '../components/sesion-modal.component';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { Student } from '@domain/entities/student';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { domainErrorMessage } from '@domain/errors';

@Component({
  selector: 'app-reservas-page',
  standalone: true,
  imports: [SesionModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservas-page.component.html',
  styleUrl: './reservas-page.component.css',
})
export class ReservasPageComponent {
  protected readonly facade = inject(ReservasFacade);
  private readonly studentsRepo = inject(StudentsRepository);
  private readonly courtsRepo = inject(CourtsRepository);
  private readonly coachesRepo = inject(CoachesRepository);
  private readonly groupsRepo = inject(CategoryGroupsRepository);

  private readonly modal = viewChild.required(SesionModalComponent);

  protected readonly students = signal<readonly Student[]>([]);
  private readonly courtName = signal<ReadonlyMap<string, string>>(new Map());
  private readonly coachName = signal<ReadonlyMap<string, string>>(new Map());
  private readonly groupName = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Los tres catálogos de nombres y la lista de alumnos fallan en SILENCIO, igual que los
    // catálogos de Canchas: sin ellos la tabla muestra ids en vez de nombres, pero sigue
    // siendo usable, y el error de las sesiones es el que importa.
    void this.studentsRepo.list().then((v) => this.students.set(v)).catch(() => undefined);
    void this.courtsRepo.list()
      .then((v) => this.courtName.set(new Map(v.map((c) => [c.id, c.name]))))
      .catch(() => undefined);
    void this.coachesRepo.list()
      .then((v) => this.coachName.set(new Map(v.map((c) => [c.id, c.displayName]))))
      .catch(() => undefined);
    void this.groupsRepo.list()
      .then((v) => this.groupName.set(new Map(v.map((g) => [g.id, g.name]))))
      .catch(() => undefined);
  }

  /** Se le pasa al modal como input para que arme su subtítulo sin repetir los tres mapas. */
  protected readonly label = (s: ClassSession): string =>
    `${this.court(s)} · ${this.hora(s)} · ${this.grupo(s)}`;

  protected court(s: ClassSession): string { return this.courtName().get(s.courtId) || '—'; }
  protected coach(s: ClassSession): string { return this.coachName().get(s.coachId) || '—'; }
  protected grupo(s: ClassSession): string {
    return this.groupName().get(s.categoryGroupId) || '—';
  }

  /** 'HH:mm' local. `startAt` puede ser null: Prisma lo permite y nadie lo valida. */
  protected hora(s: ClassSession): string {
    if (s.startAt === null) return '—';
    const at = new Date(s.startAt);
    if (Number.isNaN(at.getTime())) return '—';
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  }

  protected cupo(s: ClassSession): string {
    return `${occupiedSpots(s)}/${s.capacity}`;
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onDate(e: Event): void {
    void this.facade.setDate((e.target as HTMLInputElement).value);
  }

  protected openSession(session: ClassSession): void {
    this.modal().open(session);
  }
}
```

`src/app/features/reservas/pages/reservas-page.component.html`:

```html
<section class="panel">
  <div class="panel-head">
    <h3>Reservas</h3>
    <div class="field field-dense">
      <label class="sr-only" for="reservas-fecha">Fecha</label>
      <input id="reservas-fecha" class="control" type="date"
             [value]="facade.date()" (change)="onDate($event)" />
    </div>
  </div>

  <!-- BANNER, no una rama del chain: la facade también ESCRIBE (vía SesionFacade), y un error
       de guardado no puede reemplazar la tabla que data() sigue teniendo intacta. -->
  @if (errorText()) {
    <p class="notice hold" role="alert">{{ errorText() }}</p>
  }

  @if (facade.loading()) {
    <p class="a-body">Cargando clases…</p>
  } @else if (facade.sorted().length) {
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Cancha</th>
            <th scope="col">Categoría</th>
            <th scope="col">Profesor</th>
            <th scope="col">Cupo</th>
            <th scope="col" class="cell-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (s of facade.sorted(); track s.id) {
            <tr>
              <td>{{ hora(s) }}</td>
              <td>{{ court(s) }}</td>
              <td>{{ grupo(s) }}</td>
              <td>{{ coach(s) }}</td>
              <td>{{ cupo(s) }}</td>
              <td class="cell-end">
                <button type="button" class="btn btn-ghost btn-sm" (click)="openSession(s)">
                  Abrir
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  } @else if (facade.data()) {
    <!-- El vacío sólo cuando la lista LLEGÓ vacía: si data() es null la carga falló y lo que
         corresponde es el banner de arriba. -->
    <div class="a-empty">No hay clases generadas para esta fecha.</div>
  }
</section>

<app-sesion-modal [students]="students()" [labels]="label" />
```

`src/app/features/reservas/pages/reservas-page.component.css`:

```css
/* La tabla y el panel salen de styles/components.css. Acá sólo va el "dónde": la fecha
   no debe estirarse a lo ancho del panel-head como haría un .control suelto. */
#reservas-fecha {
  max-width: 12rem;
}
```

- [ ] **Step 4: Escribir el test de la página**

Crear `src/app/features/reservas/pages/reservas-page.component.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReservasPageComponent } from './reservas-page.component';
import { ReservasFacade } from '../reservas.facade';
import { SesionFacade } from '../sesion.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { ClassSession } from '@domain/entities/class-session';

const session: ClassSession = {
  id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
  startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
};

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ReservasFacade,
      SesionFacade,
      { provide: ClassSessionsRepository, useValue: {
          list: async () => [session], waitingList: async () => [],
          joinWaitingList: async () => undefined, leaveWaitingList: async () => undefined,
        } as ClassSessionsRepository },
      { provide: ReservationsRepository, useValue: {
          reserve: async () => ({ id: '55', holdExpiresAt: null }),
          confirm: async () => undefined, cancel: async () => undefined,
        } as ReservationsRepository },
      { provide: StudentsRepository, useValue: {
          list: async () => [], plans: async () => [],
          create: async () => undefined, update: async () => undefined, remove: async () => undefined,
        } as StudentsRepository },
      { provide: CourtsRepository, useValue: {
          list: async () => [{ id: '2', name: 'Cancha 2', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null }],
          create: async () => undefined, update: async () => undefined, remove: async () => undefined,
        } as CourtsRepository },
      { provide: CoachesRepository, useValue: {
          list: async () => [], update: async () => undefined,
        } as CoachesRepository },
      { provide: CategoryGroupsRepository, useValue: {
          list: async () => [], create: async () => undefined, update: async () => undefined,
          remove: async () => undefined, addItem: async () => undefined, removeItem: async () => undefined,
        } as CategoryGroupsRepository },
    ],
  });
  return TestBed.createComponent(ReservasPageComponent);
}

describe('ReservasPageComponent', () => {
  it('muestra la clase con su hora LOCAL y su cupo', async () => {
    // test-setup.ts fija TZ=America/Argentina/Buenos_Aires: 21:00Z es 18:00 local.
    const fixture = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('18:00');
    expect(text).toContain('3/4');
    expect(text).toContain('Cancha 2');
  });

  it('el input de fecha arranca en la fecha de la facade', async () => {
    const fixture = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#reservas-fecha');
    expect(input?.value).toBe(TestBed.inject(ReservasFacade).date());
  });
});
```

- [ ] **Step 5: Correr el test de la página**

Run: `npx ng test --include src/app/features/reservas/pages/reservas-page.component.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Enganchar la ruta y la navegación**

En `src/app/app.routes.ts`, dentro de los `children` del shell, después de `grupos`:

```ts
      {
        path: 'reservas',
        loadChildren: () => import('./features/reservas/reservas.routes').then((m) => m.RESERVAS_ROUTES),
        data: { title: 'Reservas y lista de espera', crumb: 'Operación' },
      },
```

En `src/app/layout/nav.model.ts`, agregar `'reservas'` a `NavIcon` y el ítem después de Grupos:

```ts
  { label: 'Reservas',              short: 'Reservas',   path: '/reservas',   group: 'Operación', icon: 'reservas' },
```

En `src/app/layout/shell.component.html`, dentro del `@switch (name)`:

```html
    @case ('reservas') {
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    }
```

- [ ] **Step 7: Correr toda la suite y el lint**

Run: `npm test`
Expected: PASS. `app.routes.spec.ts` y `shell.component.spec.ts` cubren la navegación: si alguno cuenta los ítems del nav, hay que actualizar el número.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 8: Verificar el build y el budget de CSS**

Run: `npm run build`
Expected: build OK, sin warnings de `anyComponentStyle` (4 kB warning / 8 kB error por componente).

- [ ] **Step 9: Commit**

```bash
git add src/app/features/reservas src/app/app.routes.ts src/app/layout
git commit -m "feat(reservas): pantalla de reservas, modal de sesión y navegación"
```

---

## Verificación final

- [ ] `npm test` — toda la suite en verde
- [ ] `npm run lint` — sin violaciones de `boundaries`
- [ ] `npm run build` — sin exceder los budgets de CSS
- [ ] Con el backend levantado en `localhost:3000` y `npm start`: cargar categorías a un grupo desde Configuración, y recién después reservar en `/reservas`. **Ese orden importa**: sin items, `POST /reservations` responde 400 y no es un bug del front.
