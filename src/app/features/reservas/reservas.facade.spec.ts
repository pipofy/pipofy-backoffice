import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReservasFacade } from './reservas.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ClassSession } from '@domain/entities/class-session';

const late: ClassSession = {
  id: 'tarde',
  courtId: '1',
  coachId: '1',
  categoryGroupId: '1',
  startAt: '2026-08-19T22:00:00.000Z',
  capacity: 4,
  availableSpots: 0,
};
const early: ClassSession = { ...late, id: 'temprano', startAt: '2026-08-19T18:00:00.000Z' };

function setup(over: Partial<ClassSessionsRepository> = {}) {
  const dates: string[] = [];
  const repo = {
    list: async (dateKey: string) => {
      dates.push(dateKey);
      return [late, early];
    },
    waitingList: async () => [],
    reservations: async () => [],
    joinWaitingList: async () => undefined,
    leaveWaitingList: async () => undefined,
    cancel: async () => undefined,
    cancelDay: async () => undefined,
    ...over,
  } as ClassSessionsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ReservasFacade,
      { provide: ClassSessionsRepository, useValue: repo },
    ],
  });
  return { facade: TestBed.inject(ReservasFacade), dates };
}

describe('ReservasFacade', () => {
  it('arranca en la fecha de HOY en hora local', () => {
    // Con toISOString() esto se rompe todas las noches después de las 21:00 en Argentina.
    const { facade } = setup();
    const hoy = new Date();
    const esperado = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    expect(facade.date()).toBe(esperado);
  });

  it('load() pide la fecha seleccionada y ordena por hora', () => {
    // El backend no ordena: class-sessions.service.list() no tiene ORDER BY.
    const { facade } = setup();
    return facade.load().then(() => {
      expect(facade.sorted().map((s) => s.id)).toEqual(['temprano', 'tarde']);
    });
  });

  it('setDate() cambia la fecha y recarga', async () => {
    const { facade, dates } = setup();
    await facade.setDate('2026-09-01');
    expect(facade.date()).toBe('2026-09-01');
    expect(dates.at(-1)).toBe('2026-09-01');
  });

  it('un fallo del repo se normaliza y NO rechaza', async () => {
    const { facade } = setup({ list: () => Promise.reject({ kind: 'forbidden' as const }) });
    await facade.load();
    expect(facade.error()).toEqual({ kind: 'forbidden' });
    expect(facade.data()).toBeNull();
  });
});

describe('ReservasFacade · cancelar', () => {
  it('cancela la clase y DESPUÉS re-lee la lista', async () => {
    // La cancelación mueve el cupo (todas sus reservas pasan a 'cancelled') y eso lo calcula
    // el backend: parchear en memoria mostraría el cupo viejo.
    const orden: string[] = [];
    const { facade } = setup({
      cancel: async () => { orden.push('cancel'); },
      list: async () => { orden.push('list'); return [late]; },
    });
    await facade.load();
    await facade.cancelarClase('tarde', { reason: 'Se llovió', notify: true });
    expect(orden).toEqual(['list', 'cancel', 'list']);
    expect(facade.error()).toBeNull();
  });

  it('marca la clase como cancelada para que la fila deje de verse normal', async () => {
    const { facade } = setup();
    await facade.cancelarClase('tarde', { reason: '', notify: false });
    expect(facade.cancelled().has('tarde')).toBe(true);
    expect(facade.cancelled().has('temprano')).toBe(false);
  });

  it('pedir aviso sin motivo deja error de dominio y NO llama al repo', async () => {
    let llamado = false;
    const { facade } = setup({ cancel: async () => { llamado = true; } });
    await facade.cancelarClase('tarde', { reason: '   ', notify: true });
    expect(llamado).toBe(false);
    expect(facade.error()).toMatchObject({ kind: 'domain' });
    expect(facade.cancelled().size).toBe(0);
  });

  it('un fallo del repo NO marca la clase como cancelada', async () => {
    const { facade } = setup({ cancel: () => Promise.reject({ kind: 'forbidden' as const }) });
    await facade.cancelarClase('tarde', { reason: '', notify: false });
    expect(facade.error()).toEqual({ kind: 'forbidden' });
    expect(facade.cancelled().size).toBe(0);
  });

  it('cancelar el día marca TODAS las clases de la fecha', async () => {
    // cancelDay() cancela todas las 'programada', y ningún flujo del backend escribe
    // 'completada': lo que no estaba cancelado, quedó.
    const { facade } = setup();
    await facade.load();
    await facade.cancelarDia({ reason: 'Paro', notify: true });
    expect([...facade.cancelled()].sort()).toEqual(['tarde', 'temprano']);
  });

  it('cancelar el día manda la fecha de la facade', async () => {
    const fechas: string[] = [];
    const { facade } = setup({ cancelDay: async (dateKey: string) => { fechas.push(dateKey); } });
    await facade.setDate('2026-09-01');
    await facade.cancelarDia({ reason: '', notify: false });
    expect(fechas).toEqual(['2026-09-01']);
  });

  it('reset() limpia las canceladas: son estado propio de la facade', async () => {
    const { facade } = setup();
    await facade.cancelarClase('tarde', { reason: '', notify: false });
    facade.reset();
    expect(facade.cancelled().size).toBe(0);
  });
});
