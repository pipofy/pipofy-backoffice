import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { HttpCourtsRepository } from './http-courts.repository';
import { ApiClient } from '../http/api-client';

interface Call { readonly method: string; readonly path: string; readonly body?: unknown }

function setup(responses: Partial<Record<'get' | 'post' | 'patch' | 'delete', Observable<unknown>>> = {}) {
  const calls: Call[] = [];
  const api = {
    get: (path: string) => { calls.push({ method: 'get', path }); return responses.get ?? of([]); },
    post: (path: string, body: unknown) => { calls.push({ method: 'post', path, body }); return responses.post ?? of({}); },
    patch: (path: string, body: unknown) => { calls.push({ method: 'patch', path, body }); return responses.patch ?? of({}); },
    delete: (path: string) => { calls.push({ method: 'delete', path }); return responses.delete ?? of({}); },
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpCourtsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(HttpCourtsRepository), calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: '1', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3',
  indoor: true, courtStatusId: '1', ...over,
});

describe('HttpCourtsRepository.list', () => {
  it('pide /courts y mapea a entidades', async () => {
    const { repo, calls } = setup({ get: of([row()]) });
    expect(await repo.list()).toEqual([{
      id: '1', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
    }]);
    expect(calls[0]).toMatchObject({ method: 'get', path: '/courts' });
  });

  it('rechaza con un DomainError de validación si el payload deriva', async () => {
    const { repo } = setup({ get: of([{ id: 1 }]) });   // id numérico: la API los manda string
    await expect(repo.list()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpCourtsRepository.create', () => {
  it('manda sólo los campos del DTO del backend', async () => {
    // forbidNonWhitelisted: true (§4.4) → cualquier campo de más devuelve 400.
    const { repo, calls } = setup();
    await repo.create({ name: 'Cancha 3', code: null, surfaceTypeId: '3', indoor: false, courtStatusId: '1' });
    const body = calls[0].body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['code', 'courtStatusId', 'indoor', 'name', 'surfaceTypeId']);
    expect('id' in body).toBe(false);
    expect('clubId' in body).toBe(false);
  });

  it('propaga el mensaje del backend en un 400', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, message: 'surfaceTypeId inválido: no existe' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.create({
      name: 'X', code: null, surfaceTypeId: '99', indoor: false, courtStatusId: null,
    })).rejects.toEqual({ kind: 'domain', message: 'surfaceTypeId inválido: no existe' });
  });
});

describe('HttpCourtsRepository.update y remove', () => {
  it('update usa PATCH, no PUT', async () => {
    // Todos los updates del backend son @Patch(':id').
    const { repo, calls } = setup();
    await repo.update('7', { name: 'Cancha 7', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null });
    expect(calls[0]).toMatchObject({ method: 'patch', path: '/courts/7' });
  });

  it('remove pega DELETE a la cancha', async () => {
    const { repo, calls } = setup();
    await repo.remove('7');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/courts/7' });
  });
});
