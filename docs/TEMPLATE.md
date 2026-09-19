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
