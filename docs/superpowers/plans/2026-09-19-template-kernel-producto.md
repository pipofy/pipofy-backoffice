# Template kernel + producto — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el repo en un template donde un producto nuevo edita sólo `src/app/product/`, `styles/brand.css`, `public/brand/`, `index.html`, `app.routes.ts` y sus `.env.*`; todo lo demás es kernel que depende de contratos, no de implementaciones.

**Architecture:** Se agrega la capa `core/config` (tokens `APP_CONFIG`, `API_CONFIG`, `NAV_CONFIG`, `ICONS` con defaults neutros vía `factory`) que `data` y `shared` pueden compartir. `product/` provee los valores de Pipofy y nadie lo importa salvo `app.config.ts`. Las tres clases concretas que hoy inyectan las features (`SessionStore`, `CatalogsRepository`, `UsersRepository`) pasan a contratos abstractos en `domain` con implementación en `data`, y `asDomainError` en `domain` saca de las features el último import de `@data/http`. El layout entra a las boundaries; los iconos y las ilustraciones salen de un registro inyectado.

**Tech Stack:** Angular 20 standalone + zoneless + signals · valibot · Vitest + TestBed + jsdom · `eslint-plugin-boundaries` · scripts Node sin dependencias (`set-env.mjs`, `new-slice.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-19-template-kernel-producto-design.md`

**Rama:** `feat/template-kernel` (ya creada; el spec está commiteado ahí).

## Global Constraints

- **Capas (error de lint, no convención).** Al terminar la Task 1 rigen estas: `config` no importa nada del proyecto · `domain` sólo `domain`, sin `@angular/*` · `data` → `domain`, `data`, `config` · `shared` → `shared`, `config` · `layout` → `domain`, `shared`, `config`, `features/auth` · `features/<x>` → `domain`, `data`, `shared`, `config`, nunca otra feature · `product` → `config`, `shared`. Usar siempre alias: `@config/*`, `@domain/*`, `@data/*`, `@shared/*`, `@features/*`.
- **Regla nueva del template:** `features/*` importa de `@data` **sólo** en `<feature>.providers.ts` (los `useClass`). Cualquier otro import de `@data` en una feature es un bug del plan.
- **Idioma:** comentarios, copy de UI y nombres de feature/rutas en **español**; `core/` y `product/` en **inglés** (los valores de copy dentro de `product/` van en español).
- **Angular:** `ChangeDetectionStrategy.OnPush`, `inject()`, `signal`/`computed`, `input()`/`output()`. Nada de NgModules, Zone.js ni RxJS en facades.
- **Tests:** todo `TestBed` lleva `provideZonelessChangeDetection()`. Sin librería de mocks: dobles como objetos planos casteados al contrato. Un spec solo: `npx ng test --include <ruta>`. Suite completa: `npm test`. Lint: `npm run lint`.
- **Prettier:** `printWidth: 100`, `singleQuote: true`. macOS: `sed -i ''` (con string vacío).
- **Commits:** mensaje en español, estilo `tipo(alcance): qué`. **Sin línea `Co-Authored-By`** (preferencia del repo).
- **Comportamiento:** ninguna task cambia lo que ve el usuario de Pipofy. Las claves de storage resultantes son idénticas a las actuales (`PipoFy:session:v1`, etc.). Si un test existente cambia, es sólo por imports, providers o por el prefijo `app:` que usa el default del kernel en tests.
- **Verificación por task:** `npm run lint` y `npm test` en verde antes de commitear.

---

### Task 1: Capa `core/config` + boundaries + alias

**Files:**
- Create: `src/app/core/config/app-config.ts`
- Create: `src/app/core/config/api-config.ts`
- Create: `src/app/core/config/nav.ts`
- Create: `src/app/core/config/icons.ts`
- Modify: `tsconfig.json` (paths)
- Modify: `eslint.config.js` (bloque `boundaries`)

**Interfaces:**
- Produces: `AppConfig`, `AppBrand`, `APP_CONFIG`, `DEFAULT_APP_CONFIG`, `storageKey(config, name, version)` · `ApiConfig`, `API_CONFIG` · `NavConfig`, `NavItem`, `NavChild`, `BadgeKey`, `NAV_CONFIG` · `IconRegistry`, `ICONS`. Todos los tokens tienen default neutro por `factory`, así ningún spec necesita proveerlos.

- [ ] **Step 1: Crear los cuatro archivos de `core/config`**

`src/app/core/config/app-config.ts`:

```ts
import { InjectionToken } from '@angular/core';

export interface AppBrand {
  /** Nombre comercial: título por defecto, alt del logo, copy ("Ya podés entrar a X"). */
  readonly name: string;
  /** Una línea de descripción, la usa el pie. '' = no se muestra. */
  readonly tagline: string;
  /** Ruta pública del lockup horizontal, relativa a `public/` (p. ej. 'brand/logo-horizontal.svg'). */
  readonly logoHorizontal: string;
  /** Links del pie. `href: null` = todavía no existe la página; se renderiza sin destino. */
  readonly footerLinks: readonly { readonly label: string; readonly href: string | null }[];
}

export interface AppConfig {
  readonly brand: AppBrand;
  /** BCP 47. Se provee además como LOCALE_ID de Angular. */
  readonly locale: string;
  /** Prefijo de TODA clave de storage: `${storagePrefix}:<nombre>:v<N>` (ver storageKey). */
  readonly storagePrefix: string;
  /** Rol crudo del JWT → etiqueta. Un rol que no está acá se muestra crudo. */
  readonly roleLabels: Readonly<Record<string, string>>;
}

/**
 * Valores neutros del kernel. El producto los reemplaza en PRODUCT_PROVIDERS (product/index.ts);
 * los specs no proveen nada y corren con estos. `locale` es es-AR porque el copy del kernel
 * (errores, placeholders) ya está en ese español: el kernel no es agnóstico de idioma.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  brand: { name: 'App', tagline: '', logoHorizontal: '', footerLinks: [] },
  locale: 'es-AR',
  storagePrefix: 'app',
  roleLabels: {},
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_CONFIG,
});

/** Clave de storage versionada. Un cambio de formato estrena versión en vez de migrar. */
export function storageKey(config: AppConfig, name: string, version: number): string {
  return `${config.storagePrefix}:${name}:v${version}`;
}
```

`src/app/core/config/api-config.ts`:

```ts
import { InjectionToken } from '@angular/core';

/** Red por ambiente. Sale de `environment.*.ts` (generado por set-env.mjs) vía product/index.ts. */
export interface ApiConfig {
  readonly apiBaseUrl: string;
  /** Opcional: SseRealtimeConnection no tiene consumidor todavía. */
  readonly realtimeBaseUrl?: string;
}

/** Sin default: una app sin URL de API no puede hacer nada útil, mejor que falle al inyectar. */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
```

`src/app/core/config/nav.ts`:

```ts
import { InjectionToken } from '@angular/core';

export type BadgeKey = 'alerts' | 'payments';

/** Sub-destino de la sidebar. Sin icono ni badge: es una lista de texto indentada. */
export interface NavChild {
  readonly label: string;
  readonly path: string; // ruta absoluta
}

export interface NavItem {
  readonly label: string; // etiqueta en la sidebar
  readonly short: string; // etiqueta en la tab-bar móvil
  readonly path: string; // ruta absoluta
  readonly group: string; // uno de NavConfig.groups
  readonly icon: string; // clave del registro ICONS
  readonly badge?: BadgeKey;
  /** Con hijos, el item NO navega: despliega. La tab-bar móvil los ignora y linkea a `path`. */
  readonly children?: readonly NavChild[];
}

export interface NavConfig {
  readonly groups: readonly string[];
  readonly items: readonly NavItem[];
}

export const NAV_CONFIG = new InjectionToken<NavConfig>('NAV_CONFIG', {
  providedIn: 'root',
  factory: () => ({ groups: [], items: [] }),
});
```

`src/app/core/config/icons.ts`:

```ts
import { InjectionToken } from '@angular/core';

/**
 * nombre → markup `<svg …>…</svg>` completo. Es una constante del repo (product/icons.ts),
 * nunca entrada de usuario: por eso IconComponent puede inyectarlo con bypassSecurityTrustHtml.
 */
export type IconRegistry = Readonly<Record<string, string>>;

export const ICONS = new InjectionToken<IconRegistry>('ICONS', {
  providedIn: 'root',
  factory: () => ({}),
});
```

- [ ] **Step 2: Alias `@config/*` en `tsconfig.json`**

En `compilerOptions.paths`, agregar antes de `@domain/*`:

```json
      "@config/*": ["src/app/core/config/*"],
```

- [ ] **Step 3: Reescribir el bloque de boundaries en `eslint.config.js`**

Reemplazar `"boundaries/elements"` y la regla `"boundaries/dependencies"` por esto (dejar `"boundaries/external"` como está):

```js
      "boundaries/elements": [
        { type: "config", pattern: "src/app/core/config" },
        { type: "domain", pattern: "src/app/core/domain" },
        { type: "data", pattern: "src/app/core/data" },
        { type: "shared", pattern: "src/app/shared" },
        { type: "layout", pattern: "src/app/layout" },
        // ANTES de features/*: auth es la feature del kernel y el único destino que layout
        // puede importar (el shell hace logout vía SessionFacade). Si el plugin no priorizara
        // este patrón sobre el genérico, el Step 4 lo detecta.
        { type: "auth", pattern: "src/app/features/auth" },
        { type: "features", pattern: "src/app/features/*", capture: ["feature"] },
        { type: "product", pattern: "src/app/product" },
      ],
```

```js
      "boundaries/dependencies": ["error", {
        default: "disallow",
        policies: [
          // config no aparece como `from`: sólo puede importarse a sí mismo (relación interna).
          { from: { element: { type: "domain" } }, allow: { to: { element: { type: "domain" } } } },
          { from: { element: { type: "data" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "config"] } } } } },
          { from: { element: { type: "shared" } }, allow: { to: { element: { types: { anyOf: ["shared", "config"] } } } } },
          { from: { element: { type: "layout" } }, allow: { to: { element: { types: { anyOf: ["domain", "shared", "config", "auth"] } } } } },
          { from: { element: { type: "auth" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "shared", "config"] } } } } },
          { from: { element: { type: "features" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "shared", "config"] } } } } },
          // product es DATOS del producto: lo consume app.config.ts (fuera de elements) y nadie más.
          { from: { element: { type: "product" } }, allow: { to: { element: { types: { anyOf: ["config", "shared"] } } } } },
        ],
      }],
```

- [ ] **Step 4: Verificar las boundaries con violaciones deliberadas**

```bash
# (a) shared → domain debe FALLAR
echo "import { DomainError } from '@domain/errors'; export type X = DomainError;" > src/app/shared/tmp-violation.ts
npm run lint 2>&1 | grep -c "tmp-violation"        # esperado: >= 1
rm src/app/shared/tmp-violation.ts

# (b) feature → auth debe FALLAR (auth sigue siendo "otra feature" para el resto)
echo "import { authGuard } from '@features/auth/auth.guard'; export const g = authGuard;" > src/app/features/alumnos/tmp-violation.ts
npm run lint 2>&1 | grep -c "tmp-violation"        # esperado: >= 1
rm src/app/features/alumnos/tmp-violation.ts

# (c) layout → auth debe PASAR
echo "import { authGuard } from '@features/auth/auth.guard'; export const g = authGuard;" > src/app/layout/tmp-ok.ts
npm run lint 2>&1 | grep -c "tmp-ok"               # esperado: 0
rm src/app/layout/tmp-ok.ts
```

Si (c) falla, el plugin no está priorizando el patrón `auth` sobre `features/*`: cambiar el patrón de `features` a `"src/app/features/!(auth)"` (glob negado) y repetir (b) y (c).

- [ ] **Step 5: Lint y tests en verde; commit**

```bash
npm run lint && npm test
# CLAUDE.md está sin trackear y el equipo lo necesita: entra acá (Task 12 lo actualiza).
git add src/app/core/config tsconfig.json eslint.config.js CLAUDE.md
git commit -m "feat(config): capa core/config con tokens de app, api, nav e iconos; boundaries para layout, auth y product"
```

---

### Task 2: `product/` y `PRODUCT_PROVIDERS`; `API_CONFIG` se muda a `core/config`

**Files:**
- Create: `src/app/product/app-config.ts`
- Create: `src/app/product/index.ts`
- Delete: `src/app/core/data/config/api-config.token.ts`
- Modify: `src/app/app.config.ts`
- Modify (sólo path del import): `src/app/core/data/http/api-client.ts`, `src/app/core/data/repositories/http-auth.repository.ts`, `src/app/core/data/repositories/http-category-groups.repository.ts`, `src/app/core/data/repositories/http-plans.repository.ts`, `src/app/core/data/realtime/sse-realtime-connection.ts`, y los 10 specs que importan `api-config.token`

**Interfaces:**
- Consumes: `APP_CONFIG`, `API_CONFIG` (Task 1).
- Produces: `PIPOFY_CONFIG: AppConfig`, `PRODUCT_PROVIDERS: Provider[]`.

- [ ] **Step 1: Crear `src/app/product/app-config.ts`**

```ts
import { AppConfig } from '@config/app-config';

/**
 * Marca y copy de Pipofy. Es la superficie de producto: un producto nuevo edita este archivo,
 * product/nav.ts, product/icons.ts, styles/brand.css y public/brand/. Ver docs/TEMPLATE.md.
 */
export const PIPOFY_CONFIG: AppConfig = {
  brand: {
    name: 'PipoFy',
    tagline: 'Gestión de clubes de pádel y tenis: grupos, créditos, pagos y WhatsApp en un solo lugar.',
    logoHorizontal: 'brand/logo-horizontal.svg',
    // ponytail: href null = las páginas no existen. Techo: un producto real las necesita.
    // Salida: crearlas y poner la ruta.
    footerLinks: [
      { label: 'Términos', href: null },
      { label: 'Privacidad', href: null },
      { label: 'Soporte', href: null },
    ],
  },
  locale: 'es-AR',
  // NO cambiar: los navegadores que ya tienen sesión/pistas guardadas las conservan.
  storagePrefix: 'PipoFy',
  /** Los cuatro roles que siembra el backend en el signup. */
  roleLabels: {
    admin: 'Administrador',
    encargado: 'Encargado',
    profesor: 'Profesor',
    superprofesor: 'Superprofesor',
  },
};
```

- [ ] **Step 2: Crear `src/app/product/index.ts`**

```ts
import { LOCALE_ID, Provider } from '@angular/core';
import { API_CONFIG } from '@config/api-config';
import { APP_CONFIG } from '@config/app-config';
import { environment } from '../../environments/environment';
import { PIPOFY_CONFIG } from './app-config';

/** Lo único que app.config.ts sabe del producto. */
export const PRODUCT_PROVIDERS: Provider[] = [
  { provide: APP_CONFIG, useValue: PIPOFY_CONFIG },
  { provide: LOCALE_ID, useValue: PIPOFY_CONFIG.locale },
  {
    provide: API_CONFIG,
    useValue: { apiBaseUrl: environment.apiBaseUrl, realtimeBaseUrl: environment.realtimeBaseUrl },
  },
];
```

- [ ] **Step 3: Mover los imports de `API_CONFIG` y borrar el token viejo**

```bash
grep -rl "api-config.token" src --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/config/api-config.token'#'@config/api-config'#" \
  -e "s#'\.\./config/api-config.token'#'@config/api-config'#"
git rm src/app/core/data/config/api-config.token.ts
grep -rn "api-config.token" src   # esperado: vacío
```

En `src/app/core/data/realtime/sse-realtime-connection.ts` (el campo ahora es opcional):

```ts
  private readonly realtimeBaseUrl = inject(API_CONFIG).realtimeBaseUrl ?? '';
```

- [ ] **Step 4: `app.config.ts` deja de conocer `environment`**

Reemplazar el archivo completo por:

```ts
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { PRODUCT_PROVIDERS } from './product';
import { tenantInterceptor } from './shared/http/tenant.interceptor';
import { errorLogInterceptor } from './shared/http/error-log.interceptor';
import { authInterceptor } from './core/data/http/auth.interceptor';
import { TokenRefresher } from './core/data/http/token-refresher';
import { SessionStore } from './core/data/auth/session-store';
import { SessionFacade } from '@features/auth/session.facade';
import { ClubRepository } from '@domain/contracts/club.repository';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { HttpAuthRepository } from '@data/repositories/http-auth.repository';
import { HttpClubRepository } from '@data/repositories/http-club.repository';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { UsersRepository } from '@data/repositories/users.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorLogInterceptor])),
    // Marca, locale, nav, iconos y red del producto. Es el ÚNICO lugar que importa product/.
    ...PRODUCT_PROVIDERS,
    // Auth va en ROOT y no en la ruta lazy de la feature (rompiendo la convención del resto
    // del proyecto a propósito): el interceptor puede necesitar refrescar en CUALQUIER
    // request y el guard corre antes de que exista ninguna ruta lazy.
    SessionStore,
    SessionFacade,
    TokenRefresher,
    { provide: AuthRepository, useClass: HttpAuthRepository },
    // En ROOT y no en una ruta lazy, igual que AuthRepository: lo necesitan DOS rutas lazy
    // distintas — el dashboard (vía RefreshDashboard) y Configuración → Club.
    { provide: ClubRepository, useClass: HttpClubRepository },
    // Mismo motivo que ClubRepository: lo necesitan DOS rutas lazy distintas — Configuración
    // y el dashboard. Bindeado en cada ruta, cada una recibía su propio cache.
    CatalogsRepository,
    // En ROOT porque su único consumidor es ShellComponent, que vive en `layout/` y no
    // cuelga de ninguna ruta lazy.
    UsersRepository,
  ],
};
```

- [ ] **Step 5: Lint, tests, commit**

```bash
npm run lint && npm test
git add -A src/app/product src/app/app.config.ts src/app/core
git commit -m "feat(product): PRODUCT_PROVIDERS con marca y red de Pipofy; API_CONFIG vive en core/config"
```

---

### Task 3: `asDomainError` en `domain`; las features dejan de importar `@data/http`

**Files:**
- Modify: `src/app/core/domain/errors.ts`
- Create: `src/app/core/domain/as-domain-error.spec.ts`
- Modify: `src/app/core/data/http/to-domain-error.ts`
- Modify (sed): los 25 archivos de `features/` que importan `@data/http/to-domain-error` (19 fuente + 6 spec)
- Modify: `src/app/features/configuracion/id-set-hint.facade.ts` (comentario)

**Interfaces:**
- Produces: `asDomainError(err: unknown): DomainError` en `@domain/errors`.

- [ ] **Step 1: Escribir el test que falla**

`src/app/core/domain/as-domain-error.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { asDomainError, InvalidCourtError } from './errors';

describe('asDomainError', () => {
  it('un DomainError ya normalizado pasa sin cambios', () => {
    const err = { kind: 'forbidden' as const };
    expect(asDomainError(err)).toBe(err);
  });

  it('una DomainRuleError sale como kind domain con su mensaje', () => {
    expect(asDomainError(new InvalidCourtError('El nombre es obligatorio.'))).toEqual({
      kind: 'domain',
      message: 'El nombre es obligatorio.',
    });
  });

  it('cualquier otra cosa sale como unknown con la causa', () => {
    const boom = new Error('boom');
    expect(asDomainError(boom)).toEqual({ kind: 'unknown', cause: boom });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

```bash
npx ng test --include src/app/core/domain/as-domain-error.spec.ts
```
Esperado: FAIL, `asDomainError` no exportado.

- [ ] **Step 3: Implementar en `errors.ts`**

Agregar debajo de `isDomainError`:

```ts
/**
 * Normaliza lo que NO viene de HTTP: la vía síncrona de `createXDraft` (DomainRuleError) y
 * cualquier excepción inesperada. Los repositorios ya devuelven DomainError, así que esto es
 * todo lo que una facade necesita como `mapError` de SignalStore.run(). El caso HTTP y el de
 * valibot viven en `data/http/to-domain-error.ts`, que termina llamando acá.
 */
export function asDomainError(err: unknown): DomainError {
  if (isDomainError(err)) return err;
  if (err instanceof DomainRuleError) return { kind: 'domain', message: err.message };
  return { kind: 'unknown', cause: err };
}
```

`DomainRuleError` está declarada más abajo en el mismo archivo; es una clase, así que el hoisting no aplica a `instanceof` en tiempo de ejecución sólo si la función se llama después de cargar el módulo, que es siempre. Correr el spec: PASS.

- [ ] **Step 4: `toDomainError` delega en `asDomainError`**

Reemplazar la función en `src/app/core/data/http/to-domain-error.ts`:

```ts
export function toDomainError(err: unknown): DomainError {
  if (err instanceof v.ValiError) {
    return { kind: 'validation', issues: err.issues.map((i) => i.message) };
  }
  if (err instanceof HttpErrorResponse) {
    switch (err.status) {
      case 0: return { kind: 'network' };
      case 401: return { kind: 'unauthorized' };
      // 403 NO es 401: con rol `superprofesor` el 403 es permanente y decirle "tu sesión
      // expiró" lo manda a reloguearse para chocar con exactamente lo mismo (§4.7).
      case 403: return { kind: 'forbidden' };
      case 404: return { kind: 'not-found' };
      // En un CRUD el mensaje del backend ES el feedback útil.
      case 400:
      case 409: return { kind: 'domain', message: nestMessage(err) };
      default: return { kind: 'unknown', cause: err };
    }
  }
  // DomainError ya normalizado (idempotente), DomainRuleError, o cualquier otra cosa.
  return asDomainError(err);
}
```

Y el import: `import { DomainError, asDomainError } from '@domain/errors';` (sacar `DomainRuleError` e `isDomainError` si quedan sin uso).

- [ ] **Step 5: Reemplazar en las features**

```bash
grep -rl "toDomainError" src/app/features --include='*.ts' | xargs sed -i '' \
  -e "s#import { toDomainError } from '@data/http/to-domain-error';#import { asDomainError } from '@domain/errors';#" \
  -e "s/toDomainError/asDomainError/g"
# Archivos que quedaron con DOS imports de '@domain/errors' — unificarlos a mano en uno:
grep -rc "from '@domain/errors'" src/app/features --include='*.ts' | grep -v ':[01]$'
# Nada de las features debe importar @data/http:
grep -rn "@data/http" src/app/features src/app/layout   # esperado: vacío
```

En `id-set-hint.facade.ts` reemplazar el párrafo del docstring que empieza con "Vive en `features/configuracion/` y no en `shared/`" por:

```ts
 * Vive en `features/configuracion/` y no en `shared/` porque tipa su error como `DomainError`,
 * y `shared` no puede importar `domain`. Las dos pantallas que la extienden son tabs de la
 * MISMA feature, así que el import entre hermanas es interno y legal.
```

- [ ] **Step 6: Lint, tests, commit**

```bash
npm run lint && npm test
git add -A src/app
git commit -m "refactor(domain): asDomainError en domain; las features dejan de importar @data/http"
```

---

### Task 4: `CatalogItem` + `CatalogsRepository` abstracto + `catalog-labels` a `domain`

**Files:**
- Create: `src/app/core/domain/entities/catalog-item.ts`
- Create: `src/app/core/domain/contracts/catalogs.repository.ts`
- Rename: `src/app/core/data/repositories/catalogs.repository.ts` → `http-catalogs.repository.ts` (+ spec)
- Rename: `src/app/core/data/catalog-labels.ts` → `src/app/core/domain/catalog-labels.ts` (+ spec)
- Modify: `src/app/core/data/dto/catalogs.dto.ts`, `src/app/core/data/mappers/dashboard.mapper.ts`, `src/app/core/data/repositories/http-dashboard.repository.ts` (+ spec), `src/app/core/data/repositories/users.repository.ts`, `src/app/app.config.ts`, `src/app/app.routes.spec.ts`, y por sed las features y specs que importan `catalogs.repository`, `catalogs.dto` o `catalog-labels`

**Interfaces:**
- Produces: `CatalogItem { id; name }` en `@domain/entities/catalog-item` · `abstract class CatalogsRepository` con `surfaceTypes() courtStatuses() planTypes() sessionTypes() paymentMethods() studentStatuses(): Promise<CatalogItem[]>` en `@domain/contracts/catalogs.repository` · `HttpCatalogsRepository` en `@data/repositories/http-catalogs.repository` · `catalogLabel(name)` en `@domain/catalog-labels`.

- [ ] **Step 1: Entidad y contrato en domain**

`src/app/core/domain/entities/catalog-item.ts`:

```ts
/** Un ítem de `/catalogs/*` y de `/roles`: el seed los serializa como { id, name }. */
export interface CatalogItem {
  readonly id: string;
  readonly name: string;
}
```

`src/app/core/domain/contracts/catalogs.repository.ts`:

```ts
import { CatalogItem } from '../entities/catalog-item';

/**
 * Los catálogos los siembra `prisma:seed` y no cambian en runtime. Clase abstracta a propósito:
 * hace de token DI sin arrastrar @angular/core al dominio. Cachear o no es decisión de la
 * implementación (HttpCatalogsRepository memoiza la promesa por sesión).
 */
export abstract class CatalogsRepository {
  abstract surfaceTypes(): Promise<CatalogItem[]>;
  abstract courtStatuses(): Promise<CatalogItem[]>;
  abstract planTypes(): Promise<CatalogItem[]>;
  abstract sessionTypes(): Promise<CatalogItem[]>;
  abstract paymentMethods(): Promise<CatalogItem[]>;
  /** 'active', 'pending_classification', 'inactive' (prisma/seed.ts:6). */
  abstract studentStatuses(): Promise<CatalogItem[]>;
}
```

- [ ] **Step 2: Mover `catalog-labels` a domain**

```bash
git mv src/app/core/data/catalog-labels.ts src/app/core/domain/catalog-labels.ts
git mv src/app/core/data/catalog-labels.spec.ts src/app/core/domain/catalog-labels.spec.ts
grep -rl "catalog-labels'" src --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/catalog-labels'#'@domain/catalog-labels'#" \
  -e "s#'\.\./catalog-labels'#'@domain/catalog-labels'#"
```

En el docstring de `catalog-labels.ts`, reemplazar el párrafo "Vive en `data`, junto a…" por:

```ts
 * Vive en `domain` porque es copy del producto sobre nombres del seed, TS puro sin imports, y
 * lo consumen tanto `data` (mapper del dashboard) como `features`: desde acá los dos llegan.
```

- [ ] **Step 3: El DTO deja de exportar el tipo `CatalogItem`**

En `src/app/core/data/dto/catalogs.dto.ts`, la última línea `export type CatalogItem = v.InferOutput<typeof CatalogItemDtoSchema>;` pasa a `export type CatalogItemDto = v.InferOutput<typeof CatalogItemDtoSchema>;` (los schemas `CatalogItemDtoSchema` y `CatalogListDtoSchema` no cambian). Actualizar los dos consumidores del tipo dentro de `data`:

- `users.repository.ts`: `import { CatalogItem } from '@domain/entities/catalog-item';` y `import { CatalogListDtoSchema } from '../dto/catalogs.dto';`.
- `dashboard.mapper.ts`: `import { CatalogItem } from '@domain/entities/catalog-item';` en lugar de `from '../dto/catalogs.dto'`.

- [ ] **Step 4: Renombrar el repositorio HTTP y hacerlo extender el contrato**

```bash
git mv src/app/core/data/repositories/catalogs.repository.ts src/app/core/data/repositories/http-catalogs.repository.ts
git mv src/app/core/data/repositories/catalogs.repository.spec.ts src/app/core/data/repositories/http-catalogs.repository.spec.ts
```

En `http-catalogs.repository.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { CatalogsRepository } from '@domain/contracts/catalogs.repository';
import { CatalogItem } from '@domain/entities/catalog-item';
import { ApiClient } from '../http/api-client';
import { toDomainError } from '../http/to-domain-error';
import { CatalogListDtoSchema } from '../dto/catalogs.dto';
```

y `export class HttpCatalogsRepository extends CatalogsRepository {` (el cuerpo no cambia; borrar del docstring el párrafo "Sin contrato abstracto en `domain`…"). En el spec: `import { HttpCatalogsRepository } from './http-catalogs.repository';`, `HttpCatalogsRepository,` en providers y `TestBed.inject(HttpCatalogsRepository)`.

En `http-dashboard.repository.ts` (y su spec): `import { CatalogsRepository } from '@domain/contracts/catalogs.repository';` en lugar de `'./catalogs.repository'`.

- [ ] **Step 5: Features, specs y root**

```bash
grep -rl "@data/repositories/catalogs.repository" src --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/repositories/catalogs.repository'#'@domain/contracts/catalogs.repository'#"
grep -rl "@data/dto/catalogs.dto" src/app/features --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/dto/catalogs.dto'#'@domain/entities/catalog-item'#"
grep -rn "catalogs.dto\|catalogs.repository'" src/app/features   # esperado: sólo el contrato de domain
```

`app.config.ts`: import `CatalogsRepository` desde `@domain/contracts/catalogs.repository`, import `HttpCatalogsRepository` desde `@data/repositories/http-catalogs.repository`, y la línea `CatalogsRepository,` pasa a `{ provide: CatalogsRepository, useClass: HttpCatalogsRepository },`.

`app.routes.spec.ts`: mismo cambio (import + `{ provide: CatalogsRepository, useClass: HttpCatalogsRepository },`).

- [ ] **Step 6: Lint, tests, commit**

```bash
npm run lint && npm test
git add -A src/app
git commit -m "refactor(catalogs): contrato CatalogsRepository y entidad CatalogItem en domain; catalog-labels a domain"
```

---

### Task 5: `CurrentUser` + `UsersRepository` abstracto

**Files:**
- Create: `src/app/core/domain/entities/current-user.ts`
- Create: `src/app/core/domain/contracts/users.repository.ts`
- Rename: `src/app/core/data/repositories/users.repository.ts` → `http-users.repository.ts` (+ spec)
- Modify: `src/app/core/data/dto/users.dto.ts`, `src/app/core/data/mappers/user.mapper.ts`, `src/app/layout/shell.component.ts` (+ spec), `src/app/features/configuracion/profesores/profesores.facade.ts` (+ 2 specs), `src/app/app.config.ts`, `src/app/app.routes.spec.ts`
- Create: `src/app/core/data/mappers/user.mapper.spec.ts` (si no existe; si existe, agregar el describe)

**Interfaces:**
- Produces: `CurrentUser { id; email: string | null; displayName }` · `abstract class UsersRepository { me(): Promise<CurrentUser>; roles(): Promise<CatalogItem[]>; create(draft: NewUser): Promise<void> }` · `toCurrentUser(dto: CurrentUserDto): CurrentUser`.

- [ ] **Step 1: Test del mapper que falla**

En `src/app/core/data/mappers/user.mapper.spec.ts` (crear o ampliar):

```ts
import { describe, it, expect } from 'vitest';
import { toCurrentUser } from './user.mapper';

const dto = { id: '9', clubId: '42', email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roles: ['admin'] };

describe('toCurrentUser', () => {
  it('displayName es "Nombre Apellido"', () => {
    expect(toCurrentUser(dto)).toEqual({ id: '9', email: 'ana@club.com', displayName: 'Ana Pérez' });
  });

  it('sin nombre cae al email', () => {
    expect(toCurrentUser({ ...dto, nombre: null, apellido: ' ' }).displayName).toBe('ana@club.com');
  });

  it('sin nombre ni email queda vacío: el shell no dibuja el renglón', () => {
    expect(toCurrentUser({ ...dto, nombre: null, apellido: null, email: null }).displayName).toBe('');
  });
});
```

```bash
npx ng test --include src/app/core/data/mappers/user.mapper.spec.ts   # esperado: FAIL
```

- [ ] **Step 2: Entidad, contrato y mapper**

`src/app/core/domain/entities/current-user.ts`:

```ts
/** El usuario logueado. Sólo lo que la UI muestra: rol y club salen del JWT (SessionStore). */
export interface CurrentUser {
  readonly id: string;
  readonly email: string | null;
  /** "Ana Pérez", o el email si no hay nombre, o '' si no hay ninguno. */
  readonly displayName: string;
}
```

`src/app/core/domain/contracts/users.repository.ts`:

```ts
import { CatalogItem } from '../entities/catalog-item';
import { CurrentUser } from '../entities/current-user';
import { NewUser } from '../entities/new-user';

/**
 * El usuario logueado, los roles del club y el alta de usuarios. `create` devuelve void y el
 * llamador relee. OJO (§3.2 de alta-de-profesor): el backend NO es atómico; un 500 puede dejar
 * el usuario creado. No asumir que un rechazo significa que no se creó nada.
 */
export abstract class UsersRepository {
  abstract me(): Promise<CurrentUser>;
  abstract roles(): Promise<CatalogItem[]>;
  abstract create(draft: NewUser): Promise<void>;
}
```

En `user.mapper.ts` agregar (y mover acá el texto del docstring de `currentUserName`):

```ts
import { CurrentUser } from '@domain/entities/current-user';
import { CurrentUserDto } from '../dto/users.dto';

/**
 * Nombre y apellido en ese orden (no "Pérez, Ana" como studentDisplayName): es un saludo al
 * usuario logueado, no una fila que se ordena por apellido. '' cuando no hay nada: mostrar un
 * renglón vacío es peor que no mostrarlo.
 */
export function toCurrentUser(dto: CurrentUserDto): CurrentUser {
  const parts = [dto.nombre, dto.apellido].filter((p): p is string => !!p && p.trim() !== '');
  const displayName = parts.length > 0 ? parts.join(' ') : (dto.email?.trim() ?? '');
  return { id: dto.id, email: dto.email, displayName };
}
```

Borrar `currentUserName` de `users.dto.ts`. Correr el spec del mapper: PASS.

- [ ] **Step 3: Renombrar el repositorio y extender el contrato**

```bash
git mv src/app/core/data/repositories/users.repository.ts src/app/core/data/repositories/http-users.repository.ts
git mv src/app/core/data/repositories/users.repository.spec.ts src/app/core/data/repositories/http-users.repository.spec.ts
```

En `http-users.repository.ts`: `export class HttpUsersRepository extends UsersRepository`, con imports `UsersRepository` (`@domain/contracts/users.repository`), `CurrentUser` (`@domain/entities/current-user`), `CatalogItem` (`@domain/entities/catalog-item`), `toCurrentUser` (`../mappers/user.mapper`); `me()` devuelve `toCurrentUser(v.parse(CurrentUserDtoSchema, raw))` y su firma pasa a `Promise<CurrentUser>`. Borrar del docstring "Sin contrato abstracto en `domain`…".

En el spec renombrado: imports a `HttpUsersRepository`; la expectativa de `me()` pasa a `toEqual({ id: '9', email: 'ana@club.com', displayName: 'Ana Pérez' })`; borrar el import de `currentUserName` y cualquier `describe`/`it` que lo use (sus casos ya viven en `user.mapper.spec.ts`).

- [ ] **Step 4: Consumidores**

```bash
grep -rl "@data/repositories/users.repository" src --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/repositories/users.repository'#'@domain/contracts/users.repository'#"
```

`shell.component.ts`: borrar `import { currentUserName } from '@data/dto/users.dto';` y en `loadUser()`:

```ts
      this.userName.set((await this.usersRepo.me()).displayName);
```

`shell.component.spec.ts`: borrar el import de `CurrentUserDto`, importar `CurrentUser` desde `@domain/entities/current-user`, y reemplazar el helper:

```ts
function usersRepo(user: Partial<CurrentUser> | null = { displayName: 'Ana Pérez' }) {
  return {
    me: async () => {
      if (user === null) throw { kind: 'network' };
      return { id: '9', email: null, displayName: '', ...user };
    },
  } as UsersRepository;
}
```

y en el test "un usuario sin nombre cargado muestra su email": `usersRepo({ displayName: 'ana@club.com' })` (el fallback real lo cubre `user.mapper.spec.ts`).

`app.config.ts` y `app.routes.spec.ts`: `UsersRepository` desde `@domain/contracts/users.repository`, `HttpUsersRepository` desde `@data/repositories/http-users.repository`, y `UsersRepository,` → `{ provide: UsersRepository, useClass: HttpUsersRepository },`.

- [ ] **Step 5: Lint, tests, commit**

```bash
grep -rn "@data/dto/users.dto\|@data/repositories/users" src/app/features src/app/layout   # vacío
npm run lint && npm test
git add -A src/app
git commit -m "refactor(users): contrato UsersRepository y entidad CurrentUser en domain"
```

---

### Task 6: `SessionStore` abstracto en domain + prefijo de storage desde `APP_CONFIG`

**Files:**
- Create: `src/app/core/domain/contracts/session-store.ts`
- Rename: `src/app/core/data/auth/session-store.ts` → `local-storage-session-store.ts` (+ spec)
- Modify: `src/app/core/data/http/token-refresher.ts`, `src/app/core/data/http/auth.interceptor.ts`, `src/app/app.config.ts`, y por sed todos los archivos que importan `@data/auth/session-store`
- Modify (providers de clase → `useClass`): `app.routes.spec.ts:34`, `core/data/http/auth.interceptor.spec.ts:29`, `features/auth/auth.guard.spec.ts:24` y su segundo TestBed inline, `features/auth/password.facade.spec.ts:14`, `features/auth/pages/change-password-page.component.spec.ts:23`, `features/auth/pages/login-page.component.spec.ts:28`, `features/auth/pages/reset-password-page.component.spec.ts:20`, `features/auth/session.facade.spec.ts:20`
- Modify: `features/configuracion/grupos-categoria/grupo-items-store.ts` (+ spec), `features/configuracion/planes/plan-categorias-store.ts`, `features/onboarding/onboarding-persistence.service.ts` (+ spec), `features/onboarding/pages/onboarding-wizard.component.spec.ts:168`

**Interfaces:**
- Produces: `abstract class SessionStore` en `@domain/contracts/session-store` (lectores como propiedades `() => T`, escritores como métodos) · `LocalStorageSessionStore` en `@data/auth/local-storage-session-store`.

- [ ] **Step 1: Contrato en domain**

`src/app/core/domain/contracts/session-store.ts`:

```ts
import { Session } from '../entities/session';

/**
 * Dueño único de la sesión. Clase abstracta a propósito (token DI sin @angular/core).
 *
 * Los lectores se declaran como PROPIEDADES de tipo función y no como métodos: así la
 * implementación los satisface con `signal.asReadonly()` / `computed()`, y leerlos dentro de
 * otro `computed` sigue siendo reactivo. Un método abstracto no admitiría esa implementación.
 */
export abstract class SessionStore {
  abstract readonly accessToken: () => string | null;
  abstract readonly refreshToken: () => string | null;
  abstract readonly mustChangePassword: () => boolean;
  abstract readonly isAuthenticated: () => boolean;
  /** Del JWT, no del login: sobrevive un F5. */
  abstract readonly clubId: () => string | null;
  abstract readonly roles: () => readonly string[];

  /** Login: la respuesta trae mustChangePassword. */
  abstract set(session: Session): void;
  /** Refresh: sólo el par de tokens; NO pisa mustChangePassword. */
  abstract setTokens(accessToken: string, refreshToken: string): void;
  /** POST /auth/change-password no devuelve tokens: hay que bajar la bandera a mano. */
  abstract passwordChanged(): void;
  abstract clear(): void;
}
```

- [ ] **Step 2: Implementación en data con la clave desde `APP_CONFIG`**

```bash
git mv src/app/core/data/auth/session-store.ts src/app/core/data/auth/local-storage-session-store.ts
git mv src/app/core/data/auth/session-store.spec.ts src/app/core/data/auth/local-storage-session-store.spec.ts
```

En `local-storage-session-store.ts`:

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG, storageKey } from '@config/app-config';
import { SessionStore } from '@domain/contracts/session-store';
import { Session } from '@domain/entities/session';
import { readClubId, readRoles } from './jwt-claims';
```

borrar `const LS_KEY = …`, y en la clase:

```ts
@Injectable()
export class LocalStorageSessionStore extends SessionStore {
  /** `${prefix}:session:v1`. Con el prefijo de Pipofy da la clave de siempre. */
  private readonly key = storageKey(inject(APP_CONFIG), 'session', 1);
  // …los signals quedan igual…
  override readonly accessToken = this._accessToken.asReadonly();
  override readonly refreshToken = this._refreshToken.asReadonly();
  override readonly mustChangePassword = this._mustChangePassword.asReadonly();
  override readonly isAuthenticated = computed(() => this._accessToken() !== null);
  override readonly clubId = computed(() => {
    const token = this._accessToken();
    return token === null ? null : readClubId(token);
  });
  override readonly roles = computed(() => {
    const token = this._accessToken();
    return token === null ? [] : readRoles(token);
  });

  constructor() {
    super();
    this.hydrate();
  }
```

Los cuatro métodos de escritura llevan `override`. Reemplazar `LS_KEY` por `this.key` en `clear()`, `hydrate()` y `persist()`. `noImplicitOverride` está activo: sin `override` no compila.

En el spec renombrado: import `LocalStorageSessionStore` desde `./local-storage-session-store`, `store()` devuelve `LocalStorageSessionStore` y lo provee/inyecta; la literal `'PipoFy:session:v1'` pasa a `'app:session:v1'` (default del kernel en tests). Agregar además, dentro de `describe('SessionStore')`, el test del seam:

```ts
  it('persiste bajo el prefijo de APP_CONFIG', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        LocalStorageSessionStore,
        { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, storagePrefix: 'Otro' } },
      ],
    });
    TestBed.inject(LocalStorageSessionStore).set({ accessToken: 'a', refreshToken: 'r', mustChangePassword: false });
    expect(localStorage.getItem('Otro:session:v1')).not.toBeNull();
    expect(localStorage.getItem('app:session:v1')).toBeNull();
  });
```

con `import { APP_CONFIG, DEFAULT_APP_CONFIG } from '@config/app-config';`.

- [ ] **Step 3: Consumidores de fuente**

```bash
grep -rl "auth/session-store'" src --include='*.ts' | xargs sed -i '' \
  -e "s#'@data/auth/session-store'#'@domain/contracts/session-store'#" \
  -e "s#'\.\./auth/session-store'#'@domain/contracts/session-store'#"
```

`app.config.ts`: `import { SessionStore } from '@domain/contracts/session-store';`, `import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';` y `SessionStore,` → `{ provide: SessionStore, useClass: LocalStorageSessionStore },`.

- [ ] **Step 4: Specs que proveían la clase concreta**

```bash
for f in src/app/app.routes.spec.ts src/app/core/data/http/auth.interceptor.spec.ts \
  src/app/features/auth/auth.guard.spec.ts src/app/features/auth/password.facade.spec.ts \
  src/app/features/auth/pages/change-password-page.component.spec.ts \
  src/app/features/auth/pages/login-page.component.spec.ts \
  src/app/features/auth/pages/reset-password-page.component.spec.ts \
  src/app/features/auth/session.facade.spec.ts; do
  sed -i '' -e 's/^\( *\)SessionStore,$/\1{ provide: SessionStore, useClass: LocalStorageSessionStore },/' "$f"
done
```

En cada uno de esos 8 archivos, agregar debajo del import de `SessionStore`:

```ts
import { LocalStorageSessionStore } from '@data/auth/local-storage-session-store';
```

`auth.guard.spec.ts` tiene además un TestBed inline en el último test: `providers: [provideZonelessChangeDetection(), SessionStore, provideRouter([])]` → `providers: [provideZonelessChangeDetection(), { provide: SessionStore, useClass: LocalStorageSessionStore }, provideRouter([])]`.

`session.facade.spec.ts:103`: `'PipoFy:session:v1'` → `'app:session:v1'`.

- [ ] **Step 5: Pistas y onboarding con prefijo**

`grupo-items-store.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG, storageKey } from '@config/app-config';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';

@Injectable()
export class GrupoItemsStore extends IdSetHintStore {
  /** `${prefix}:grupo-items:v1`. Con el prefijo de Pipofy es la clave de siempre. */
  protected readonly key = storageKey(inject(APP_CONFIG), 'grupo-items', 1);
}
```

`plan-categorias-store.ts`: igual con `'plan-categorias'`.

`onboarding-persistence.service.ts`: borrar `const SS_KEY`, agregar los imports de `inject` y `APP_CONFIG, storageKey`, y en la clase `private readonly key = storageKey(inject(APP_CONFIG), 'onboarding', 2);` reemplazando cada `SS_KEY` por `this.key`. Conservar el comentario "v2: el wizard perdió los pasos…" junto al campo.

`grupo-items-store.spec.ts`: `inject()` exige contexto de inyección, así que `new GrupoItemsStore()` deja de servir. Agregar arriba:

```ts
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

function store(): GrupoItemsStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), GrupoItemsStore] });
  return TestBed.inject(GrupoItemsStore);
}
```

y reemplazar cada `new GrupoItemsStore()` por `store()`; la literal `'PipoFy:grupo-items:v1'` → `'app:grupo-items:v1'`.

`onboarding-persistence.service.spec.ts`: mismo helper `svc()` con `OnboardingPersistenceService`, reemplazar los tres `new OnboardingPersistenceService()`, literal → `'app:onboarding:v2'`.

`onboarding-wizard.component.spec.ts:168`: `'PipoFy:onboarding:v2'` → `'app:onboarding:v2'`.

- [ ] **Step 6: Lint, tests, commit**

```bash
grep -rn "@data/auth" src/app/features src/app/layout   # esperado: vacío
grep -rn "PipoFy" src --include='*.ts' | grep -v product/   # esperado: sólo copy de UI (se va en Task 8)
npm run lint && npm test
git add -A src/app
git commit -m "refactor(session): contrato SessionStore en domain; claves de storage desde APP_CONFIG"
```

---

### Task 7: `IconComponent`, nav por `NAV_CONFIG`, ilustraciones por registro

**Files:**
- Create: `src/app/shared/ui/icon.component.ts` (+ spec)
- Create: `src/app/product/icons.ts`, `src/app/product/nav.ts`
- Modify: `src/app/product/index.ts`, `styles/components.css`
- Delete: `src/app/layout/nav.model.ts`
- Modify: `src/app/layout/nav-badges.service.ts`, `src/app/layout/shell.component.ts`, `shell.component.html`, `shell.component.css`, `shell.component.spec.ts`
- Modify: `src/app/shared/ui/placeholder.component.ts`

**Interfaces:**
- Consumes: `ICONS`, `NAV_CONFIG` (Task 1).
- Produces: `IconComponent` (`<app-icon name="…" />`, host con clase `icon` y `aria-hidden="true"`) · `PIPOFY_ICONS`, `PIPOFY_NAV`.

- [ ] **Step 1: Spec de `IconComponent` que falla**

`src/app/shared/ui/icon.component.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ICONS } from '@config/icons';
import { IconComponent } from './icon.component';

function mount(name: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ICONS, useValue: { pelota: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>' } },
    ],
  });
  const fixture = TestBed.createComponent(IconComponent);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('IconComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renderiza el markup del registro y queda oculto a lectores de pantalla', () => {
    const el = mount('pelota');
    expect(el.querySelector('svg circle')).toBeTruthy();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains('icon')).toBe(true);
  });

  it('un nombre desconocido renderiza vacío y avisa por consola', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = mount('inexistente');
    expect(el.querySelector('svg')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('inexistente'));
  });
});
```

```bash
npx ng test --include src/app/shared/ui/icon.component.spec.ts   # esperado: FAIL
```

- [ ] **Step 2: Implementar `IconComponent`**

`src/app/shared/ui/icon.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from '@config/icons';

/** Un aviso por nombre y por carga de página, no uno por render. */
const warned = new Set<string>();

/**
 * Icono del registro del producto (ICONS). La caja (width/height/color) la pone el consumidor
 * sobre `app-icon`; el `.icon svg` global de components.css la llena.
 *
 * `bypassSecurityTrustHtml` es seguro acá y sólo acá: el registro es una constante del repo
 * (product/icons.ts) y nunca contiene entrada de usuario. No copiar este patrón para HTML que
 * venga de la API.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'icon', 'aria-hidden': 'true', '[innerHTML]': 'markup()' },
  template: '',
})
export class IconComponent {
  readonly name = input.required<string>();
  private readonly icons = inject(ICONS);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly markup = computed(() => {
    const svg = this.icons[this.name()];
    if (svg === undefined) {
      if (!warned.has(this.name())) {
        warned.add(this.name());
        console.warn(`[app-icon] no hay icono "${this.name()}" en el registro ICONS`);
      }
      return '';
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}
```

En `styles/components.css`, agregar al final de la sección de primitivos (antes de `.toast`):

```css
/* ── Icono del registro del producto (shared/ui/icon.component.ts) ──
   El consumidor fija width/height/color sobre app-icon; el svg llena la caja. */
.icon{display:inline-flex;flex:0 0 auto;line-height:0}
.icon svg{width:100%;height:100%;display:block}
```

Correr el spec: PASS.

- [ ] **Step 3: Registro de iconos de Pipofy**

`src/app/product/icons.ts` (el markup es el que hoy vive inline en `shell.component.html` y `placeholder.component.ts`, sin `width`/`height` fijos):

```ts
import { IconRegistry } from '@config/icons';

/**
 * Iconos de navegación (`nav.ts`) e ilustraciones de estado (`state-*`, las usa
 * PlaceholderComponent). Markup SVG completo con `viewBox`; el tamaño lo pone el CSS del
 * consumidor. `var(--…)` resuelve contra los tokens de brand.css/tokens.css.
 */
export const PIPOFY_ICONS = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.7"/></svg>',
  grupos:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="9" r="2.4" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="9" r="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 18c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6M12.5 18c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  reservas:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  alumnos:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M4 19c0-3 2.2-5 5-5s5 2 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16 8.5a3 3 0 010 5M18 19c0-2-1-3.5-2.5-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  comercial:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke="currentColor" stroke-width="1.7"/><path d="M8 8V6a4 4 0 018 0v2M4 12h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plantillas:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9h17M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16.5" cy="15" r="3" fill="var(--wa)" stroke="none"/></svg>',
  config:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4M17.9 17.9l-1.4-1.4M7.5 7.5L6.1 6.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',

  // Estados de PlaceholderComponent: pelota y paleta de pádel.
  'state-empty':
    '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><circle cx="9.6" cy="7.4" r="1" fill="currentColor" opacity=".45"/><circle cx="12" cy="10.2" r="1" fill="currentColor" opacity=".45"/><circle cx="14.4" cy="7.4" r="1" fill="currentColor" opacity=".45"/><path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  'state-error':
    '<svg viewBox="0 0 24 24" fill="none"><path d="M2 17h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><circle cx="17" cy="9" r="4.6" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M13.4 6.2c1.6 1.6 1.6 4 0 5.6M20.6 6.2c-1.6 1.6-1.6 4 0 5.6" stroke="currentColor" stroke-width="1.1" opacity=".55"/><path d="M4 20.5c1.6-3 3.6-5.2 6.2-6.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 2.6" opacity=".55"/></svg>',
  // La animación va inline: el markup entra por innerHTML y no recibe el scope de estilos
  // del componente. `spin` es el @keyframes global de components.css.
  'state-loading':
    '<svg viewBox="0 0 24 24" fill="none"><g style="transform-origin:12px 11px;animation:spin 900ms linear infinite"><circle cx="12" cy="11" r="5.4" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M7.7 7.7c1.9 1.9 1.9 4.7 0 6.6M16.3 7.7c-1.9 1.9-1.9 4.7 0 6.6" stroke="currentColor" stroke-width="1.1" opacity=".55"/></g><path d="M4 19.5h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35"/></svg>',
  'state-wip':
    '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.5 11.5h17" stroke="var(--color-warning-mark)" stroke-width="3" stroke-linecap="round"/><path d="M5 11.5h1.6M9 11.5h1.6M13 11.5h1.6M17 11.5h1.6" stroke="var(--color-surface)" stroke-width="3"/></svg>',
} satisfies IconRegistry;
```

- [ ] **Step 4: Nav de Pipofy**

`src/app/product/nav.ts`:

```ts
import { NavConfig } from '@config/nav';
import { PIPOFY_ICONS } from './icons';

/** `icon` tipado contra el registro: un nombre que no existe no compila. */
type Icon = keyof typeof PIPOFY_ICONS;

interface Item extends Omit<NavConfig['items'][number], 'icon'> {
  readonly icon: Icon;
}

const ITEMS: readonly Item[] = [
  { label: 'Dashboard',             short: 'Panel',      path: '/dashboard',  group: 'Operación', icon: 'dashboard',  badge: 'alerts' },
  { label: 'Grupos y Clases',       short: 'Grupos',     path: '/grupos',     group: 'Operación', icon: 'grupos' },
  { label: 'Reservas',              short: 'Reservas',   path: '/reservas',   group: 'Operación', icon: 'reservas' },
  { label: 'Alumnos y Créditos',    short: 'Alumnos',    path: '/alumnos',    group: 'Operación', icon: 'alumnos' },
  { label: 'Comercial y Pagos',     short: 'Pagos',      path: '/comercial',  group: 'Gestión',   icon: 'comercial',  badge: 'payments' },
  { label: 'Plantillas y WhatsApp', short: 'Plantillas', path: '/plantillas', group: 'Gestión',   icon: 'plantillas' },
  {
    label: 'Configuración', short: 'Config', path: '/configuracion', group: 'Gestión', icon: 'config',
    // PARA AGREGAR UNA ENTIDAD DE CONFIGURACIÓN: sumar su entrada acá Y su child route en
    // features/configuracion/configuracion.routes.ts.
    children: [
      { label: 'Club',                path: '/configuracion/club' },
      { label: 'Canchas',             path: '/configuracion/canchas' },
      { label: 'Categorías',          path: '/configuracion/categorias' },
      { label: 'Grupos de categoría', path: '/configuracion/grupos-categoria' },
      { label: 'Planes',              path: '/configuracion/planes' },
      { label: 'Profesores',          path: '/configuracion/profesores' },
      { label: 'Horarios',            path: '/configuracion/horarios' },
    ],
  },
];

export const PIPOFY_NAV: NavConfig = { groups: ['Operación', 'Gestión'], items: ITEMS };
```

`src/app/product/index.ts`: agregar los imports y dos providers:

```ts
import { ICONS } from '@config/icons';
import { NAV_CONFIG } from '@config/nav';
import { PIPOFY_ICONS } from './icons';
import { PIPOFY_NAV } from './nav';
// …
  { provide: NAV_CONFIG, useValue: PIPOFY_NAV },
  { provide: ICONS, useValue: PIPOFY_ICONS },
```

- [ ] **Step 5: El shell consume el token**

```bash
git rm src/app/layout/nav.model.ts
```

`nav-badges.service.ts`: `import type { BadgeKey } from '@config/nav';`.

`shell.component.ts`:
- Borrar los imports de `NgTemplateOutlet` y de `./nav.model`; agregar `import { NAV_CONFIG, type NavItem } from '@config/nav';` y `import { IconComponent } from '@shared/ui/icon.component';`.
- En `imports:` reemplazar `NgTemplateOutlet` por `IconComponent`.
- Reemplazar `protected readonly groups = NAV_GROUPS; protected readonly items = NAV_ITEMS;` por:

```ts
  private readonly nav = inject(NAV_CONFIG);
  protected readonly groups = this.nav.groups;
  protected readonly items = this.nav.items;
```

- `itemsIn(group: string)` en lugar de `NavGroup`.

`shell.component.html`:
- Las tres apariciones de `<ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />` pasan a `<app-icon [name]="item.icon" />`.
- Borrar entero el bloque `<ng-template #icon let-name>…</ng-template>` del final.

`shell.component.css` (el svg inyectado no recibe el atributo de encapsulación, así que el selector apunta al host `app-icon`):
- línea 28: `.nav a svg,.nav summary svg{…}` → `.nav a app-icon,.nav summary app-icon{width:18px;height:18px;opacity:.85}`
- línea 32: `.nav a.on svg{…}` → `.nav a.on app-icon{opacity:1;color:var(--color-primary)}`
- línea 78: `.mobile-tab a svg{…}` → `.mobile-tab a app-icon{width:20px;height:20px}`
- `.side-foot .logout svg` y `.chev` no cambian: siguen inline.

- [ ] **Step 6: `PlaceholderComponent` toma su arte del registro**

En `placeholder.component.ts`:
- `imports: [IconComponent]` y `import { IconComponent } from '@shared/ui/icon.component';`.
- Reemplazar el `<span class="ph-art" aria-hidden="true">…@switch…</span>` completo por:

```html
      <app-icon class="ph-art" [name]="'state-' + tone()" />
```

- En `styles`, reemplazar `.ph-art svg{…}` por:

```css
      .ph-art {
        display: flex;
        width: 26px;
        height: 26px;
        margin: 0 auto var(--space-sm);
        color: var(--color-primary);
        opacity: 0.75;
      }
```

`.ph-page .ph-art svg{…}` por `.ph-page .ph-art { width: 72px; height: 72px; margin-bottom: var(--space-md); }`, y borrar la regla `.ph-roll` con su comentario. En el docstring, agregar: "El arte sale del registro ICONS con los nombres `state-empty|error|loading|wip`".

- [ ] **Step 7: Spec del shell con un nav de prueba**

En `shell.component.spec.ts`, borrar `import { NAV_ITEMS } from './nav.model';`, agregar `import { NAV_CONFIG, type NavConfig } from '@config/nav';` y este fixture arriba de `routes`:

```ts
/** Nav de prueba: el shell se testea contra un token, no contra product/nav.ts. */
const NAV: NavConfig = {
  groups: ['Operación', 'Gestión'],
  items: [
    { label: 'Dashboard', short: 'Panel', path: '/dashboard', group: 'Operación', icon: 'dashboard', badge: 'alerts' },
    { label: 'Grupos y Clases', short: 'Grupos', path: '/grupos', group: 'Operación', icon: 'grupos' },
    { label: 'Reservas', short: 'Reservas', path: '/reservas', group: 'Operación', icon: 'reservas' },
    { label: 'Alumnos y Créditos', short: 'Alumnos', path: '/alumnos', group: 'Operación', icon: 'alumnos' },
    { label: 'Comercial y Pagos', short: 'Pagos', path: '/comercial', group: 'Gestión', icon: 'comercial', badge: 'payments' },
    { label: 'Plantillas y WhatsApp', short: 'Plantillas', path: '/plantillas', group: 'Gestión', icon: 'plantillas' },
    {
      label: 'Configuración', short: 'Config', path: '/configuracion', group: 'Gestión', icon: 'config',
      children: [
        { label: 'Club', path: '/configuracion/club' },
        { label: 'Canchas', path: '/configuracion/canchas' },
        { label: 'Categorías', path: '/configuracion/categorias' },
        { label: 'Grupos de categoría', path: '/configuracion/grupos-categoria' },
        { label: 'Planes', path: '/configuracion/planes' },
        { label: 'Profesores', path: '/configuracion/profesores' },
        { label: 'Horarios', path: '/configuracion/horarios' },
      ],
    },
  ],
};
```

Agregar `{ provide: NAV_CONFIG, useValue: NAV },` a los TRES `providers` del spec (el de `setup` y los dos inline de logout), y en el primer test iterar `NAV.items` en vez de `NAV_ITEMS`.

- [ ] **Step 8: Lint, tests, commit**

```bash
npm run lint && npm test
git add -A src/app styles/components.css
git commit -m "feat(layout): nav e iconos por token; IconComponent y arte de placeholders desde el registro del producto"
```

---

### Task 8: Copy de marca, etiquetas de rol y locale desde `APP_CONFIG`

**Files:**
- Modify: `src/app/shared/ui/brandmark.component.ts`, `src/app/shared/ui/site-footer.component.ts`
- Modify: `src/app/layout/shell.component.ts` (+ spec)
- Modify: `src/app/features/onboarding/components/role-step.component.ts`, `account-step.component.ts`, `confirm-step.component.ts`
- Modify: `src/app/features/auth/pages/verify-email-page.component.ts`
- Modify: `src/app/features/configuracion/planes/plan-price.ts` (+ spec), `planes-page.component.ts`
- Modify: `src/index.html` (`lang`)

- [ ] **Step 1: Brandmark y footer**

`brandmark.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@config/app-config';

/**
 * El lockup de marca. El texto ya está convertido a trazados dentro del SVG, así que no se
 * duplica en HTML. El alt mantiene el nombre accesible y el aria-label del enlace el destino.
 *
 * ponytail: un <img> no hereda currentColor, así que sobre una superficie oscura el logo
 * desaparece. Hoy no hay ninguna. Salida: un segundo campo `logoOnDark` en AppBrand.
 */
@Component({
  selector: 'app-brandmark',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brandmark" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <img class="bm-img" [src]="brand.logoHorizontal" [alt]="brand.name" />
    </a>
  `,
})
export class BrandmarkComponent {
  protected readonly brand = inject(APP_CONFIG).brand;
  readonly link = input<string>('/');
  readonly ariaLabel = input<string>(`${this.brand.name} · ir al panel`);
}
```

`site-footer.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@config/app-config';
import { BrandmarkComponent } from './brandmark.component';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [BrandmarkComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer">
      <div class="sf-inner">
        <div class="sf-top">
          <div>
            <app-brandmark />
            @if (brand.tagline) { <p class="sf-blurb">{{ brand.tagline }}</p> }
          </div>
          <div class="sf-ctas"><ng-content /></div>
        </div>
        <div class="sf-legal">
          <!-- ponytail: sin nombre de club. El token trae clubId, no el nombre, y no vale la pena
               un GET /clubs/me acá solo para el pie. Salida: ya lo consume Configuración › Club. -->
          <span>© {{ year }} {{ brand.name }}</span>
          @if (brand.footerLinks.length) {
            <nav aria-label="Enlaces del pie">
              @for (link of brand.footerLinks; track link.label) {
                @if (link.href; as href) {
                  <a [routerLink]="href">{{ link.label }}</a>
                } @else {
                  <!-- href null = la página no existe todavía (ver AppBrand.footerLinks). -->
                  <a href="#" (click)="$event.preventDefault()">{{ link.label }}</a>
                }
              }
            </nav>
          }
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected readonly brand = inject(APP_CONFIG).brand;
  protected readonly year = new Date().getFullYear();
}
```

- [ ] **Step 2: Shell: título, roles y reloj**

`shell.component.ts`:
- Borrar `const ROLE_LABELS = …` con su docstring.
- Imports: `import { LOCALE_ID, … } from '@angular/core';` y `import { APP_CONFIG } from '@config/app-config';`.
- Campos:

```ts
  private readonly config = inject(APP_CONFIG);
  private readonly locale = inject(LOCALE_ID);
  protected readonly title = signal(this.config.brand.name);
```

- `syncRouteMeta`: `?? this.config.brand.name`.
- `rol`: `roles.map((r) => this.config.roleLabels[r] ?? r).join(' · ')` — con `noPropertyAccessFromIndexSignature` el acceso es `this.config.roleLabels[r]`, está bien porque es index signature con corchetes.
- `formatClock`: los dos `'es-AR'` → `this.locale`.

`shell.component.spec.ts`: agregar `import { APP_CONFIG, DEFAULT_APP_CONFIG } from '@config/app-config';` y a los tres `providers`:

```ts
      { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, roleLabels: { admin: 'Administrador' } } },
```

El test "un rol fuera de ROLE_LABELS se muestra crudo" no cambia: `coordinador` no está en el mapa.

- [ ] **Step 3: Onboarding y verify-email**

En `role-step.component.ts`, `account-step.component.ts`, `confirm-step.component.ts` y `verify-email-page.component.ts`: agregar `inject` al import de `@angular/core` si falta, `import { APP_CONFIG } from '@config/app-config';`, el campo `protected readonly brand = inject(APP_CONFIG).brand;`, y en el template:

- role-step: `<h2>¿Cómo vas a usar {{ brand.name }}?</h2>`
- account-step: `<p>Con estos datos vas a ingresar a {{ brand.name }}.</p>`
- confirm-step: `… de {{ brand.name }}.</span>`
- verify-email: `<p>Ya podés entrar a {{ brand.name }}.</p>`

- [ ] **Step 4: Precio con locale inyectado**

`plan-price.ts`:

```ts
export function formatPlanPrice(price: string | null, locale: string): string {
  if (price === null) return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return '$' + Math.round(n).toLocaleString(locale);
}
```

`plan-price.spec.ts`: cada llamada pasa `'es-AR'` como segundo argumento. `planes-page.component.ts`: `private readonly locale = inject(LOCALE_ID);` (import desde `@angular/core`) y `formatPlanPrice(raw, this.locale)`.

`src/index.html`: `<html lang="es">`.

- [ ] **Step 5: Lint, tests, commit**

```bash
grep -rn "PipoFy\|Pipofy\|'es-AR'" src/app --include='*.ts' --include='*.html' | grep -v "src/app/product/\|\.spec\.ts"
# esperado: sólo DEFAULT_APP_CONFIG (core/config/app-config.ts) y comentarios; ningún template ni literal de runtime
npm run lint && npm test
git add -A src
git commit -m "refactor(marca): nombre, tagline, links, roles y locale desde APP_CONFIG"
```

---

### Task 9: `styles/brand.css` separado de `tokens.css`; cero hex sueltos

**Files:**
- Create: `styles/brand.css`
- Modify: `styles/tokens.css`, `styles/components.css:344`, `angular.json`, `src/app/layout/shell.component.css`, `src/app/features/grupos/pages/grupo-detail-page.component.css:10`

- [ ] **Step 1: Crear `styles/brand.css`**

Mover a este archivo, con sus comentarios de contraste, las variables de marca que hoy están en el `:root` de `tokens.css` y en el `:host` del shell:

```css
/* ═══════════════════════════════════════════════════════════════════
   BRAND · lo que cambia por producto. Se carga ANTES de tokens.css.
   Todo lo que NO es marca (espaciado, radios, tipos, semánticos de
   error/aviso, reset) vive en tokens.css y no se toca por producto.

   Cada color trae su contraste sobre blanco/fondo: quien cambie la
   paleta hereda la obligación de verificar AA (≥4.5:1 texto, ≥3:1 UI).
   Paleta actual: brandboard Pipofy (docs/brandboard/LEEME.md).
   ═══════════════════════════════════════════════════════════════════ */
:root{
  /* ── Paleta base ── */
  --color-primary:#2267AC; --color-on-primary:#FFFFFF; --color-secondary:#2E78C0;
  --color-accent:#2E78C0; --color-background:#F7F9FC; --color-foreground:#082658;
  --color-muted:#EEF3F9; --color-border:#DDE5EE; --color-ring:#2267AC;
  /* Neutral del brandboard. 2.10:1 sobre blanco: bordes, nunca texto. */
  --color-border-strong:#ABB4BD;

  /* ── Derivados de marca ── */
  --color-fg-muted:#4A5B73;             /*  6.92:1 sobre blanco, 6.20:1 sobre muted */
  --color-fg-subtle:#5A6B82;            /*  5.44:1 sobre blanco, 4.88:1 sobre muted */
  --color-primary-hover:#1B5595;        /* blanco: 7.55:1 */
  --color-primary-strong:#082658;       /* blanco: 14.70:1 — superficies oscuras */
  --color-primary-soft:#EAF2FA; --color-on-primary-soft:#1B5595;   /* 6.68:1 sobre soft */
  /* Texto secundario SOBRE primary-strong (hero de grupo). 5.28:1 */
  --color-on-primary-strong-muted:#DBE5F5;

  /* ponytail: "ok" y primario son el mismo azul. Si hace falta distinguirlos, entra una
     familia --color-success-* y estos alias apuntan ahí; los consumidores no cambian. */
  --color-accent-strong:#2267AC;        /* blanco: 5.83:1 */
  --color-accent-hover:#1B5595;         /* blanco: 7.55:1 */
  --color-accent-mark:var(--color-accent);
  --color-accent-soft:var(--color-primary-soft); --color-on-accent-soft:var(--color-on-primary-soft);
  --color-accent-soft-border:#C5DCF0;

  /* ── Sidebar (navy) ── */
  --color-sidebar:var(--color-foreground);
  --color-sidebar-fg:#E2E8F0; --color-sidebar-idle:#CBD5E1;
  --color-sidebar-label:#94A3B8; --color-sidebar-line:rgba(255,255,255,.10);
  --color-sidebar-hover:rgba(255,255,255,.07);
  --color-live:#4ADE80;
  /* Texto secundario del toast (fondo oscuro). */
  --color-on-dark-muted:#CBD5E1;

  /* ── Tipografía ── */
  /* El brandboard nombra "Pipofy Sans", que no existe publicada; se resuelve en Poppins
     (SIL OFL). El <link> de Google Fonts está en src/index.html. */
  --font-heading:"Poppins","Segoe UI",system-ui,-apple-system,Roboto,sans-serif;
  --font-body:var(--font-heading);
}
```

- [ ] **Step 2: Depurar `tokens.css`**

- Borrar de `:root` cada variable que ahora está en `brand.css` (paleta base, `--color-border-strong`, `--color-fg-muted/-subtle`, familia `--color-primary-*`, familia `--color-accent-*`, `--font-heading`, `--font-body`). Quedan: espaciado, sombras, `--font-mono`, radios, scrim/z, movimiento, `--color-surface`, `--color-surface-2`, `--color-fg`, familia `--color-destructive-*`, familia `--color-warning-*`, escala tipográfica, y el reset/base.
- Reemplazar el encabezado del archivo por uno que diga que es el DS **no de marca** y que la paleta está en `brand.css`.
- Borrar el bloque `.brandmark .bm-logo{…}`, `.brandmark .bm-logo svg{…}`, `.brandmark .bm-name{…}`, `.brandmark .bm-sub{…}` con su comentario: `BrandmarkComponent` renderiza un `<img>` y las maquetas dejan la raíz en la Task 12.

- [ ] **Step 3: Consumidores**

- `angular.json` → `styles`: `["styles/brand.css", "styles/tokens.css", "styles/components.css", "src/styles.css"]`.
- `shell.component.css` `:host`: borrar `--color-sidebar…` (las 6 líneas de color) y `--color-live`; dejar `--sidebar-w`, `--header-h`, `--color-on-warning-mark`, `--wa`, los `--z-*` y la densidad `--text-*`. Actualizar el comentario de arriba.
- `grupo-detail-page.component.css:10`: `color:#DBE5F5` → `color:var(--color-on-primary-strong-muted)`.
- `components.css:344`: `color:#CBD5E1` → `color:var(--color-on-dark-muted)`.

- [ ] **Step 4: Verificar**

```bash
grep -rn "#[0-9A-Fa-f]\{6\}\b" src/app styles/components.css    # esperado: vacío
grep -c "#[0-9A-Fa-f]\{6\}\b" styles/tokens.css                  # sólo destructive/warning (≈10)
npm run lint && npm test
npm start   # abrir /login, /dashboard, /configuracion/canchas, /onboarding y una URL inválida:
            # comparar contra main; sidebar navy, iconos, placeholders y toasts iguales.
```

- [ ] **Step 5: Commit**

```bash
git add styles angular.json src/app/layout/shell.component.css src/app/features/grupos/pages/grupo-detail-page.component.css
git commit -m "refactor(estilos): brand.css con paleta y fuentes; tokens.css queda sin marca; sin hex sueltos"
```

---

### Task 10: Ambientes: una sola clave obligatoria, `.nvmrc`, `engines`

**Files:**
- Modify: `set-env.mjs`, `test-set-env.mjs`, `src/environments/environment.model.ts`, `.env.example`, `render.yaml`, `package.json`
- Create: `.nvmrc`
- Local (gitignoreado): `.env.development`

- [ ] **Step 1: Actualizar el self-check para el contrato nuevo**

Reemplazar `test-set-env.mjs`:

```js
import assert from 'node:assert/strict';
import { parseEnv, buildEnvironment, ngVarsFrom, fieldName } from './set-env.mjs';

assert.equal(fieldName('NG_API_BASE_URL'), 'apiBaseUrl');
assert.equal(fieldName('NG_REALTIME_BASE_URL'), 'realtimeBaseUrl');

const vars = parseEnv(`
# comentario
NG_API_BASE_URL=/api
NG_REALTIME_BASE_URL="/api/stream"
`);
assert.equal(vars['NG_REALTIME_BASE_URL'], '/api/stream', 'debe quitar comillas');

const out = buildEnvironment('production', vars);
assert.match(out, /production: true/);
assert.match(out, /apiBaseUrl: '\/api'/);
assert.match(out, /realtimeBaseUrl: '\/api\/stream'/);
assert.match(out, /satisfies Environment/);

// Sólo NG_API_BASE_URL es obligatoria: con ella sola alcanza.
const minimo = buildEnvironment('development', { NG_API_BASE_URL: '/api' });
assert.match(minimo, /production: false/);
assert.doesNotMatch(minimo, /realtimeBaseUrl/);

// Sin la obligatoria -> falla
assert.throws(() => buildEnvironment('development', {}), /Faltan claves/);

// Clave con pinta de secreto -> aborta
assert.throws(
  () => buildEnvironment('development', { NG_API_BASE_URL: '/api', MP_ACCESS_TOKEN: 'x' }),
  /secreto/i,
);

// Fallback al entorno (Render/CI): SÓLO entran las NG_*.
const fromEnv = ngVarsFrom({ NG_API_BASE_URL: 'https://x/api', AWS_SECRET_ACCESS_KEY: 'no', PATH: '/usr/bin' });
assert.deepEqual(Object.keys(fromEnv), ['NG_API_BASE_URL']);

console.log('✓ set-env self-check OK');
```

```bash
node test-set-env.mjs   # esperado: falla (fieldName no existe)
```

- [ ] **Step 2: `set-env.mjs`**

Reemplazar `REQUIRED` y `buildEnvironment`:

```js
/** La única clave sin la que la app no puede hacer nada. El resto es opcional y se emite si está. */
const REQUIRED = ['NG_API_BASE_URL'];
const SECRET_RE = /_(SECRET|TOKEN)$|ACCESS_TOKEN|PASSWORD|PRIVATE/i;

/** NG_API_BASE_URL → apiBaseUrl. El modelo tipado vive en environment.model.ts. */
export function fieldName(key) {
  return key
    .replace(/^NG_/, '')
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function buildEnvironment(env, vars) {
  const secret = Object.keys(vars).find((k) => SECRET_RE.test(k));
  if (secret) {
    throw new Error(
      `Clave "${secret}" parece un secreto. Los secretos van en el .env del backend, NO en el bundle del front.`,
    );
  }
  const missing = REQUIRED.filter((k) => !vars[k]);
  if (missing.length) {
    throw new Error(`Faltan claves en .env.${env}: ${missing.join(', ')}`);
  }
  // Toda NG_* presente se emite. Una clave que el modelo no declara rompe el build con un
  // error de TS que la nombra (`satisfies Environment` hace chequeo de propiedades de más):
  // es el aviso de "esta variable ya no la lee nadie".
  const fields = { production: env === 'production' };
  for (const [k, v] of Object.entries(vars)) {
    if (k.startsWith('NG_') && v !== '') fields[fieldName(k)] = v;
  }
  const body = Object.entries(fields)
    .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `'${v}'` : v},`)
    .join('\n');
  return (
    `// GENERADO por set-env.mjs — no editar a mano.\n` +
    `import type { Environment } from './environment.model';\n\n` +
    `export const environment = {\n${body}\n} satisfies Environment;\n`
  );
}
```

```bash
node test-set-env.mjs   # esperado: ✓
```

- [ ] **Step 3: Modelo, ejemplo, Render, Node**

`src/environments/environment.model.ts`:

```ts
/**
 * Lo que set-env.mjs emite desde las NG_* del `.env.<ambiente>`. Una clave nueva se declara
 * acá (opcional salvo que la app no arranque sin ella) y en .env.example.
 */
export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  /** Sin consumidor todavía (SseRealtimeConnection). */
  realtimeBaseUrl?: string;
}
```

`.env.example`:

```
# Config PÚBLICA por-ambiente. TODO esto termina en el bundle del navegador.
# Secretos reales (access tokens, credenciales) NO van acá — van al backend.
# Copiá este archivo a .env.development / .env.staging / .env.production y completá.
#
# Obligatoria. En development va '/api' a secas y lo resuelve proxy.conf.json; en prod es la
# URL completa de la API CON su prefijo global (p. ej. https://mi-api.onrender.com/api).
NG_API_BASE_URL=
# Opcionales. Cada NG_* que agregues acá se emite a environment.*.ts y tiene que estar
# declarada en src/environments/environment.model.ts.
# NG_REALTIME_BASE_URL=
```

`render.yaml`: dejar en `envVars` sólo `NG_API_BASE_URL` y `NODE_VERSION`; borrar los tres bloques con sus comentarios. Actualizar el comentario de cabecera: "set-env cae al fallback que lee las NG_* de este bloque; sólo NG_API_BASE_URL es obligatoria".

`.nvmrc` con `22.12.0`. En `package.json`: `"engines": { "node": ">=22.12" }` y el script `"check:scripts": "node test-set-env.mjs"`.

Local: borrar de tu `.env.development` las líneas `NG_STORAGE_BASE_PATH` y `NG_MERCADOPAGO_PUBLIC_KEY` (si quedan, el build falla nombrándolas: es a propósito).

- [ ] **Step 4: Verificar y commit**

```bash
node set-env.mjs development && npm run lint && npm test && npm run build
git add set-env.mjs test-set-env.mjs src/environments/environment.model.ts .env.example render.yaml .nvmrc package.json
git commit -m "build(env): sólo NG_API_BASE_URL obligatoria; claves opcionales derivadas por nombre; .nvmrc y engines"
```

---

### Task 11: Generador de slices

**Files:**
- Create: `scripts/new-slice.mjs`, `test-new-slice.mjs`
- Create: `scripts/slice-template/**` (13 archivos, listados abajo)
- Modify: `package.json` (scripts `new-slice`, `check:scripts`)

**Interfaces:**
- CLI: `node scripts/new-slice.mjs <entity> <entities> <feature> <label>`, p. ej. `node scripts/new-slice.mjs court courts canchas cancha`. Placeholders: `__Entity__` (Court) `__entity__` (court) `__entities__` (courts) `__Feature__` (Canchas) `__feature__` (canchas) `__label__` (cancha) `__Label__` (Cancha). Variable de entorno `SLICE_ROOT` (default `process.cwd()`) para el test.

- [ ] **Step 1: Self-check que falla**

`test-new-slice.mjs`:

```js
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'slice-'));
mkdirSync(join(root, 'src/app/core/domain'), { recursive: true });
writeFileSync(join(root, 'src/app/core/domain/errors.ts'), 'export abstract class DomainRuleError extends Error {}\n');

const run = () =>
  execFileSync('node', ['scripts/new-slice.mjs', 'widget', 'widgets', 'artefactos', 'artefacto'], {
    env: { ...process.env, SLICE_ROOT: root },
    encoding: 'utf8',
  });

const out = run();
assert.match(out, /app\.routes\.ts/, 'imprime los pasos manuales');

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(join(root, 'src'));
for (const f of files) {
  assert.doesNotMatch(readFileSync(f, 'utf8'), /__[A-Za-z]+__/, `placeholder sin reemplazar en ${f}`);
}
assert.ok(files.some((f) => f.endsWith('src/app/core/domain/entities/widget.ts')));
assert.ok(files.some((f) => f.endsWith('src/app/core/data/repositories/http-widgets.repository.ts')));
assert.ok(files.some((f) => f.endsWith('src/app/features/artefactos/pages/artefactos-page.component.html')));
assert.match(readFileSync(join(root, 'src/app/core/domain/errors.ts'), 'utf8'), /class InvalidWidgetError/);

// Nunca sobreescribe: la segunda corrida aborta antes de tocar nada.
assert.throws(run, /ya existe/);

console.log('✓ new-slice self-check OK');
```

```bash
node test-new-slice.mjs   # esperado: falla (no existe scripts/new-slice.mjs)
```

- [ ] **Step 2: El generador**

`scripts/new-slice.mjs`:

```js
#!/usr/bin/env node
/**
 * Estampa un slice vertical completo (entidad → contrato → DTO → mapper → repo HTTP → facade →
 * página) desde scripts/slice-template/, reemplazando placeholders. Nunca sobreescribe.
 *
 *   node scripts/new-slice.mjs <entity> <entities> <feature> <label>
 *   node scripts/new-slice.mjs court   courts     canchas   cancha
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [entity, entities, feature, label] = process.argv.slice(2);
if (!entity || !entities || !feature || !label) {
  console.error('Uso: node scripts/new-slice.mjs <entity> <entities> <feature> <label>  (p. ej. court courts canchas cancha)');
  process.exit(1);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const VARS = {
  __Entity__: cap(entity), __entity__: entity,
  __Entities__: cap(entities), __entities__: entities,
  __FEATURE__: feature.toUpperCase(), __Feature__: cap(feature), __feature__: feature,
  __Label__: cap(label), __label__: label,
};
const fill = (s) => Object.entries(VARS).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);

const root = resolve(process.env.SLICE_ROOT ?? process.cwd());
const templateDir = join(dirname(fileURLToPath(import.meta.url)), 'slice-template');

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const plan = walk(templateDir).map((src) => ({
  src,
  dest: join(root, 'src/app', fill(relative(templateDir, src))),
}));

const existing = plan.filter((p) => existsSync(p.dest));
if (existing.length) {
  console.error(`Abortado, ya existe:\n${existing.map((p) => '  ' + relative(root, p.dest)).join('\n')}`);
  process.exit(1);
}

for (const { src, dest } of plan) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, fill(readFileSync(src, 'utf8')));
  console.log(`  + ${relative(root, dest)}`);
}

// Todas las DomainRuleError viven en errors.ts para que toDomainError tenga un solo lugar donde mirar.
const errors = join(root, 'src/app/core/domain/errors.ts');
const cls = `Invalid${VARS.__Entity__}Error`;
if (!readFileSync(errors, 'utf8').includes(`class ${cls}`)) {
  appendFileSync(errors, `\nexport class ${cls} extends DomainRuleError {\n  constructor(message: string) {\n    super(message);\n    this.name = '${cls}';\n  }\n}\n`);
  console.log(`  ~ src/app/core/domain/errors.ts (+ ${cls})`);
}

console.log(`
Falta a mano:
  1. Ruta lazy en src/app/app.routes.ts:
       { path: '${feature}', loadChildren: () => import('./features/${feature}/${feature}.routes').then((m) => m.${VARS.__Feature__.toUpperCase()}_ROUTES), data: { title: '${VARS.__Label__}s', crumb: '${VARS.__Feature__}' } }
  2. Item en src/app/product/nav.ts (y el icono en product/icons.ts).
  3. Campos reales: la plantilla trae sólo \`name\`. Empezá por la entidad y el DTO, los tests te guían.
`);
```

- [ ] **Step 3: La plantilla (13 archivos bajo `scripts/slice-template/`)**

Rutas relativas a `src/app/` con placeholders en el nombre. Contenido:

`core/domain/entities/__entity__.ts`:

```ts
import { Invalid__Entity__Error } from '../errors';

export interface __Entity__ {
  readonly id: string;
  /** Puede ser '': la lectura es tolerante con filas incompletas. */
  readonly name: string;
}

/** Lo que el formulario produce. Sin `id`: alta y edición mandan el mismo cuerpo. */
export interface __Entity__Draft {
  readonly name: string;
}

/** Lo que sale de los controles del form. */
export interface __Entity__Input {
  readonly name: string;
}

/** La invariante corre SÓLO en escritura. */
export function create__Entity__Draft(input: __Entity__Input): __Entity__Draft {
  const name = input.name.trim();
  if (!name) throw new Invalid__Entity__Error('El nombre de __label__ es obligatorio.');
  return { name };
}
```

`core/domain/entities/__entity__.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { create__Entity__Draft } from './__entity__';
import { Invalid__Entity__Error } from '../errors';

describe('create__Entity__Draft', () => {
  it('recorta el nombre', () => {
    expect(create__Entity__Draft({ name: '  Uno  ' })).toEqual({ name: 'Uno' });
  });

  it('tira Invalid__Entity__Error cuando el nombre está vacío', () => {
    expect(() => create__Entity__Draft({ name: '   ' })).toThrow(Invalid__Entity__Error);
  });
});
```

`core/domain/contracts/__entities__.repository.ts`:

```ts
import { __Entity__, __Entity__Draft } from '../entities/__entity__';

/**
 * Clase abstracta a propósito: token DI sin @angular/core en el dominio. Las escrituras
 * devuelven void y la facade re-lee.
 */
export abstract class __Entities__Repository {
  abstract list(): Promise<__Entity__[]>;
  abstract create(draft: __Entity__Draft): Promise<void>;
  abstract update(id: string, draft: __Entity__Draft): Promise<void>;
  abstract remove(id: string): Promise<void>;
}
```

`core/data/dto/__entities__.dto.ts`:

```ts
import * as v from 'valibot';

/** Lectura tolerante: el backend puede guardar filas incompletas. */
export const __Entity__DtoSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
});
export type __Entity__Dto = v.InferOutput<typeof __Entity__DtoSchema>;
export const __Entity__ListDtoSchema = v.array(__Entity__DtoSchema);

/** Write-path: sólo lo que el backend acepta. */
export const __Entity__RequestSchema = v.object({
  name: v.string(),
});
export type __Entity__Request = v.InferOutput<typeof __Entity__RequestSchema>;
```

`core/data/mappers/__entity__.mapper.ts`:

```ts
import { __Entity__, __Entity__Draft } from '@domain/entities/__entity__';
import { __Entity__Dto, __Entity__Request } from '../dto/__entities__.dto';

export function to__Entity__(dto: __Entity__Dto): __Entity__ {
  return { id: dto.id, name: dto.name ?? '' };
}

export function to__Entity__Request(draft: __Entity__Draft): __Entity__Request {
  return { name: draft.name };
}
```

`core/data/mappers/__entity__.mapper.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { to__Entity__, to__Entity__Request } from './__entity__.mapper';

describe('to__Entity__', () => {
  it('mapea el DTO a la entidad', () => {
    expect(to__Entity__({ id: '7', name: 'Uno' })).toEqual({ id: '7', name: 'Uno' });
  });

  it('tolera name en null', () => {
    expect(to__Entity__({ id: '8', name: null })).toEqual({ id: '8', name: '' });
  });
});

describe('to__Entity__Request', () => {
  it('manda sólo los campos del DTO', () => {
    expect(to__Entity__Request({ name: 'Uno' })).toEqual({ name: 'Uno' });
  });
});
```

`core/data/repositories/http-__entities__.repository.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__, __Entity__Draft } from '@domain/entities/__entity__';
import { __Entity__ListDtoSchema, __Entity__RequestSchema } from '../dto/__entities__.dto';
import { to__Entity__, to__Entity__Request } from '../mappers/__entity__.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/** v.parse tira fuera del observable: el try/catch normaliza las dos vías. */
@Injectable()
export class Http__Entities__Repository extends __Entities__Repository {
  private readonly api = inject(ApiClient);

  async list(): Promise<__Entity__[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/__entities__'));
      return v.parse(__Entity__ListDtoSchema, raw).map(to__Entity__);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: __Entity__Draft): Promise<void> {
    try {
      const body = v.parse(__Entity__RequestSchema, to__Entity__Request(draft));
      await firstValueFrom(this.api.post<unknown>('/__entities__', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: __Entity__Draft): Promise<void> {
    try {
      const body = v.parse(__Entity__RequestSchema, to__Entity__Request(draft));
      await firstValueFrom(this.api.patch<unknown>(`/__entities__/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/__entities__/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
```

`features/__feature__/__feature__.facade.ts`:

```ts
import { Injectable, computed, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__, __Entity__Input, create__Entity__Draft } from '@domain/entities/__entity__';
import { DomainError, asDomainError } from '@domain/errors';

@Injectable()
export class __Feature__Facade extends SignalStore<__Entity__[], DomainError> {
  private readonly repo = inject(__Entities__Repository);

  readonly sorted = computed(() => [...(this.data() ?? [])].sort((a, b) => a.name.localeCompare(b.name)));

  load(): Promise<void> {
    return this.run(this.repo.list(), asDomainError);
  }

  clearError(): void {
    this.setError(null);
  }

  /** create__Entity__Draft tira síncrono: va DENTRO de la promesa para que run() lo normalice. */
  create(input: __Entity__Input): Promise<void> {
    return this.run(
      Promise.resolve().then(() => this.repo.create(create__Entity__Draft(input))).then(() => this.repo.list()),
      asDomainError,
    );
  }

  update(id: string, input: __Entity__Input): Promise<void> {
    return this.run(
      Promise.resolve().then(() => this.repo.update(id, create__Entity__Draft(input))).then(() => this.repo.list()),
      asDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(this.repo.remove(id).then(() => this.repo.list()), asDomainError);
  }
}
```

`features/__feature__/__feature__.facade.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { __Feature__Facade } from './__feature__.facade';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { __Entity__ } from '@domain/entities/__entity__';

const row: __Entity__ = { id: '1', name: 'Uno' };

function setup(over: Partial<__Entities__Repository> = {}) {
  const calls: string[] = [];
  const repo = {
    list: async () => { calls.push('list'); return [row]; },
    create: async () => { calls.push('create'); },
    update: async () => { calls.push('update'); },
    remove: async () => { calls.push('remove'); },
    ...over,
  } as __Entities__Repository;
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), __Feature__Facade, { provide: __Entities__Repository, useValue: repo }],
  });
  return { facade: TestBed.inject(__Feature__Facade), calls };
}

describe('__Feature__Facade', () => {
  it('load() puebla data()', async () => {
    const { facade } = setup();
    await facade.load();
    expect(facade.data()).toEqual([row]);
  });

  it('create() escribe y re-lee', async () => {
    const { facade, calls } = setup();
    await facade.create({ name: 'Dos' });
    expect(calls).toEqual(['create', 'list']);
  });

  it('nombre vacío deja error de dominio y NO llama al repo', async () => {
    const { facade, calls } = setup();
    await facade.create({ name: ' ' });
    expect(calls).toEqual([]);
    expect(facade.error()).toMatchObject({ kind: 'domain' });
  });
});
```

`features/__feature__/__feature__-form-modal.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { __Entity__, __Entity__Input } from '@domain/entities/__entity__';

/** Alta y edición: `open(null)` es alta, `open(item)` es edición. No valida: eso lo hace la facade. */
@Component({
  selector: 'app-__feature__-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="item() ? 'Editar __label__' : 'Nueva __label__'" icon="primary">
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }
      <div class="field">
        <label for="__feature__-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- contrato de ModalComponent: showModal() sólo autoenfoca un elemento con 'autofocus' -->
        <input id="__feature__-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>
      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class __Feature__FormModalComponent {
  readonly error = input('');
  readonly saved = output<__Entity__Input>();
  private readonly modal = viewChild.required(ModalComponent);
  protected readonly item = signal<__Entity__ | null>(null);
  protected readonly name = signal('');

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  /** Siembra imperativa en cada apertura, con el item por parámetro (ver cancha-form-modal). */
  open(item: __Entity__ | null): void {
    this.item.set(item);
    this.name.set(item?.name ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({ name: this.name() });
  }
}
```

`features/__feature__/pages/__feature__-page.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { __Feature__Facade } from '../__feature__.facade';
import { __Feature__FormModalComponent } from '../__feature__-form-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { __Entity__, __Entity__Input } from '@domain/entities/__entity__';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-__feature__-page',
  standalone: true,
  imports: [__Feature__FormModalComponent, ConfirmDeleteModalComponent, PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './__feature__-page.component.html',
  styleUrl: './__feature__-page.component.css',
})
export class __Feature__PageComponent {
  protected readonly facade = inject(__Feature__Facade);
  private readonly toast = inject(ToastService);
  private readonly form = viewChild.required(__Feature__FormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);

  protected readonly query = signal('');
  private readonly editing = signal<__Entity__ | null>(null);
  protected readonly deleting = signal<__Entity__ | null>(null);

  constructor() {
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Nada coincide con la búsqueda' : 'Todavía no cargaste ninguna __label__',
  );

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(item: __Entity__): void {
    this.facade.clearError();
    this.editing.set(item);
    this.form().open(item);
  }

  protected askDelete(item: __Entity__): void {
    this.deleting.set(item);
    this.confirm().open();
  }

  protected async onSaved(input: __Entity__Input): Promise<void> {
    const editing = this.editing();
    if (editing) await this.facade.update(editing.id, input);
    else await this.facade.create(input);
    if (this.facade.error()) return; // el modal queda abierto: es donde se corrige
    this.form().close();
    this.toast.show('ok', '__Label__ guardada', editing ? 'Se actualizaron los datos.' : 'Se creó la __label__.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const item = this.deleting();
    if (!item) return;
    await this.facade.remove(item.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', '__Label__ eliminada', `Se eliminó ${item.name}.`);
  }
}
```

`features/__feature__/pages/__feature__-page.component.html`:

```html
<section class="panel">
  <div class="panel-head">
    <h3>__Feature__</h3>
    <div class="search-box">
      <label class="sr-only" for="__feature__-q">Buscar __label__ por nombre</label>
      <input id="__feature__-q" type="search" placeholder="Buscar __label__…" (input)="onSearch($event)" />
    </div>
    <button type="button" class="btn btn-primary" (click)="openNew()">+ Nueva __label__</button>
  </div>

  @if (errorText()) {
    <app-notice tone="bad">{{ errorText() }}</app-notice>
  }

  @if (facade.loading()) {
    <app-placeholder tone="loading" title="Cargando __feature__…" />
  } @else if (filtered().length) {
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col" class="cell-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (item of filtered(); track item.id) {
            <tr>
              <td>{{ item.name || '(sin nombre)' }}</td>
              <td class="cell-end">
                <button type="button" class="btn btn-ghost btn-sm" (click)="openEdit(item)">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" (click)="askDelete(item)">Eliminar</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  } @else if (facade.data()) {
    <app-placeholder [title]="emptyTitle()" />
  }
</section>

<app-__feature__-form-modal [error]="errorText()" (saved)="onSaved($event)" />

<app-confirm-delete-modal
  [itemName]="deleting()?.name || 'esta __label__'"
  (confirmed)="onDeleteConfirmed()" />
```

`features/__feature__/pages/__feature__-page.component.css`:

```css
/* Los primitivos (.panel, .table-scroll, .btn*) viven en styles/components.css. Acá va SÓLO lo
   específico de esta tabla. */
.cell-end .btn + .btn {
  margin-left: var(--space-sm);
}
```

`features/__feature__/__feature__.providers.ts`:

```ts
import { Provider } from '@angular/core';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { Http__Entities__Repository } from '@data/repositories/http-__entities__.repository';

/** El ÚNICO archivo de la feature que importa @data: bindea contrato → implementación. */
export const __FEATURE___PROVIDERS: Provider[] = [
  { provide: __Entities__Repository, useClass: Http__Entities__Repository },
];
```

`features/__feature__/__feature__.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { __Feature__Facade } from './__feature__.facade';
import { __FEATURE___PROVIDERS } from './__feature__.providers';

export const __FEATURE___ROUTES: Routes = [
  {
    path: '',
    providers: [__Feature__Facade, ...__FEATURE___PROVIDERS],
    loadComponent: () =>
      import('./pages/__feature__-page.component').then((m) => m.__Feature__PageComponent),
  },
];
```

`__FEATURE___PROVIDERS` es `__FEATURE__` + `_PROVIDERS`: con `canchas` da `CANCHAS_PROVIDERS`. Los placeholders son case-sensitive, así que `__FEATURE__`, `__Feature__` y `__feature__` no se pisan.

- [ ] **Step 4: Probar el generador contra el repo real**

```bash
node test-new-slice.mjs                                    # ✓
node scripts/new-slice.mjs widget widgets artefactos artefacto
npm run lint && npm test                                   # el slice generado compila y sus 8 tests pasan
# Limpiar SÓLO lo generado (errors.ts se revierte; nada más se toca)
rm -r src/app/features/artefactos
rm src/app/core/domain/entities/widget.ts src/app/core/domain/entities/widget.spec.ts \
   src/app/core/domain/contracts/widgets.repository.ts src/app/core/data/dto/widgets.dto.ts \
   src/app/core/data/mappers/widget.mapper.ts src/app/core/data/mappers/widget.mapper.spec.ts \
   src/app/core/data/repositories/http-widgets.repository.ts
git checkout src/app/core/domain/errors.ts
git status --short                                         # esperado: sólo scripts/, test-new-slice.mjs, package.json
```

`package.json`: `"new-slice": "node scripts/new-slice.mjs"` y `"check:scripts": "node test-set-env.mjs && node test-new-slice.mjs"`.

- [ ] **Step 5: Commit**

```bash
npm run check:scripts
git add scripts test-new-slice.mjs package.json
git commit -m "feat(scripts): generador new-slice con plantilla de slice vertical y self-check"
```

---

### Task 12: Docs, limpieza de la raíz y cierre

**Files:**
- Modify: `README.md`, `CLAUDE.md` (y commitearlo), `docs/superpowers/specs/2026-09-19-template-kernel-producto-design.md`
- Create: `docs/TEMPLATE.md`
- Move: `index-v2.html`, `onboarding.html`, `pipofy_1.html` → `docs/maquetas/`; `assets/` → `docs/brandboard/`
- Delete: `main.ts` (raíz, vacío)

- [ ] **Step 1: Mover maquetas y brandboard, borrar `main.ts`**

```bash
mkdir -p docs/maquetas
git mv index-v2.html onboarding.html pipofy_1.html docs/maquetas/
sed -i '' -e 's#href="styles/#href="../../styles/#g' docs/maquetas/*.html
git mv assets docs/brandboard
git rm main.ts
grep -rn "assets/LEEME\|index-v2.html\|onboarding.html" src styles CLAUDE.md | head   # referencias a reapuntar a docs/…
```

Reapuntar en `styles/tokens.css` y `brand.css` cualquier "assets/LEEME.md" → "docs/brandboard/LEEME.md" y "index-v2.html" → "docs/maquetas/index-v2.html".

- [ ] **Step 2: `docs/TEMPLATE.md`**

```markdown
# Usar este repo como template

Este repo es un backoffice Angular 20 listo para un producto nuevo. Pipofy es el primer producto y
sirve de ejemplo. Lo que sigue es TODO lo que hay que tocar; el resto es kernel.

## 1. Clonar y arrancar

    git clone <este-repo> mi-producto && cd mi-producto
    nvm use                      # .nvmrc = 22.12
    npm ci
    cp .env.example .env.development   # NG_API_BASE_URL=/api  (proxy.conf.json → localhost:3000)
    npm start

## 2. Superficie de producto

| Qué | Dónde |
|---|---|
| Nombre, tagline, prefijo de storage, locale, etiquetas de rol, links del pie | `src/app/product/app-config.ts` |
| Navegación (grupos, items, hijos) | `src/app/product/nav.ts` |
| Iconos de nav e ilustraciones `state-*` | `src/app/product/icons.ts` |
| Paleta y fuentes | `styles/brand.css` (cada color trae su contraste AA: verificalo al cambiar) |
| Logo horizontal y favicon | `public/brand/` |
| `<title>`, `lang`, `<link>` de la fuente, favicon | `src/index.html` |
| Qué features existen y bajo qué path | `src/app/app.routes.ts` |
| Red por ambiente | `.env.development` / `.env.staging` / `.env.production` (`NG_API_BASE_URL` obligatoria) |
| Nombre del proyecto | `package.json` → `name`, `angular.json` → `projects.<nombre>`, `render.yaml` → `staticPublishPath` |

`src/app/product/` sólo lo importa `app.config.ts`. Si una feature necesita algo de ahí, es un
dato que falta en `APP_CONFIG` / `NAV_CONFIG` / `ICONS` (`src/app/core/config/`): agregalo al
token, no importes `product/`.

## 3. Borrar lo que no aplica

Las features de Pipofy (`grupos`, `reservas`, `alumnos`, `configuracion/*`, `dashboard`) son
del producto. Para sacar una: borrar `src/app/features/<x>`, su ruta en `app.routes.ts`, su
item en `product/nav.ts`, y sus entidades/contratos/DTOs/mappers/repos en `core/`. `npm run lint`
y `npm test` te dicen qué quedó colgado. `auth` y `onboarding` son kernel: se quedan.

## 4. Agregar un slice

    npm run new-slice -- court courts canchas cancha
    # <entity> <entities> <feature> <label>  →  imprime los 3 pasos manuales

Genera entidad, contrato, DTO, mapper, repo HTTP, facade, modal, página, providers, rutas y
tests, con un solo campo `name`. Después: ruta en `app.routes.ts`, item en `product/nav.ts`,
y los campos reales (empezá por la entidad y el DTO; los tests guían).

## 5. Agregar un icono

Sumá la clave a `product/icons.ts` con el markup `<svg viewBox="0 0 24 24">…</svg>` (sin
width/height; usá `currentColor`). Usalo con `<app-icon name="clave" />` y fijá el tamaño en
el CSS del consumidor sobre `app-icon`.

## 6. Reglas del kernel

- Capas impuestas por eslint (`eslint.config.js`): ver la tabla en `CLAUDE.md`.
- Una feature importa `@data` **sólo** en su `<feature>.providers.ts`.
- Un error nuevo = un `kind` nuevo en `domain/errors.ts` + su copy en `domainErrorMessage`
  (el build rompe hasta que lo tenga).
- Claves de storage: `storageKey(config, 'nombre', version)`, nunca literales.
```

- [ ] **Step 3: `README.md`**

Reemplazar el boilerplate por:

```markdown
# Pipofy Backoffice · template de backoffice Angular 20

Backoffice del SaaS de gestión de clubes de pádel **Pipofy**, construido como template
reutilizable: el kernel (auth, HTTP, errores, layout, primitivos de UI, patrón de slice) no
depende del producto, y el producto se configura en `src/app/product/`, `styles/brand.css` y
`public/brand/`. Consume la API de `pipofy-backend` (NestJS + Prisma).

- Para arrancar un producto nuevo: **[docs/TEMPLATE.md](docs/TEMPLATE.md)**.
- Para trabajar en este repo (arquitectura, convenciones, tests): **[CLAUDE.md](CLAUDE.md)**.

## Comandos

    npm start              # set-env development + ng serve (proxy /api → localhost:3000)
    npm run build          # set-env production + ng build
    npm run build:staging
    npm test               # vitest + jsdom
    npm run lint           # eslint (TS + templates + boundaries de capas)
    npm run check:scripts  # self-checks de set-env.mjs y new-slice.mjs
    npm run new-slice -- <entity> <entities> <feature> <label>

Antes de arrancar: `cp .env.example .env.development` (sólo `NG_API_BASE_URL` es obligatoria).
Node 22.12+ (`.nvmrc`).

## Capas

`core/config` (tokens del producto) → `core/domain` (TS puro) → `core/data` (HTTP, DTOs) →
`shared` (UI agnóstica) → `layout` (shell) → `features/*` (una por pantalla) ← `product/`
(datos de marca, nav, iconos). Las flechas permitidas están en `eslint.config.js` y violarlas
es error de lint.

## Docs

`docs/superpowers/specs/` (diseño aprobado) y `docs/superpowers/plans/` (planes task por
task). `docs/maquetas/` son maquetas HTML estáticas de referencia; `docs/brandboard/` la marca.
```

- [ ] **Step 4: `CLAUDE.md`**

- Reemplazar la tabla de capas por la de Global Constraints de este plan (con `config`, `layout`, `auth`, `product`).
- Agregar en "Providers": "Las features importan `@data` **sólo** en `<feature>.providers.ts`."
- En "Estilos": `styles/brand.css` (paleta y fuentes, por producto) → `tokens.css` (DS no de marca) → `components.css` → `*.component.css`. Los iconos de nav y el arte de placeholders salen de `ICONS` (`product/icons.ts`) vía `<app-icon>`.
- Reemplazar la frase sobre las maquetas en la raíz por: "`docs/maquetas/*.html` son maquetas estáticas de referencia, no parte del build."
- Sección nueva "Template": una línea que apunte a `docs/TEMPLATE.md` y a `npm run new-slice`.
- Comandos: sumar `check:scripts` y `new-slice`.

```bash
git add CLAUDE.md
```

- [ ] **Step 5: Actualizar el spec con las desviaciones del plan**

En `docs/superpowers/specs/2026-09-19-template-kernel-producto-design.md`:
- §3: `AppConfig` no lleva `api`; la red va en `API_CONFIG` (`core/config/api-config.ts`, sin default). Los otros tres tokens tienen default por `factory`, así los specs no proveen nada. Alias `@config/*`. `footerLinks` es `{ label, href: string | null }`.
- §3 tabla: `auth` como elemento propio antes de `features/*`.
- §8: la plantilla es un slice **mínimo** (`{ id, name }`), no una copia de canchas; 4 argumentos (`<entity> <entities> <feature> <label>`); el generador anexa `Invalid<Entity>Error` a `errors.ts`.

- [ ] **Step 6: Verificación final y commit**

```bash
npm run lint && npm test && npm run build && npm run check:scripts
grep -rn "from '@data/" src/app/features --include='*.ts' | grep -v "providers.ts\|\.spec\." # vacío
grep -rn "from '@data/" src/app/layout src/app/shared --include='*.ts'                     # vacío
grep -rln "from '.*product/\|from './product'" src/app --include='*.ts' | grep -v "^src/app/product/\|app.config.ts"   # vacío
graphify update .   # mantiene el grafo (AST-only), pedido por CLAUDE.md
git add -A
git commit -m "docs: README y TEMPLATE.md para el template; maquetas y brandboard a docs/; CLAUDE.md commiteado"
```

Con esto la rama `feat/template-kernel` queda lista para revisión y merge a `main`.
