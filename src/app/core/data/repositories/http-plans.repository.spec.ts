import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { HttpPlansRepository } from './http-plans.repository';
import { ApiClient } from '../http/api-client';
import { API_CONFIG } from '../config/api-config.token';
import { PlanDraft } from '@domain/entities/plan';

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
      HttpPlansRepository,
      { provide: ApiClient, useValue: api },
      { provide: HttpClient, useValue: {} as HttpClient },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
    ],
  });
  return { repo: TestBed.inject(HttpPlansRepository), calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: 8, price: '12000.5', validityDays: 30, active: true, deletedAt: null, ...over,
});

const draft: PlanDraft = {
  name: 'Mensual 8', planTypeId: '2', coachId: null,
  classCount: 8, price: '12000.5', validityDays: 30, active: true,
};

describe('HttpPlansRepository.list', () => {
  it('pide /plans y mapea a entidades', async () => {
    const { repo, calls } = setup({ get: of([row()]) });
    const plans = await repo.list();
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5' });
    expect(calls[0]).toMatchObject({ method: 'get', path: '/plans' });
  });

  it('descarta las filas con deletedAt', async () => {
    const { repo } = setup({ get: of([row(), row({ id: '2', deletedAt: '2026-07-30T12:00:00.000Z' })]) });
    expect((await repo.list()).map((p) => p.id)).toEqual(['1']);
  });

  it('acepta el precio como número sin romper el parseo', async () => {
    const { repo } = setup({ get: of([row({ price: 12000.5 })]) });
    expect((await repo.list())[0].price).toBe('12000.5');
  });

  it('un payload que deriva sale como DomainError de validación', async () => {
    const { repo } = setup({ get: of([{ id: 1 }]) });
    await expect(repo.list()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpPlansRepository escrituras', () => {
  it('create no manda coachId cuando el plan no tiene profesor', async () => {
    // Mandarlo en null hace que el backend ejecute BigInt(null) y devuelva 500 (§3.2).
    const { repo, calls } = setup();
    await repo.create(draft);
    expect('coachId' in (calls[0].body as object)).toBe(false);
  });

  it('update usa PATCH, no PUT', async () => {
    const { repo, calls } = setup();
    await repo.update('7', draft);
    expect(calls[0]).toMatchObject({ method: 'patch', path: '/plans/7' });
  });

  it('remove pega DELETE al plan', async () => {
    const { repo, calls } = setup();
    await repo.remove('7');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/plans/7' });
  });

  it('propaga el mensaje del backend en un 400', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, message: 'coachId inválido: no pertenece a este club' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.create({ ...draft, coachId: '99' }))
      .rejects.toEqual({ kind: 'domain', message: 'coachId inválido: no pertenece a este club' });
  });
});

interface HttpCall { readonly method: string; readonly url: string; readonly body?: unknown }

/** Setup aparte: addCategory/removeCategory usan HttpClient directo, no ApiClient. */
function setupCategories(fail?: HttpErrorResponse) {
  const calls: HttpCall[] = [];
  const http = {
    post: (url: string, body: unknown) => {
      calls.push({ method: 'post', url, body });
      return fail ? throwError(() => fail) : of({});
    },
    delete: (url: string) => {
      calls.push({ method: 'delete', url });
      return fail ? throwError(() => fail) : of({});
    },
  } as unknown as HttpClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpPlansRepository,
      { provide: ApiClient, useValue: {} as ApiClient },
      { provide: HttpClient, useValue: http },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
    ],
  });
  return { repo: TestBed.inject(HttpPlansRepository), calls };
}

describe('HttpPlansRepository.addCategory', () => {
  it('postea la categoría al plan', async () => {
    const { repo, calls } = setupCategories();
    await repo.addCategory('7', '3');
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/api/plans/7/categories',
      body: { categoryId: '3' },
    });
  });

  it('un 409 NO lanza: la categoría ya estaba, el estado final es el pedido', async () => {
    // Es la pieza que sostiene todo el modal: sin poder LEER la asignación, la única forma de
    // que la vista se autocorrija es que "ya estaba" cuente como éxito.
    const { repo } = setupCategories(new HttpErrorResponse({ status: 409 }));
    await expect(repo.addCategory('7', '3')).resolves.toBeUndefined();
  });

  it('un 400 sí lanza, con el mensaje del backend', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'categoryId inválido: no pertenece a este club' },
    });
    const { repo } = setupCategories(err);
    await expect(repo.addCategory('7', '3')).rejects.toEqual({
      kind: 'domain',
      message: 'categoryId inválido: no pertenece a este club',
    });
  });
});

describe('HttpPlansRepository.removeCategory', () => {
  it('borra la categoría del plan', async () => {
    const { repo, calls } = setupCategories();
    await repo.removeCategory('7', '3');
    expect(calls[0]).toEqual({ method: 'delete', url: '/api/plans/7/categories/3' });
  });

  it('un 404 NO lanza: la categoría no estaba, el estado final es el pedido', async () => {
    const { repo } = setupCategories(new HttpErrorResponse({ status: 404 }));
    await expect(repo.removeCategory('7', '3')).resolves.toBeUndefined();
  });

  it('un 403 sí lanza', async () => {
    const { repo } = setupCategories(new HttpErrorResponse({ status: 403 }));
    await expect(repo.removeCategory('7', '3')).rejects.toEqual({ kind: 'forbidden' });
  });
});
