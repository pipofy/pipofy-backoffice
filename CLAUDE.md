# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Backoffice (Angular 20) del SaaS de gestión de clubes de pádel **Pipofy / PipoFy**. Consume la API del repo hermano `pipofy-backend` (NestJS + Prisma), que **no se toca desde acá**.

## Comandos

```bash
npm start              # set-env development + ng serve (proxy /api → localhost:3000)
npm run build          # set-env production + ng build
npm run build:staging
npm test               # ng test → vitest + jsdom
npx ng test --include src/app/core/domain/local-date.spec.ts   # un solo spec
npm run lint           # eslint (TS + templates + boundaries de capas)
npm run check:scripts  # self-checks de set-env.mjs y new-slice.mjs
npm run new-slice -- <entity> <entities> <feature> <label>   # genera un slice vertical, ver docs/TEMPLATE.md
```

Antes de arrancar: copiar `.env.example` → `.env.development` (sólo `NG_API_BASE_URL` es obligatoria; y `.env.staging` / `.env.production` si hacen falta). `set-env.mjs` genera `src/environments/environment*.ts` a partir de ese archivo — **son archivos generados, no editarlos a mano**. Si no existe el `.env.*`, cae a leer las `NG_*` de `process.env` (es el caso de Render, ver `render.yaml`). El script aborta si falta la clave requerida o si detecta algo que parece secreto.

## Arquitectura

Clean architecture, **impuesta por `eslint-plugin-boundaries`** (`eslint.config.js`). Violarla es error de lint, no una convención. El repo es un **template**: el kernel (todo lo de abajo salvo `product/`) no depende del producto — ver `docs/TEMPLATE.md`.

| Capa | Path / alias | Puede importar |
|---|---|---|
| `config` | `src/app/core/config` → `@config/*` | nada del proyecto. Sólo tipos e `InjectionToken`s |
| `domain` | `src/app/core/domain` → `@domain/*` | sólo `domain`. **Prohibido `@angular/*`** — TS puro |
| `data` | `src/app/core/data` → `@data/*` | `domain`, `data`, `config` |
| `shared` | `src/app/shared` → `@shared/*` | `shared`, `config` (no `domain`: sigue sin poder usar `DomainError`) |
| `layout` | `src/app/layout` (sin alias) | `domain`, `shared`, `config`, `auth` |
| `auth` | `src/app/features/auth` | `domain`, `data`, `shared`, `config` — es la feature del kernel (login, sesión, cambio de clave) |
| `features/<x>` | `src/app/features/*` → `@features/*` | `domain`, `data`, `shared`, `config` — **nunca otra feature** |
| `product` | `src/app/product` (sin alias) | `config`, `shared`. **Nadie más lo importa**, salvo `app.config.ts` |

Usar siempre los alias de `tsconfig.json`, no rutas relativas largas (`layout/` y `product/` no tienen alias: `layout/shell.component` sólo lo carga `app.routes.ts` y `product/` sólo lo importa `app.config.ts`).

### Slice vertical (el patrón que sigue toda feature)

`DTO valibot` → `mapper` → `contrato abstracto en domain` → `repositorio HTTP en data` → `facade SignalStore` → `página standalone`.

- **DTO** (`core/data/dto/*.dto.ts`): schema valibot del borde HTTP. Suele haber uno de lectura (`XDtoSchema`, tolerante: `v.nullable` en casi todo porque el backend guarda filas incompletas) y otro de escritura (`XRequestSchema`).
- **Mapper** (`core/data/mappers/`): DTO ↔ entidad. Ahí viven las rarezas de la API. La más presente: los write-mappers de FK opcionales toman un `modo: 'alta' | 'edicion'` — en la edición mandan el FK en `null` (única forma de vaciarlo), en el alta lo omiten, porque el `create` del backend hace `BigInt(null)` y devuelve 500 mientras que el `update` pasa por `fkOpcional`.
- **Contrato** (`core/domain/contracts/*.repository.ts`): **clase abstracta**, no interface — hace de token DI sin arrastrar Angular al dominio. Las escrituras devuelven `void` y la facade re-lee; no se parchea la lista en memoria.
- **Entidad** (`core/domain/entities/`): interfaces `readonly` + un `createXDraft(input)` que valida las invariantes de escritura y tira una `DomainRuleError`. La lectura es siempre tolerante.
- **Repositorio** (`core/data/repositories/http-*.repository.ts`): `ApiClient` + `v.parse` dentro de un `try/catch` que normaliza todo con `toDomainError` (`v.parse` tira fuera del observable, por eso el catch).
- **Facade** (`features/<x>/*.facade.ts`): extiende `SignalStore<T, DomainError>` (`shared/signal-store/`), que da el triado `data/loading/error` y `run(promise, mapError)`.
- **Providers**: cada feature tiene `<x>.providers.ts` que bindea contrato → implementación HTTP, y `<x>.routes.ts` los inyecta en la ruta lazy. Sólo van a root (`app.config.ts`) los que necesita el interceptor/guard antes de que exista ruta, o los que comparten dos rutas lazy distintas (`AuthRepository`, `ClubRepository`, `CatalogsRepository`, `UsersRepository`) — cada caso está comentado ahí. Las features importan `@data` **sólo** en `<feature>.providers.ts` (en código de producción; un `*.spec.ts` sí puede importar una implementación concreta de `@data` para cablear el `TestBed`).

### Errores

`DomainError` es una **unión discriminada** en `core/domain/errors.ts`, y `domainErrorMessage()` es un `switch` exhaustivo **sin `default`**: agregar un `kind` rompe el build hasta que tenga copy en español. Todo error HTTP pasa por `toDomainError` (`core/data/http/`). 400 y 409 salen como `{kind:'domain', message}` con el texto del backend.

### Auth y multi-tenant

`SessionStore` (root) es el dueño único de los tokens, espejados en `localStorage`
(`${storagePrefix}:session:v1`, para Pipofy `PipoFy:session:v1`) y rehidratados en el constructor; `clubId` y `roles` se leen del JWT, no de la respuesta del login. `authInterceptor` + `TokenRefresher` refrescan; `tenantInterceptor` agrega `X-Tenant-Id` desde `TenantContext`. `authGuard` redirige a `/cambiar-clave` si `mustChangePassword`, y esa ruta cuelga **fuera** del shell con su propio `mustBeLoggedIn` para no entrar en loop.

## Convenciones

- **Angular 20 standalone + zoneless + signals**. Nada de NgModules, nada de Zone.js, nada de RxJS en las facades (`firstValueFrom` en los repos y listo). Componentes con `ChangeDetectionStrategy.OnPush`, `inject()`, `viewChild.required()`, `signal`/`computed`.
- **Idioma**: comentarios y docstrings en **español** en todo el repo, también en `core/`; copy de UI y nombres de feature/rutas en español (`features/reservas`, `/configuracion`). Lo que va en **inglés** son identificadores, nombres de archivo y APIs.
- **Ids**: la API los manda **siempre como string** (polyfill de `BigInt.prototype.toJSON`); fechas en ISO. La lógica de fecha local vive en `@domain/local-date`.
- **Simplificaciones deliberadas** se marcan con un comentario `ponytail:` que nombra el techo y la salida. Hay varios: filtros de borrados en cliente, catálogos que faltan, N lecturas en paralelo sin cachear.
- Prettier: `printWidth: 100`, `singleQuote: true`. Selectores: componentes `app-` kebab-case, directivas `app` camelCase.

## Tests

Vitest + `TestBed` + jsdom. `src/test-setup.ts` fija `TZ=America/Argentina/Buenos_Aires` (sin eso los tests de fecha local pasan aunque la lógica esté rota) y parchea `HTMLDialogElement` (jsdom no implementa `showModal`).

- Todo `TestBed` lleva `provideZonelessChangeDetection()` en los providers.
- **No hay librería de mocks**: los dobles son objetos planos casteados al contrato (`as CourtsRepository`), típicamente con un array de `calls` para verificar método+path+body.

## Estilos

Cuatro capas, en ese orden en `angular.json`: `styles/brand.css` (paleta y fuentes, **por producto** — cada color trae su comentario de contraste AA) → `styles/tokens.css` (design system no de marca: espaciado, sombras, radios, tipografía, semánticos como `--color-warning-*`) → `styles/components.css` (primitivos globales: `.btn`, `.field`, `.modal`) → `*.component.css` por feature (encapsulado). Regla de admisión a `components.css`: es vocabulario del DS (*qué es*, no *dónde va*) **y** tiene un consumidor real hoy. Ojo: `shell.component.css` redefine la escala `--text-*` en su `:host`, así que un primitivo renderiza más denso dentro del shell que fuera.

Los iconos de nav y el arte de los estados vacíos/error/loading (`state-*` de `PlaceholderComponent`) no son SVG inline: salen del registro `ICONS` (`product/icons.ts`, token `@config/icons`) vía `<app-icon name="..." />` (`shared/ui/icon.component.ts`).

`docs/maquetas/*.html` son maquetas estáticas de referencia, no parte del build.

## Docs

`docs/superpowers/specs/` (diseño aprobado) y `docs/superpowers/plans/` (plan de implementación task-by-task). Los comentarios del código citan secciones del spec como `§4.3` — ese es el documento al que refieren.

## Template

Este repo es el kernel de un template, no sólo el backoffice de Pipofy. Para arrancar un producto nuevo (qué tocar, cómo borrar features que no aplican, cómo generar un slice con `npm run new-slice`) ver **`docs/TEMPLATE.md`**.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
