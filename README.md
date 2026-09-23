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
