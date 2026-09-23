import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClubFacade } from './club.facade';
import { ClubRepository } from '@domain/contracts/club.repository';
import { Club, ClubDraft, ClubInput } from '@domain/entities/club';

const CLUB: Club = {
  id: '1', name: 'Club Central', phone: '1155667788', address: 'Siempreviva 742',
  usesLeveling: true, holdMinutes: 30, transferAlias: 'alias.mp', active: true,
};

const INPUT: ClubInput = {
  name: 'Club Central', phone: '1155667788', address: 'Siempreviva 742',
  usesLeveling: true, holdMinutes: '30', transferAlias: 'alias.mp',
};

function setup(repo: Partial<ClubRepository>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ClubRepository, useValue: repo },
      ClubFacade,
    ],
  });
  return TestBed.inject(ClubFacade);
}

describe('ClubFacade', () => {
  it('load() deja el club en data()', async () => {
    const f = setup({ get: async () => CLUB });
    await f.load();
    expect(f.data()).toEqual(CLUB);
    expect(f.error()).toBeNull();
  });

  it('load() que falla deja data() en null y el error normalizado', async () => {
    const f = setup({ get: async () => { throw { kind: 'network' }; } });
    await f.load();
    expect(f.data()).toBeNull();
    expect(f.error()).toEqual({ kind: 'network' });
  });

  it('save() actualiza y RELEE, para que data() quede con lo que el servidor guardó', async () => {
    const enviados: ClubDraft[] = [];
    let leidas = 0;
    const f = setup({
      update: async (d) => { enviados.push(d); },
      get: async () => { leidas++; return CLUB; },
    });
    await f.save(INPUT);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].holdMinutes).toBe(30);
    expect(leidas).toBe(1);
    expect(f.data()).toEqual(CLUB);
  });

  it('save() con holdMinutes inválido no llama al repo y normaliza la invariante', async () => {
    // createClubDraft tira de forma SÍNCRONA; va dentro de la promesa para que
    // run()/asDomainError la normalicen igual que un fallo del repo.
    let llamado = false;
    const f = setup({ update: async () => { llamado = true; }, get: async () => CLUB });
    await f.save({ ...INPUT, holdMinutes: '' });
    expect(llamado).toBe(false);
    expect(f.error()).toEqual({ kind: 'domain', message: expect.stringMatching(/minutos de reserva/i) });
  });

  it('clearError() limpia el error sin tocar data()', async () => {
    const f = setup({ get: async () => { throw { kind: 'network' }; } });
    await f.load();
    f.clearError();
    expect(f.error()).toBeNull();
  });
});
