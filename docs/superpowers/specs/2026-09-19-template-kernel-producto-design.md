# Template: kernel + producto

Fecha: 2026-09-19 · Rama: `feat/template-kernel` · Estado: implementado en la rama feat/template-kernel (2026-09-19); ver docs/superpowers/plans/2026-09-19-template-kernel-producto.md

## 1. Objetivo

Este repositorio pasa a ser un **template** de backoffice Angular 20. Pipofy es su primer producto. Un producto nuevo se arma clonando el repo y editando **sólo la superficie de producto** (§2): marca, colores, fuentes, logos, iconos, navegación, locale, prefijo de storage y configuración de red. Todo lo demás (auth, HTTP, errores, SignalStore, layout, primitivos de UI, patrón de slice) es **kernel** y no se toca por producto.

Principio rector: **el kernel define contratos; el producto los implementa o los provee como datos.** Ninguna feature, ni el layout, ni `shared` importan una implementación concreta de `core/data` ni un archivo de `product/`.

### Fuera de alcance

- Monorepo o librería publicable (`ng-packagr`). Las boundaries de eslint ya dan la garantía sin el costo de empaquetar.
- Cambiar el flujo de auth (JWT + refresh rotativo + `X-Tenant-Id`) o el contrato con el backend NestJS. Sólo se parametrizan las URLs.
- i18n, dark mode, librería de iconos, schematics de Angular CLI.
- Tocar la lógica de las features de Pipofy (grupos, reservas, etc.) más allá de los swaps de import que exige §4.

## 2. Superficie de producto

Lo único que un producto nuevo edita. Es la checklist de `docs/TEMPLATE.md`.

| Qué | Dónde | Contenido |
|---|---|---|
| Marca y runtime | `src/app/product/app-config.ts` | nombre, tagline, prefijo de storage, locale, rutas de logos, links del footer, etiquetas de rol |
| Navegación | `src/app/product/nav.ts` | grupos e items de la sidebar y la tab-bar |
| Iconos e ilustraciones | `src/app/product/icons.ts` | registro `nombre → markup SVG` para nav y estados vacíos |
| Paleta y fuentes | `styles/brand.css` | sólo los tokens de marca; `tokens.css` no se toca |
| Logos y favicon | `public/brand/` | archivos |
| Fuente web y título | `src/index.html` | `<link>` de la fuente, `<title>`, favicon |
| Rutas | `src/app/app.routes.ts` | qué features existen y bajo qué path |
| Red por ambiente | `.env.development` / `.env.staging` / `.env.production` | `NG_API_BASE_URL` y las opcionales |
| Nombre del proyecto | `package.json`, `angular.json`, `render.yaml` | se documenta, no se automatiza |

`src/app/product/` es un elemento de boundaries que **sólo puede importar `core/config` y `shared`**, y que **nadie importa salvo `app.config.ts`**. Así el producto queda como datos inyectados, nunca como dependencia de código.

## 3. Capas

Se agregan dos elementos a `eslint.config.js` y se gobierna `layout/`, que hoy está fuera de toda regla.

| Capa | Path | Puede importar |
|---|---|---|
| `config` (nuevo) | `src/app/core/config` (alias `@config/*`) | nada del proyecto. Sólo tipos e `InjectionToken`s |
| `domain` | `src/app/core/domain` | `domain`. Sin `@angular/*` |
| `data` | `src/app/core/data` | `domain`, `data`, `config` |
| `shared` | `src/app/shared` | `shared`, `config` |
| `layout` (nuevo) | `src/app/layout` | `domain`, `shared`, `config`, `auth` |
| `auth` (nuevo) | `src/app/features/auth` | `domain`, `data`, `shared`, `config`. Es la feature del kernel, no del producto |
| `features/<x>` | `src/app/features/*` | `domain`, `data`, `shared`, `config`. Nunca otra feature |
| `product` (nuevo) | `src/app/product` | `config`, `shared` |

`core/config` existe porque es la única capa que `data` y `shared` pueden compartir: `shared` no puede importar `domain` (debe seguir siendo UI agnóstica del negocio) y `data` no puede importar `shared`. Contiene cuatro archivos:

- `app-config.ts`: `interface AppConfig` + `APP_CONFIG`, con default por `factory` (marca neutra del kernel).
- `api-config.ts`: `interface ApiConfig` (`apiBaseUrl`, `realtimeBaseUrl?`) + `API_CONFIG`. Reemplaza a `core/data/config/api-config.token.ts`, que se borra. **Sin** default: una app sin URL de API no puede hacer nada útil, mejor que falle al inyectar.
- `nav.ts`: `NavConfig` (`NavItem`, `NavChild`) (hoy en `layout/nav.model.ts`) + `NAV_CONFIG`, con default por `factory` (`{ groups: [], items: [] }`).
- `icons.ts`: `IconRegistry = Readonly<Record<string, string>>` + `ICONS`, con default por `factory` (`{}`).

`APP_CONFIG`, `NAV_CONFIG` e `ICONS` tienen default por `factory` en su propio token: los specs corren sin proveerles nada. `API_CONFIG` es la excepción a propósito (arriba).

`layout → auth` se permite explícitamente porque el shell hace logout vía `SessionFacade`, y auth es una feature del kernel, no del producto.

Nota: los comentarios y docstrings van en **español** en todo el repo, también en `core/`; lo que va en inglés son identificadores, nombres de archivo y APIs.

### `AppConfig`

`AppConfig` **no** lleva la red: eso vive aparte en `ApiConfig`/`API_CONFIG` (arriba), porque tiene
una regla distinta (sin default). `footerLinks` es `{ label, href: string | null }`: `href: null`
es "la página todavía no existe", se renderiza sin destino.

```ts
export interface AppConfig {
  readonly brand: {
    readonly name: string;            // 'PipoFy'
    readonly tagline: string;         // copy del footer
    readonly logoHorizontal: string;  // 'brand/logo-horizontal.svg'
    readonly footerLinks: readonly { readonly label: string; readonly href: string | null }[];
  };
  readonly locale: string;            // 'es-AR'. Se provee además como LOCALE_ID
  readonly storagePrefix: string;     // 'PipoFy'. Toda clave de storage es `${prefix}:<nombre>:v<N>`
  readonly roleLabels: Readonly<Record<string, string>>;
}
```

`product/index.ts` arma `PRODUCT_PROVIDERS: Provider[]` con `APP_CONFIG`, `API_CONFIG` (los valores
de `environment`, generado por `set-env.mjs`), `NAV_CONFIG` e `ICONS`. `app.config.ts` hace
`...PRODUCT_PROVIDERS` y deja de conocer `environment` directamente; `LOCALE_ID` lo provee el propio
`app.config.ts` con `{ provide: LOCALE_ID, useFactory: () => inject(APP_CONFIG).locale }`, porque es
el kernel el que publica el locale del producto como token de Angular, no el producto el que conoce
`LOCALE_ID`.

## 4. Contratos en `domain` para lo que hoy es concreto

Mismo patrón que los 13 repositorios existentes: clase abstracta en `domain/contracts`, implementación en `data`, binding en providers. Se revierte a propósito la decisión anterior de dejar estas tres clases concretas ("no hay dos implementaciones"): para el template son justamente los seams que cambian.

| Contrato (domain) | Implementación (data) | Consumidores que cambian el import |
|---|---|---|
| `SessionStore` (`contracts/session-store.ts`) | `LocalStorageSessionStore` | guard, `SessionFacade`, `PasswordFacade`, dashboard page, shell, `TokenRefresher`, interceptor |
| `CatalogsRepository` (`contracts/catalogs.repository.ts`) | `HttpCatalogsRepository` | 7 archivos de features |
| `UsersRepository` (`contracts/users.repository.ts`) | `HttpUsersRepository` | `ProfesoresFacade`, shell |

Detalles:

- **`SessionStore` abstracto.** Los lectores se declaran como propiedades de tipo función (`abstract readonly isAuthenticated: () => boolean`, `roles: () => readonly string[]`, `clubId`, `mustChangePassword`, `accessToken`, `refreshToken`) para que los `computed()` de la implementación los satisfagan y sigan siendo reactivos al leerse dentro de otro `computed`. Los escritores (`set`, `setTokens`, `passwordChanged`, `clear`) son métodos abstractos. `jwt-claims.ts` y la persistencia en `localStorage` quedan en `data`; la clave pasa a `${storagePrefix}:session:v1` leyendo `APP_CONFIG`.
- **`CatalogItem`** pasa a `domain/entities/catalog-item.ts` (`{ id, name }`). El schema valibot sigue en `data/dto/catalogs.dto.ts`; las features dejan de importar el DTO.
- **`CurrentUser`** entra a `domain/entities/current-user.ts` con `displayName` ya resuelto por el mapper (hoy `currentUserName()` en el DTO). `UsersRepository.me()` devuelve la entidad.
- **`catalog-labels.ts`** se mueve a `domain/catalog-labels.ts`. Es copy del producto sobre nombres del seed, TS puro; ya lo consumen `data` y `features`, y desde `domain` los dos pueden importarlo sin excepción.
- **`asDomainError(e: unknown): DomainError`** en `domain/errors.ts`: passthrough si ya es `DomainError`, `{ kind: 'domain' }` si es `DomainRuleError`, `{ kind: 'unknown', cause }` en otro caso. `toDomainError` de `data` lo llama como último paso y conserva los casos HTTP y valibot. Los 19 archivos de features que hoy importan `@data/http/to-domain-error` pasan a `asDomainError`: los repos ya normalizan, así que la facade sólo necesita cubrir el `DomainRuleError` síncrono de `createXDraft`.

Con esto, en código de producción `features/*` importa de `@data` **únicamente** en `<feature>.providers.ts` (los `useClass`). Ese es el único lugar legítimo y queda documentado en CLAUDE.md. Excepción: un `*.spec.ts` sí puede importar una implementación concreta de `@data` para cablear el `TestBed` — no es código de producción.

## 5. Layout

- El shell inyecta `NAV_CONFIG` en vez de importar `NAV_ITEMS`. `layout/nav.model.ts` se borra: tipos a `core/config/nav.ts`, datos a `product/nav.ts`. En `product/nav.ts` el campo `icon` se tipa como `keyof typeof ICONS` para que un nombre inexistente no compile.
- Nuevo `shared/ui/icon.component.ts` (`<app-icon name="..." />`): lee `ICONS`, renderiza el markup con `DomSanitizer.bypassSecurityTrustHtml`. Es seguro porque el registro es una constante del repo, nunca entrada de usuario; el comentario lo dice. Un nombre desconocido renderiza vacío; con el registro vacío (default del token, kernel sin iconos configurados) eso es silencio a propósito, pero con el registro configurado (tiene entradas) sí avisa por `console.warn` una vez por nombre — ahí es configuración rota.
- El `@switch` de 7 SVG de `shell.component.html` y el mismo bloque de la tab-bar móvil se reemplazan por `<app-icon>`. Los SVG de cromo del kernel (hamburguesa, chevrón, cerrar sesión, cerrar modal) **se quedan inline**: no son de producto.
- Las 4 ilustraciones de `PlaceholderComponent` (pelota y paleta) también van al registro con nombres `state-empty`, `state-error`, `state-loading`, `state-wip`. La animación del estado `loading` pasa a un `style` inline sobre el `<g>` dentro del markup, porque el contenido inyectado por `innerHTML` no recibe el scope de estilos del componente.
- `ROLE_LABELS` del shell → `config.roleLabels`. El fallback al rol crudo se mantiene.
- Reloj del shell: `Intl.DateTimeFormat(inject(LOCALE_ID), …)`. `plan-price.ts` recibe el locale como parámetro; su llamador lo inyecta.
- Título por defecto, footer (`tagline`, `© ${año} ${name}`, links), `BrandmarkComponent` (`src`, `alt`, `aria-label`) y los 4 textos de onboarding y verify-email leen `config.brand`. El `alt` y el `aria-label` del logo salen de `brand.name`; para Pipofy es `'PipoFy'` (antes el alt decía `'Pipofy'`, inconsistente con el resto del copy).
- Los dos `IdSetHintStore` de Configuración y `OnboardingPersistenceService` construyen su clave con `storagePrefix`. Con Pipofy el valor resultante es **idéntico** al actual, así que los navegadores no pierden nada.

## 6. Estilos

`styles/tokens.css` se parte en dos, y `angular.json` carga `brand.css` antes que `tokens.css`:

- `styles/brand.css`: **sólo** lo que cambia por marca. Paleta base (`--color-primary`, `-foreground`, `-background`, `-muted`, `-border`, `-border-strong`), derivados de marca (`-primary-hover/-strong/-soft`, familia `-accent-*`), fuentes (`--font-heading`, `--font-body`), y los tokens de sidebar que hoy son 5 hex sueltos en `shell.component.css` (`--color-sidebar-*`, `--color-live`). Cada valor conserva su comentario de contraste AA: quien cambie la paleta hereda la obligación de verificarlo.
- `styles/tokens.css`: lo que no es marca. Espaciado, sombras, radios, z-index, movimiento, escala tipográfica, semánticos no de marca (`--color-destructive-*`, `--color-warning-*`), reset y base. Se borra el bloque `.brandmark .bm-logo/.bm-name/.bm-sub`, muerto desde que `BrandmarkComponent` renderiza un `<img>`.
- El hex de `grupo-detail-page.component.css:10` (hero de grupo) pasa a `--color-on-primary-strong-muted` en `brand.css`. El `#CBD5E1` del toast (`components.css`) y del reloj del topbar (`shell.component.css`) pasa a `--color-on-primary-strong-subtle`, su par en `brand.css` (`muted` = más contraste, `subtle` = menos). `--color-on-warning-mark` (texto sobre `--color-warning-mark`) vive en `tokens.css`, con el resto de la familia warning.
- `components.css` no cambia.

## 7. Configuración de build y ambientes

- `set-env.mjs`: `REQUIRED` queda en `['NG_API_BASE_URL']`. Toda clave `NG_*` presente se emite convertida a camelCase (`NG_API_BASE_URL → apiBaseUrl`); las ausentes no se emiten. `environment.model.ts` declara `apiBaseUrl: string` y el resto como opcionales. El `satisfies Environment` del archivo generado es el chequeo de tipos: un producto que agrega una clave la declara en el modelo y en su `.env`.
- Se borran de `Environment`, `.env.example` y `render.yaml` las claves sin consumidor: `NG_STORAGE_BASE_PATH` y `NG_MERCADOPAGO_PUBLIC_KEY`. `NG_REALTIME_BASE_URL` queda opcional porque `SseRealtimeConnection` existe aunque nadie lo consuma.
- `test-set-env.mjs` se actualiza al nuevo contrato (obligatoria única, opcionales pasan, secretos siguen abortando).
- `.nvmrc` con `22.12.0` y `"engines": { "node": ">=22.12" }` en `package.json`, para que el equipo y Render usen la misma versión.
- El archivo generado declara `environment: Environment` (anotación de tipo, no `satisfies`): una clave de más rompe el build con un error de TS que la nombra, y una clave opcional ausente (p. ej. `realtimeBaseUrl` en un ambiente sin `NG_REALTIME_BASE_URL`) no ensancha el tipo pero tampoco rompe a los consumidores, porque el modelo ya la declara opcional. `product/index.ts` lee `environment.apiBaseUrl` / `environment.realtimeBaseUrl` directo, sin re-tipar nada.

## 8. Generador de slices

`scripts/new-slice.mjs <entity> <entities> <feature> <label>`, por ejemplo `node scripts/new-slice.mjs court courts canchas cancha`. Sin dependencias, ~60 líneas.

- Lee `scripts/slice-template/`, un slice **mínimo** (`{ id, name }`) con placeholders `__Entity__`, `__entity__`, `__entities__`, `__Feature__`, `__feature__`, `__Label__`, `__label__` — no una copia del slice real de canchas. Se mantiene compilando porque no está bajo `src/`. Son 15 archivos de plantilla en total.
- Genera: `domain/entities/<entity>.ts`, `domain/contracts/<entities>.repository.ts`, `data/dto/<entities>.dto.ts`, `data/mappers/<entity>.mapper.ts`, `data/repositories/http-<entities>.repository.ts`, `features/<feature>/<feature>.facade.ts`, `features/<feature>/<feature>-form-modal.component.ts`, `features/<feature>/pages/<feature>-page.component.{ts,html,css}`, `features/<feature>/<feature>.providers.ts`, `features/<feature>/<feature>.routes.ts`, y los specs de entidad, mapper y facade.
- **Nunca sobreescribe**: si algún destino existe, aborta antes de escribir nada.
- Antes de imprimir los pasos manuales, anexa automáticamente `Invalid<Entity>Error extends DomainRuleError` a `domain/errors.ts` (si no existe ya una clase con ese nombre) — no queda a mano. Termina imprimiendo los tres pasos que SÍ son manuales: la ruta lazy en `app.routes.ts`, el item en `product/nav.ts` (con su icono en `product/icons.ts`), y completar los campos reales — la plantilla trae sólo `name`.
- `test-new-slice.mjs`: genera en un directorio temporal y verifica que existen los archivos y que no queda ningún `__` placeholder. Mismo estilo que `test-set-env.mjs`.

## 9. Documentación y limpieza del repo

- `README.md` reemplaza el boilerplate de Angular CLI: qué es, comandos, resumen de capas, link a `docs/TEMPLATE.md` y a `CLAUDE.md`.
- `docs/TEMPLATE.md`: la checklist de §2 paso a paso para un producto nuevo, más "cómo agregar un slice" y "cómo agregar un icono".
- `CLAUDE.md` queda trackeado y actualizado con las capas nuevas y la regla "features importan `@data` sólo en providers".
- Maquetas `index-v2.html`, `onboarding.html`, `pipofy_1.html` → `docs/maquetas/`, con sus `<link href="styles/...">` reapuntados. `assets/` (brandboard) → `docs/brandboard/`. La raíz queda con lo que hace al build.
- `main.ts` vacío de la raíz se borra.

## 10. Verificación

- Los 1161 tests existentes son la red: el refactor no cambia comportamiento, así que deben pasar con cambios sólo en imports y dobles (`as SessionStore` sigue funcionando sobre la abstracta).
- Tests nuevos, uno por seam: `IconComponent` (renderiza el markup del registro y avisa en nombre desconocido), `asDomainError` (los tres casos), `LocalStorageSessionStore` usa el prefijo de `APP_CONFIG`, mapper de `CurrentUser.displayName` (reemplaza el de `currentUserName`), `test-set-env.mjs` y `test-new-slice.mjs`.
- `npm run lint` con las boundaries nuevas es la prueba de que ninguna feature importa `@data` fuera de providers ni `product/`.
- Verificación manual final con `npm start`: login, dashboard, una pantalla de Configuración, onboarding y un 404, comparando visualmente contra `main`.

## 11. Orden de implementación

Cada paso deja lint y tests en verde; el plan lo detalla task por task.

1. Boundaries y `core/config` (tokens, tipos) sin consumidores todavía.
2. `product/` con los valores actuales de Pipofy + `PRODUCT_PROVIDERS` en `app.config.ts`. Borrar `API_CONFIG`.
3. Contratos de dominio (§4) y swaps de import en features y layout.
4. Layout: nav por token, `IconComponent`, placeholders, locale, copy de marca, prefijos de storage.
5. Split de estilos (§6).
6. Build y ambientes (§7).
7. Generador de slices (§8).
8. Docs y limpieza (§9).
