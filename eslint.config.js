// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const boundaries = require("eslint-plugin-boundaries");

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
  {
    files: ["src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/legacy-warnings": false,
      // El resolver "node" solo no ve los alias @domain/@data/@shared/@features de
      // tsconfig.json: boundaries los trata como paquete externo y no los evalúa, así que una
      // violación de capas a través de un alias pasaba desapercibida (ver catalog-labels.ts).
      // El resolver "typescript" lee los `paths` de tsconfig.json y cierra ese agujero.
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: { extensions: [".ts", ".js"] },
      },
      "import/extensions": [".ts", ".js"],
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
    },
    rules: {
      // Local layer-to-layer boundaries (native, non-deprecated policies API).
      "boundaries/dependencies": ["error", {
        default: "disallow",
        policies: [
          // config no aparece como `from`: sólo puede importarse a sí mismo (relación interna).
          { from: { element: { type: "domain" } }, allow: { to: { element: { type: "domain" } } } },
          { from: { element: { type: "data" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "config"] } } } } },
          { from: { element: { type: "shared" } }, allow: { to: { element: { types: { anyOf: ["shared", "config"] } } } } },
          // TEMPORAL hasta que el shell inyecte los contratos de domain (SessionStore,
          // UsersRepository): entonces se saca "data" de esta lista y layout queda con
          // domain, shared, config y auth. Ver plan Task 6.
          { from: { element: { type: "layout" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "shared", "config", "auth"] } } } } },
          { from: { element: { type: "auth" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "shared", "config"] } } } } },
          { from: { element: { type: "features" } }, allow: { to: { element: { types: { anyOf: ["domain", "data", "shared", "config"] } } } } },
          // product es DATOS del producto: lo consume app.config.ts (fuera de elements) y nadie más.
          { from: { element: { type: "product" } }, allow: { to: { element: { types: { anyOf: ["config", "shared"] } } } } },
        ],
      }],
      // domain -> @angular/* is an external-package check, which the native "dependencies"
      // rule only evaluates with `checkAllOrigins: true` (and that would then also need
      // catch-all "allow" policies for every other external package domain legitimately
      // uses, e.g. vitest). The dedicated "external" rule checks external/core origins
      // unconditionally, so it stays the simplest correct tool for this one constraint.
      "boundaries/external": ["error", {
        default: "allow",
        rules: [
          { from: ["domain"], disallow: ["@angular/*"], message: "domain must stay pure TS — no Angular imports" },
        ],
      }],
    },
  }
);
