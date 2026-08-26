import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpClassSessionsRepository } from './http-class-sessions.repository';
import { ApiClient } from '../http/api-client';

interface Call { readonly method: string; readonly path: string; readonly body?: unknown }

function setup(responses: Partial<Record<'get' | 'post' | 'delete', Observable<unknown>>> = {}) {
  const calls: Call[] = [];
  const api = {
    get: (path: string) => { calls.push({ method: 'get', path }); return responses.get ?? of([]); },
    post: (path: string, body: unknown) => { calls.push({ method: 'post', path, body }); return responses.post ?? of({}); },
    delete: (path: string, body: unknown) => { calls.push({ method: 'delete', path, body }); return responses.delete ?? of({}); },
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HttpClassSessionsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject(HttpClassSessionsRepository), calls };
}

const session = (over: Record<string, unknown> = {}) => ({
  id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
  startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1, ...over,
});

describe('HttpClassSessionsRepository.list', () => {
  it('pide un día de más de cada lado', async () => {
    // `ClassSessionsService.list()` arma la ventana con new Date(`${from}T00:00:00Z`): la Z es
    // LITERAL, así que interpreta en UTC. Pidiendo sólo 2026-08-19 desde Argentina (UTC-3) se
    // pierden las clases de 21:00 a 23:59, que en UTC ya son del día 20.
    const { repo, calls } = setup();
    await repo.list('2026-08-19');
    expect(calls[0].path).toBe('/class-sessions?from=2026-08-18&to=2026-08-20');
  });

  it('cruza el fin de mes sin romperse', async () => {
    const { repo, calls } = setup();
    await repo.list('2026-08-31');
    expect(calls[0].path).toBe('/class-sessions?from=2026-08-30&to=2026-09-01');
  });

  it('filtra por fecha LOCAL y descarta lo que quedó fuera del día pedido', async () => {
    // El test-setup fija TZ=America/Argentina/Buenos_Aires (UTC-3): 01:00Z del 20 son las 22:00
    // locales del 19 — cruza la línea del día UTC a propósito. Si el filtro comparara por día
    // UTC en vez de local (el bug que esta tarea arregla), esta sesión quedaría afuera.
    const dentro = session({ id: 'dentro', startAt: '2026-08-20T01:00:00.000Z' });
    const fuera = session({ id: 'fuera', startAt: '2026-08-20T21:00:00.000Z' });
    const sinHora = session({ id: 'sin-hora', startAt: null });
    const { repo } = setup({ get: of([dentro, fuera, sinHora]) });
    const sessions = await repo.list('2026-08-19');
    expect(sessions.map((s) => s.id)).toEqual(['dentro']);
  });

  it('rechaza con un DomainError de validación si el payload deriva', async () => {
    const { repo } = setup({ get: of([{ id: 10 }]) });
    await expect(repo.list('2026-08-19')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpClassSessionsRepository — lista de espera', () => {
  it('lee las anotaciones de una sesión', async () => {
    const raw = [{ id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' }];
    const { repo, calls } = setup({ get: of(raw) });
    expect(await repo.waitingList('10')).toEqual([
      { id: '77', studentId: '4', requestedAt: '2026-08-19T10:00:00.000Z' },
    ]);
    expect(calls[0].path).toBe('/class-sessions/10/waiting-list');
  });

  it('anota a un alumno', async () => {
    const { repo, calls } = setup();
    await repo.joinWaitingList('10', '4');
    expect(calls[0]).toMatchObject({
      method: 'post',
      path: '/class-sessions/10/waiting-list',
      body: { studentId: '4' },
    });
  });

  it('da de baja una anotación por SU id, no por el del alumno', async () => {
    const { repo, calls } = setup();
    await repo.leaveWaitingList('77');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/waiting-list/77' });
  });

  it('propaga el mensaje del backend cuando el alumno ya estaba anotado', async () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { message: 'El alumno ya está en la lista de espera de esta clase' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.joinWaitingList('10', '4')).rejects.toEqual({
      kind: 'domain',
      message: 'El alumno ya está en la lista de espera de esta clase',
    });
  });
});

const reserva = (over: Record<string, unknown> = {}) => ({
  id: '55', studentId: '4', studentPlanId: '9', holdExpiresAt: null, deletedAt: null,
  reservationStatus: { name: 'confirmed' }, ...over,
});

describe('HttpClassSessionsRepository.reservations', () => {
  it('pega al endpoint por sesión', async () => {
    const { repo, calls } = setup();
    await repo.reservations('10');
    expect(calls[0]).toEqual({ method: 'get', path: '/class-sessions/10/reservations' });
  });

  it('aplana el estado embebido y conserva el hold', async () => {
    const held = reserva({ id: '56', holdExpiresAt: '2026-08-19T21:30:00.000Z',
                           reservationStatus: { name: 'held' } });
    const { repo } = setup({ get: of([held]) });
    expect(await repo.reservations('10')).toEqual([
      { id: '56', studentId: '4', studentPlanId: '9', status: 'held',
        holdExpiresAt: '2026-08-19T21:30:00.000Z' },
    ]);
  });

  it('descarta las borradas: el backend no filtra deletedAt', async () => {
    const viva = reserva({ id: 'viva' });
    const borrada = reserva({ id: 'borrada', deletedAt: '2026-08-19T10:00:00.000Z' });
    const { repo } = setup({ get: of([viva, borrada]) });
    expect((await repo.reservations('10')).map((r) => r.id)).toEqual(['viva']);
  });

  it('acepta studentPlanId nulo: una clase cobrada no gasta créditos', async () => {
    const { repo } = setup({ get: of([reserva({ studentPlanId: null })]) });
    expect((await repo.reservations('10'))[0].studentPlanId).toBeNull();
  });

  it('normaliza un 404 a DomainError', async () => {
    const { repo } = setup({
      get: throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    });
    await expect(repo.reservations('10')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('HttpClassSessionsRepository.cancel', () => {
  it('pega DELETE a la clase con notify y motivo', async () => {
    const { repo, calls } = setup();
    await repo.cancel('10', { notify: true, reason: 'Se llovió' });
    expect(calls).toEqual([
      { method: 'delete', path: '/class-sessions/10', body: { notify: true, reason: 'Se llovió' } },
    ]);
  });

  it('OMITE reason cuando es null', async () => {
    // CancelClassSessionDto lo valida con @ValidateIf(o => o.notify === true) y el
    // ValidationPipe corre en whitelist: mandarlo en null es un 400.
    const { repo, calls } = setup();
    await repo.cancel('10', { notify: false, reason: null });
    expect(calls[0].body).toEqual({ notify: false });
  });

  it('NUNCA manda offerToWaitingList', async () => {
    // El endpoint lo acepta, pero ofrecería el lugar liberado al primero de la lista de espera
    // DE LA CLASE QUE SE ACABA DE CANCELAR. CancelDayDto lo omite a propósito del lado del
    // backend; al individual se le escapó.
    const { repo, calls } = setup();
    await repo.cancel('10', { notify: true, reason: 'x' });
    expect(calls[0].body).not.toHaveProperty('offerToWaitingList');
  });

  it('normaliza un 404 a DomainError', async () => {
    const { repo } = setup({
      delete: throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    });
    await expect(repo.cancel('10', { notify: false, reason: null }))
      .rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('HttpClassSessionsRepository.cancelDay', () => {
  it('manda la fecha como QUERY, no en el path', async () => {
    // El backend declara DELETE /class-sessions/day con @Query(), y esa ruta va ANTES de
    // @Delete(':id') justo para que "day" no se enrute como un id.
    const { repo, calls } = setup();
    await repo.cancelDay('2026-08-26', { notify: false, reason: null });
    expect(calls[0].path).toBe('/class-sessions/day?date=2026-08-26');
  });

  it('manda la fecha LOCAL tal cual, sin el ±1 día que necesita la lectura', async () => {
    // cancelDay() arma su ventana en -03:00; list() la arma en UTC. Sólo la lectura compensa.
    const { repo, calls } = setup();
    await repo.cancelDay('2026-08-26', { notify: true, reason: 'Paro de transporte' });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ notify: true, reason: 'Paro de transporte' });
  });
});
