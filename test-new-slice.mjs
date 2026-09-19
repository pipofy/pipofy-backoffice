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
