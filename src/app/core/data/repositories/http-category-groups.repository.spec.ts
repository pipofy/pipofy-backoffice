import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { HttpCategoryGroupsRepository } from './http-category-groups.repository';
import { ApiClient } from '../http/api-client';
import { API_CONFIG } from '../config/api-config.token';

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
      HttpCategoryGroupsRepository,
      { provide: ApiClient, useValue: api },
      // El repo también inyecta HttpClient/API_CONFIG para addItem/removeItem (ver más abajo):
      // el field initializer corre siempre, aunque estos tests sólo ejerciten el ApiClient.
      { provide: HttpClient, useValue: {} as HttpClient },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
    ],
  });
  return { repo: TestBed.inject(HttpCategoryGroupsRepository), calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: '1', name: 'Principiantes', ...over,
});

describe('HttpCategoryGroupsRepository.list', () => {
  it('pide /category-groups y mapea a entidades', async () => {
    const { repo, calls } = setup({ get: of([row()]) });
    expect(await repo.list()).toEqual([{ id: '1', name: 'Principiantes' }]);
    expect(calls[0]).toMatchObject({ method: 'get', path: '/category-groups' });
  });

  it('ignora las claves que el backend manda de más', async () => {
    // Prisma devuelve la fila cruda: clubId, createdAt y updatedAt vienen y se descartan.
    const { repo } = setup({ get: of([row({ clubId: '9', createdAt: 'x', updatedAt: 'y' })]) });
    expect(await repo.list()).toEqual([{ id: '1', name: 'Principiantes' }]);
  });

  it('un payload que deriva sale como DomainError de validación', async () => {
    const { repo } = setup({ get: of([{ id: 1 }]) });   // id numérico: la API los manda string
    await expect(repo.list()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpCategoryGroupsRepository escrituras', () => {
  it('create manda POST con sólo el nombre', async () => {
    const { repo, calls } = setup();
    await repo.create({ name: 'Avanzados' });
    expect(calls[0]).toMatchObject({ method: 'post', path: '/category-groups' });
    expect(Object.keys(calls[0].body as object)).toEqual(['name']);
  });

  it('update usa PATCH, no PUT', async () => {
    const { repo, calls } = setup();
    await repo.update('7', { name: 'Avanzados' });
    expect(calls[0]).toMatchObject({ method: 'patch', path: '/category-groups/7' });
  });

  it('remove pega DELETE al grupo', async () => {
    const { repo, calls } = setup();
    await repo.remove('7');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/category-groups/7' });
  });

  it('propaga el mensaje del backend en un 400', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, message: 'name debe ser un string' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.create({ name: 'X' }))
      .rejects.toEqual({ kind: 'domain', message: 'name debe ser un string' });
  });
});

interface HttpCall { readonly method: string; readonly url: string; readonly body?: unknown }

function setupItems(fail?: HttpErrorResponse) {
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
      HttpCategoryGroupsRepository,
      { provide: ApiClient, useValue: {} as ApiClient },
      { provide: HttpClient, useValue: http },
      { provide: API_CONFIG, useValue: { apiBaseUrl: '/api', realtimeBaseUrl: '' } },
    ],
  });
  return { repo: TestBed.inject(HttpCategoryGroupsRepository), calls };
}

describe('HttpCategoryGroupsRepository.addItem', () => {
  it('postea la categoría al grupo', async () => {
    const { repo, calls } = setupItems();
    await repo.addItem('7', '3');
    expect(calls[0]).toEqual({
      method: 'post',
      url: '/api/category-groups/7/items',
      body: { categoryId: '3' },
    });
  });

  it('un 409 NO lanza: la categoría ya estaba, el estado final es el pedido', async () => {
    // Es la pieza que sostiene todo el modal: sin poder LEER la asignación, la única forma
    // de que la vista se autocorrija es que "ya estaba" cuente como éxito.
    const { repo } = setupItems(new HttpErrorResponse({ status: 409 }));
    await expect(repo.addItem('7', '3')).resolves.toBeUndefined();
  });

  it('un 400 sí lanza, con el mensaje del backend', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'categoryId inválido: no pertenece a este club' },
    });
    const { repo } = setupItems(err);
    await expect(repo.addItem('7', '3')).rejects.toEqual({
      kind: 'domain',
      message: 'categoryId inválido: no pertenece a este club',
    });
  });
});

describe('HttpCategoryGroupsRepository.removeItem', () => {
  it('borra la categoría del grupo', async () => {
    const { repo, calls } = setupItems();
    await repo.removeItem('7', '3');
    expect(calls[0]).toEqual({ method: 'delete', url: '/api/category-groups/7/items/3' });
  });

  it('un 404 NO lanza: la categoría no estaba, el estado final es el pedido', async () => {
    const { repo } = setupItems(new HttpErrorResponse({ status: 404 }));
    await expect(repo.removeItem('7', '3')).resolves.toBeUndefined();
  });

  it('un 403 sí lanza', async () => {
    const { repo } = setupItems(new HttpErrorResponse({ status: 403 }));
    await expect(repo.removeItem('7', '3')).rejects.toEqual({ kind: 'forbidden' });
  });
});
