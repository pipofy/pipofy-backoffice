import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { GruposFacade } from './grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { InMemoryGroupsRepository } from '@data/repositories/in-memory-groups.repository';
import { TenantContext } from '@shared/tenant/tenant-context';
import { GroupNotFoundError } from '@domain/errors';

/** Fixture de test: no es la constante de producción que se borró (era un club inventado). */
const CLUB_ID = 'c1';

function setup(repo: GroupsRepository = new InMemoryGroupsRepository(0), tenant?: unknown) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GruposFacade,
      { provide: GroupsRepository, useValue: repo },
      ...(tenant ? [{ provide: TenantContext, useValue: tenant }] : []),
    ],
  });
  return TestBed.inject(GruposFacade);
}

describe('GruposFacade', () => {
  it('load() puebla data() y groups()', async () => {
    const facade = setup();
    await facade.load(CLUB_ID);
    expect(facade.data()?.groups).toHaveLength(6);
    expect(facade.groups()).toHaveLength(6);
    expect(facade.error()).toBeNull();
  });

  it('groups() es un array vacío antes de cargar', () => {
    expect(setup().groups()).toEqual([]);
  });

  it('un fallo del repo se normaliza a DomainError y NO rechaza', async () => {
    const facade = setup({
      getGroups: () => Promise.reject({ kind: 'network' as const }),
      saveAttendance: () => Promise.reject(new Error('no')),
    });
    await facade.load(CLUB_ID);            // run() atrapa todo: no rechaza
    expect(facade.error()).toEqual({ kind: 'network' });
    expect(facade.data()).toBeNull();
  });

  it('saveAttendance() actualiza data() SIN tocar loading() ni error()', async () => {
    const facade = setup();
    await facade.load(CLUB_ID);
    await facade.saveAttendance(CLUB_ID, {
      groupId: '1', sessionId: '1-s2', discountAbsences: true,
      marks: ['1-r1', '1-r2', '1-r3', '1-r4'].map((memberId) => ({ memberId, present: true })),
    });
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.data()!.groups.find((g) => g.id === '1')!.roster[0].credits).toBe(5);
  });

  it('saveAttendance() PROPAGA el error en vez de tragárselo', async () => {
    // Si usara run(), atraparía el error y la página nunca entraría al catch: saldría el toast
    // de ÉXITO tras un fallo. La página necesita que esto rechace.
    const facade = setup();
    await facade.load(CLUB_ID);
    await expect(facade.saveAttendance(CLUB_ID, {
      groupId: '99', sessionId: 'x', marks: [], discountAbsences: true,
    })).rejects.toThrow(GroupNotFoundError);
    expect(facade.error()).toBeNull();     // la pantalla NO se reemplaza por el estado de error
  });

  it('resetea al CAMBIAR de tenant, pero NO en el primer disparo del effect', async () => {
    const tenantId = signal('t1');
    const facade = setup(new InMemoryGroupsRepository(0), { tenantId });
    await facade.load(CLUB_ID);
    TestBed.tick();
    expect(facade.data()).not.toBeNull();   // el primer run del effect NO pisó lo recién cargado

    tenantId.set('t2');
    TestBed.tick();
    expect(facade.data()).toBeNull();
  });
});
