import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpSchedulesRepository } from './http-schedules.repository';
import { API_CONFIG } from '../config/api-config.token';

const ROW = {
  id: '1', clubId: '1', courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
  weekday: 1,
  startTime: '1970-01-01T18:00:00.000Z',
  endTime: '1970-01-01T19:30:00.000Z',
  capacity: 8, price: '12000', active: true,
  validFrom: null, validTo: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('HttpSchedulesRepository', () => {
  let repo: HttpSchedulesRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '/rt' } },
        HttpSchedulesRepository,
      ],
    });
    repo = TestBed.inject(HttpSchedulesRepository);
    http = TestBed.inject(HttpTestingController);
  });

  it('list() pega a /schedules y mapea', async () => {
    const p = repo.list();
    http.expectOne({ method: 'GET', url: '/api/schedules' }).flush([ROW]);
    const rows = await p;
    expect(rows).toHaveLength(1);
    expect(rows[0].startTime).toBe('18:00');
  });

  it('create() manda POST con el body parseado', async () => {
    const p = repo.create({
      courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
      weekday: 1, startTime: '18:00', endTime: '19:30',
      capacity: 8, price: '12000', active: true, validFrom: null, validTo: null,
    });
    const req = http.expectOne({ method: 'POST', url: '/api/schedules' });
    expect(req.request.body.weekday).toBe(1);
    expect('validFrom' in req.request.body).toBe(false);
    req.flush({});
    await p;
  });

  it('update() manda PATCH a /schedules/:id', async () => {
    const p = repo.update('7', {
      courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
      weekday: 1, startTime: '18:00', endTime: '19:30',
      capacity: null, price: null, active: false, validFrom: null, validTo: null,
    });
    const req = http.expectOne({ method: 'PATCH', url: '/api/schedules/7' });
    expect(req.request.body.capacity).toBeNull();
    req.flush({});
    await p;
  });

  it('remove() manda DELETE', async () => {
    const p = repo.remove('7');
    http.expectOne({ method: 'DELETE', url: '/api/schedules/7' }).flush({});
    await p;
  });

  it('generateSessions() manda el rango y PARSEA las dos cifras', async () => {
    const p = repo.generateSessions({ from: '2026-08-03', to: '2026-08-30' });
    const req = http.expectOne({ method: 'POST', url: '/api/schedules/generate-sessions' });
    expect(req.request.body).toEqual({ from: '2026-08-03', to: '2026-08-30' });
    req.flush({ created: 12, skipped: 3 });
    expect(await p).toEqual({ created: 12, skipped: 3 });
  });

  it('generateSessions() con una respuesta inesperada tira en vez de mostrar undefined', async () => {
    // Las dos cifras se MUESTRAN en el toast: un {created: undefined} silencioso terminaría
    // como "undefined clases creadas".
    const p = repo.generateSessions({ from: '2026-08-03', to: '2026-08-30' });
    http.expectOne({ method: 'POST', url: '/api/schedules/generate-sessions' }).flush({ ok: true });
    await expect(p).rejects.toMatchObject({ kind: 'validation' });
  });

  it('el 409 de solapamiento sale como domain con el texto del backend (§3.5)', async () => {
    const p = repo.create({
      courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
      weekday: 1, startTime: '18:00', endTime: '19:30',
      capacity: null, price: null, active: true, validFrom: null, validTo: null,
    });
    http.expectOne({ method: 'POST', url: '/api/schedules' }).flush(
      { statusCode: 409, message: 'Ya existe un horario que se superpone en esa cancha y día' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(p).rejects.toMatchObject({
      kind: 'domain',
      message: 'Ya existe un horario que se superpone en esa cancha y día',
    });
  });
});
