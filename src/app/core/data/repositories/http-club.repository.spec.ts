import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClubRepository } from './http-club.repository';
import { API_CONFIG } from '@config/api-config';

const CLUB_JSON = {
  id: '1',
  tenantId: '1',
  name: 'Club Central',
  phone: '1155667788',
  address: 'Av. Siempreviva 742',
  usesLeveling: true,
  holdMinutes: 30,
  transferAlias: 'club.central.mp',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('HttpClubRepository', () => {
  let repo: HttpClubRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '/rt' } },
        HttpClubRepository,
      ],
    });
    repo = TestBed.inject(HttpClubRepository);
    http = TestBed.inject(HttpTestingController);
  });

  it('get() pega a /clubs/me y descarta las claves que no declara el DTO', async () => {
    const p = repo.get();
    http.expectOne({ method: 'GET', url: '/api/clubs/me' }).flush(CLUB_JSON);
    const club = await p;
    expect(club.name).toBe('Club Central');
    expect(club.active).toBe(true);
    expect('tenantId' in club).toBe(false);
  });

  it('update() manda PATCH a /clubs/me con los seis campos', async () => {
    const p = repo.update({
      name: 'Nuevo', phone: null, address: null,
      usesLeveling: false, holdMinutes: 45, transferAlias: null,
    });
    const req = http.expectOne({ method: 'PATCH', url: '/api/clubs/me' });
    expect(req.request.body).toEqual({
      name: 'Nuevo', phone: null, address: null,
      usesLeveling: false, holdMinutes: 45, transferAlias: null,
    });
    req.flush({});
    await p;
  });

  it('isActive() NO depende del argumento: el club sale del token (§3.9)', async () => {
    const p = repo.isActive('cualquier-cosa');
    http.expectOne({ method: 'GET', url: '/api/clubs/me' }).flush(CLUB_JSON);
    expect(await p).toBe(true);
  });

  it('isActive() devuelve false cuando el club está borrado', async () => {
    const p = repo.isActive('1');
    http.expectOne({ method: 'GET', url: '/api/clubs/me' })
      .flush({ ...CLUB_JSON, deletedAt: '2026-01-01T00:00:00.000Z' });
    expect(await p).toBe(false);
  });

  it('isActive() FALLA ABIERTO: un 403 no significa "club inactivo"', async () => {
    // §8.5 punto 3: RefreshDashboard corre isActive ANTES del snapshot, y la página del
    // dashboard es una cadena @if/@else. Si un 403 devolviera false, un rol sin permiso
    // sobre /clubs/me se quedaría sin dashboard entero.
    const p = repo.isActive('1');
    http.expectOne({ method: 'GET', url: '/api/clubs/me' })
      .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(await p).toBe(true);
  });

  it('get() SÍ propaga el error como DomainError', async () => {
    const p = repo.get();
    http.expectOne({ method: 'GET', url: '/api/clubs/me' })
      .flush({ message: 'nope' }, { status: 403, statusText: 'Forbidden' });
    await expect(p).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
