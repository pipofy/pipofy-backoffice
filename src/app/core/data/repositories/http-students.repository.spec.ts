import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { HttpStudentsRepository } from './http-students.repository';
import { ApiClient } from '../http/api-client';
import { StudentDraft } from '@domain/entities/student';

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
      HttpStudentsRepository,
      { provide: ApiClient, useValue: api },
    ],
  });
  return { repo: TestBed.inject<HttpStudentsRepository>(HttpStudentsRepository), calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03T00:00:00.000Z', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: 12, notes: null, deletedAt: null, ...over,
});

const draft: StudentDraft = {
  phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: null, categoryId: null, studentStatusId: null,
  dominantHand: null, ranking: null, notes: null,
};

describe('HttpStudentsRepository.list', () => {
  it('pide /students y mapea a entidades', async () => {
    const { repo, calls } = setup({ get: of([row()]) });
    const students = await repo.list();
    expect(students[0]).toMatchObject({ id: '1', phone: '1155667788', birthDate: '2001-05-03' });
    expect(calls[0]).toMatchObject({ method: 'get', path: '/students' });
  });

  it('descarta las filas con deletedAt', async () => {
    const { repo } = setup({ get: of([row(), row({ id: '2', deletedAt: '2026-07-30T12:00:00.000Z' })]) });
    expect((await repo.list()).map((s: { id: string }) => s.id)).toEqual(['1']);
  });

  it('conserva studentStatusId: la columna Estado y su select lo necesitan', async () => {
    // Antes se descartaba porque no existía GET /catalogs/student-statuses y el id crudo no
    // se podía traducir. Ahora el catálogo existe y el estado se muestra Y se edita.
    const { repo } = setup({ get: of([row({ studentStatusId: '3' })]) });
    expect((await repo.list())[0].studentStatusId).toBe('3');
  });

  it('un payload que deriva sale como DomainError de validación', async () => {
    const { repo } = setup({ get: of([{ id: 1 }]) });
    await expect(repo.list()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpStudentsRepository escrituras', () => {
  it('create no manda categoryId ni birthDate cuando son null', async () => {
    const { repo, calls } = setup();
    await repo.create(draft);
    const body = calls[0].body as object;
    expect('categoryId' in body).toBe(false);
    expect('birthDate' in body).toBe(false);
  });

  it('update usa PATCH, no PUT', async () => {
    const { repo, calls } = setup();
    await repo.update('7', draft);
    expect(calls[0]).toMatchObject({ method: 'patch', path: '/students/7' });
  });

  it('remove pega DELETE al alumno', async () => {
    const { repo, calls } = setup();
    await repo.remove('7');
    expect(calls[0]).toMatchObject({ method: 'delete', path: '/students/7' });
  });

  it('un teléfono duplicado llega como error de dominio con el copy del backend', async () => {
    // @@unique([clubId, phone]) → P2002 → ConflictException 409 (§3.7).
    const err = new HttpErrorResponse({
      status: 409,
      error: { statusCode: 409, message: 'Ya existe un alumno con ese teléfono en este club' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(repo.create(draft))
      .rejects.toEqual({ kind: 'domain', message: 'Ya existe un alumno con ese teléfono en este club' });
  });
});

const planRow = (over: Record<string, unknown> = {}) => ({
  id: '1', studentId: '7', planId: '10',
  purchasedAt: '2026-08-01T14:00:00.000Z',
  creditsTotal: 8, creditsRemaining: 5,
  expiresAt: '2026-09-01T00:00:00.000Z',
  studentPlanStatusId: '1', deletedAt: null, ...over,
});

describe('HttpStudentsRepository.plans', () => {
  it('pide los planes del alumno y recorta las fechas a yyyy-MM-dd', async () => {
    const { repo, calls } = setup({ get: of([planRow()]) });
    const plans = await repo.plans('7');
    expect(calls[0]).toMatchObject({ method: 'get', path: '/students/7/plans' });
    expect(plans[0]).toEqual({
      id: '1', planId: '10', purchasedAt: '2026-08-01',
      creditsTotal: 8, creditsRemaining: 5, expiresAt: '2026-09-01',
    });
  });

  // Mismo motivo que en list(): student-plans.service.ts:88 no filtra deletedAt.
  it('descarta los planes borrados', async () => {
    const { repo } = setup({
      get: of([planRow(), planRow({ id: '2', deletedAt: '2026-08-10T00:00:00.000Z' })]),
    });
    expect((await repo.plans('7')).map((p) => p.id)).toEqual(['1']);
  });

  it('un plan sin vencimiento ni créditos llega con nulls, no rompe', async () => {
    const { repo } = setup({
      get: of([planRow({ expiresAt: null, creditsTotal: null, creditsRemaining: null, purchasedAt: null })]),
    });
    expect((await repo.plans('7'))[0]).toMatchObject({
      expiresAt: null, creditsTotal: null, creditsRemaining: null, purchasedAt: null,
    });
  });

  it('ignora studentPlanStatusId, que no tiene catálogo para traducirse', async () => {
    const { repo } = setup({ get: of([planRow()]) });
    expect(Object.keys((await repo.plans('7'))[0])).not.toContain('studentPlanStatusId');
  });

  it('un payload que deriva sale como DomainError de validación', async () => {
    const { repo } = setup({ get: of([{ id: 1 }]) });
    await expect(repo.plans('7')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('HttpStudentsRepository.purchasePlan', () => {
  it('postea plan, medio y monto a /students/:id/plans', async () => {
    const { repo, calls } = setup();
    await repo.purchasePlan('7', { planId: '10', paymentMethodId: '2', amount: '96000' });
    expect(calls[0]).toEqual({
      method: 'post',
      path: '/students/7/plans',
      body: { planId: '10', paymentMethodId: '2', amount: '96000' },
    });
  });

  // El ValidationPipe del backend corre con forbidNonWhitelisted: una clave de más es un 400.
  it('no manda claves de más', async () => {
    const { repo, calls } = setup();
    await repo.purchasePlan('7', { planId: '10', paymentMethodId: '2', amount: '96000' });
    expect(Object.keys(calls[0].body as object).sort())
      .toEqual(['amount', 'paymentMethodId', 'planId']);
  });

  it('propaga el mensaje del backend cuando el plan está inactivo', async () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'planId inválido: no existe, es de otro club, o está inactivo' },
    });
    const { repo } = setup({ post: throwError(() => err) });
    await expect(
      repo.purchasePlan('7', { planId: '10', paymentMethodId: '2', amount: '1' }),
    ).rejects.toEqual({
      kind: 'domain',
      message: 'planId inválido: no existe, es de otro club, o está inactivo',
    });
  });
});
