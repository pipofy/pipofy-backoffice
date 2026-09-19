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

// Clave presente pero vacía (NG_X=) no se emite: es lo mismo que no ponerla.
const vacia = buildEnvironment('development', {
  NG_API_BASE_URL: '/api',
  NG_REALTIME_BASE_URL: '',
});
assert.doesNotMatch(vacia, /realtimeBaseUrl/);

// Sin la obligatoria -> falla
assert.throws(() => buildEnvironment('development', {}), /Faltan claves/);

// Clave con pinta de secreto -> aborta
assert.throws(
  () => buildEnvironment('development', { NG_API_BASE_URL: '/api', MP_ACCESS_TOKEN: 'x' }),
  /secreto/i,
);

// Fallback al entorno (Render/CI): SÓLO entran las NG_*.
const fromEnv = ngVarsFrom({
  NG_API_BASE_URL: 'https://x/api',
  AWS_SECRET_ACCESS_KEY: 'no',
  PATH: '/usr/bin',
});
assert.deepEqual(Object.keys(fromEnv), ['NG_API_BASE_URL']);

console.log('✓ set-env self-check OK');
