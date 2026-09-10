import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpCoachesRepository } from './http-coaches.repository';
import { API_CONFIG } from '../config/api-config.token';

const row = (over: Record<string, unknown> = {}) => ({
  id: '5', description: null,
  user: { nombre: 'Juan', apellido: 'Gómez', email: 'juan@club.com' }, ...over,
});

describe('HttpCoachesRepository', () => {
  let repo: HttpCoachesRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '/rt' } },
        HttpCoachesRepository,
      ],
    });
    repo = TestBed.inject(HttpCoachesRepository);
    http = TestBed.inject(HttpTestingController);
  });

  describe('list', () => {
    it('pide /coaches y mapea a entidades', async () => {
      const p = repo.list();
      http.expectOne({ method: 'GET', url: '/api/coaches' }).flush([row()]);
      expect(await p).toEqual([{ id: '5', displayName: 'Juan Gómez', description: null }]);
    });

    it('ignora userId y clubId, que el backend manda de más', async () => {
      const p = repo.list();
      http.expectOne({ method: 'GET', url: '/api/coaches' }).flush([row({ userId: '2', clubId: '9' })]);
      expect(Object.keys((await p)[0]).sort()).toEqual(['description', 'displayName', 'id']);
    });

    it('un payload que deriva sale como DomainError de validación', async () => {
      const p = repo.list();
      http.expectOne({ method: 'GET', url: '/api/coaches' }).flush([{ id: 5 }]);
      await expect(p).rejects.toMatchObject({ kind: 'validation' });
    });
  });

  describe('update', () => {
    it('update() manda PATCH a /coaches/:id con sólo la descripción', async () => {
      const p = repo.update('7', { description: 'Especialista en revés' });
      const req = http.expectOne({ method: 'PATCH', url: '/api/coaches/7' });
      expect(req.request.body).toEqual({ description: 'Especialista en revés' });
      req.flush({});
      await p;
    });

    it('update() con null vacía la descripción', async () => {
      const p = repo.update('7', { description: null });
      const req = http.expectOne({ method: 'PATCH', url: '/api/coaches/7' });
      expect(req.request.body).toEqual({ description: null });
      req.flush({});
      await p;
    });
  });
});
