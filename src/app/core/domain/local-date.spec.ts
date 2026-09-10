import { describe, it, expect } from 'vitest';
import { isOnLocalDate, shiftDateKey } from './local-date';

describe('isOnLocalDate', () => {
  it('una sesión de las 22:00 locales pertenece a SU día local, no al UTC', () => {
    // test-setup.ts fija TZ=America/Argentina/Buenos_Aires (UTC-3): las 22:00 del 19 locales
    // son las 01:00Z del 20. Comparar en UTC la mandaría al día siguiente, que es exactamente
    // el bug que este predicado existe para evitar.
    expect(isOnLocalDate('2026-08-20T01:00:00.000Z', '2026-08-19')).toBe(true);
  });

  it('false cuando cae en otro día local', () => {
    expect(isOnLocalDate('2026-08-20T15:00:00.000Z', '2026-08-19')).toBe(false);
  });

  it('false con null, sin tirar', () => {
    expect(isOnLocalDate(null, '2026-08-19')).toBe(false);
  });

  it('false con una fecha inválida, sin tirar', () => {
    // startAt es nullable en Prisma y nadie lo valida del otro lado.
    expect(isOnLocalDate('no-es-una-fecha', '2026-08-19')).toBe(false);
  });
});

describe('shiftDateKey', () => {
  it('corre días dentro del mes', () => {
    expect(shiftDateKey('2026-09-10', 1)).toBe('2026-09-11');
    expect(shiftDateKey('2026-09-10', -1)).toBe('2026-09-09');
  });

  it('desborda mes y año', () => {
    expect(shiftDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-12-31', 28)).toBe('2027-01-28');
  });

  // Argentina es UTC-3 fijo, pero el cálculo se hace con new Date(y, m, d) en hora LOCAL:
  // hacerlo en UTC correría un día en cualquier zona al oeste de Greenwich.
  it('no se corre un día cerca del borde', () => {
    expect(shiftDateKey('2026-09-10', -28)).toBe('2026-08-13');
    expect(shiftDateKey('2026-09-10', 28)).toBe('2026-10-08');
  });
});
