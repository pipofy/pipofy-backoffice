import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ProfesoresFacade } from './profesores.facade';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Coach, CoachDraft } from '@domain/entities/coach';
import { UsersRepository } from '@data/repositories/users.repository';

const COACHES: Coach[] = [
  { id: '2', displayName: 'Zulema Paz', description: null },
  { id: '1', displayName: 'Ana Díaz', description: 'Revés a una mano' },
];

function setup(repo: Partial<CoachesRepository>, users: Partial<UsersRepository> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CoachesRepository, useValue: repo },
      { provide: UsersRepository, useValue: users },
      ProfesoresFacade,
    ],
  });
  return TestBed.inject(ProfesoresFacade);
}

describe('ProfesoresFacade', () => {
  it('load() deja la lista en data()', async () => {
    const f = setup({ list: async () => COACHES });
    await f.load();
    expect(f.data()).toHaveLength(2);
  });

  it('sorted() ordena por displayName: el backend no ordena', async () => {
    const f = setup({ list: async () => COACHES });
    await f.load();
    expect(f.sorted().map((c) => c.displayName)).toEqual(['Ana Díaz', 'Zulema Paz']);
  });

  it('sorted() con data() en null devuelve lista vacía, no rompe', () => {
    expect(setup({ list: async () => COACHES }).sorted()).toEqual([]);
  });

  it('save() manda el draft y RELEE', async () => {
    const enviados: { id: string; draft: CoachDraft }[] = [];
    let leidas = 0;
    const f = setup({
      update: async (id, draft) => {
        enviados.push({ id, draft });
      },
      list: async () => {
        leidas++;
        return COACHES;
      },
    });
    await f.save('1', { description: '  Revés a dos manos  ' });
    expect(enviados).toEqual([{ id: '1', draft: { description: 'Revés a dos manos' } }]);
    expect(leidas).toBe(1);
  });

  it('save() con descripción vacía manda null', async () => {
    const enviados: CoachDraft[] = [];
    const f = setup({
      update: async (_id, d) => {
        enviados.push(d);
      },
      list: async () => COACHES,
    });
    await f.save('1', { description: '   ' });
    expect(enviados[0].description).toBeNull();
  });

  it('save() que falla deja el error normalizado', async () => {
    const f = setup({
      update: async () => {
        throw { kind: 'not-found' };
      },
      list: async () => COACHES,
    });
    await f.save('9', { description: 'x' });
    expect(f.error()).toEqual({ kind: 'not-found' });
  });

  it('clearError() limpia', async () => {
    const f = setup({
      list: async () => {
        throw { kind: 'network' };
      },
    });
    await f.load();
    f.clearError();
    expect(f.error()).toBeNull();
  });
});

describe('ProfesoresFacade.crear', () => {
  const ROLES = [
    { id: '3', name: 'admin' },
    { id: '7', name: 'profesor' },
  ];
  const INPUT = { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' };

  it('busca el rol "profesor" y manda el draft con ese roleId', async () => {
    const enviados: unknown[] = [];
    const f = setup(
      { list: async () => COACHES },
      {
        roles: async () => ROLES,
        create: async (d) => {
          enviados.push(d);
        },
      },
    );
    expect(await f.crear(INPUT)).toBe(true);
    expect(enviados).toEqual([
      { email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez', roleId: '7' },
    ]);
  });

  it('relee la lista después de crear', async () => {
    let leidas = 0;
    const f = setup(
      {
        list: async () => {
          leidas++;
          return COACHES;
        },
      },
      { roles: async () => ROLES, create: async () => undefined },
    );
    await f.crear(INPUT);
    expect(leidas).toBe(1);
    expect(f.data()).toHaveLength(2);
  });

  it('RELEE también cuando create() falla: el backend no es atómico con el mail', async () => {
    // §3.2: POST /users crea user + coachProfile y recién después manda el mail, sin catch.
    // Un 500 de SMTP deja el profesor creado. La tabla tiene que mostrar lo que HAY.
    let leidas = 0;
    const f = setup(
      {
        list: async () => {
          leidas++;
          return COACHES;
        },
      },
      {
        roles: async () => ROLES,
        create: async () => {
          throw new Error('boom');
        },
      },
    );
    expect(await f.crear(INPUT)).toBe(false);
    expect(leidas).toBe(1);
    expect(f.data()).toHaveLength(2);
    expect(f.error()).not.toBeNull();
  });

  it('sin rol "profesor" no llama a create() y deja un mensaje propio', async () => {
    // Es el caso de las cuentas 'particular' y de los clubes viejos (§3.1): no es un borde
    // teórico, es una población entera.
    let creados = 0;
    const f = setup(
      { list: async () => COACHES },
      {
        roles: async () => [{ id: '3', name: 'admin' }],
        create: async () => {
          creados++;
        },
      },
    );
    expect(await f.crear(INPUT)).toBe(false);
    expect(creados).toBe(0);
    expect(f.error()).toEqual({
      kind: 'domain',
      message:
        'Tu cuenta no tiene configurado el rol de profesor. Sólo las cuentas de club pueden dar de alta profesores.',
    });
  });

  it('el error de la ESCRITURA gana sobre el de la relectura', async () => {
    const f = setup(
      {
        list: async () => {
          throw new Error('la relectura también falló');
        },
      },
      {
        roles: async () => ROLES,
        create: async () => {
          throw new HttpErrorResponse({
            status: 409,
            error: { statusCode: 409, message: 'Ya existe un usuario con ese email' },
          });
        },
      },
    );
    await f.crear(INPUT);
    expect(f.error()).toEqual({ kind: 'domain', message: 'Ya existe un usuario con ese email' });
  });

  it('deja loading en false al terminar, pase lo que pase', async () => {
    const f = setup(
      { list: async () => COACHES },
      {
        roles: async () => {
          throw new Error('boom');
        },
        create: async () => undefined,
      },
    );
    await f.crear(INPUT);
    expect(f.loading()).toBe(false);
  });
});
