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
  console.error(
    'Uso: node scripts/new-slice.mjs <entity> <entities> <feature> <label>  (p. ej. court courts canchas cancha)\n' +
      'Cada argumento debe ser minúsculas y dígitos, sin guiones ni "/".',
  );
  process.exit(1);
}
const ARG_RE = /^[a-z][a-z0-9]*$/;
const badArg = [entity, entities, feature, label].find((a) => !ARG_RE.test(a));
if (badArg) {
  console.error(`Cada argumento debe ser minúsculas y dígitos, sin guiones ni "/": ${badArg}`);
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
