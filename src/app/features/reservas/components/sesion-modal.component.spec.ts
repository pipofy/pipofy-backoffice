import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection} from '@angular/core';
import { SesionModalComponent } from './sesion-modal.component';
import { SesionFacade } from '../sesion.facade';
import { ReservasFacade } from '../reservas.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { ClassSession } from '@domain/entities/class-session';
import { Student } from '@domain/entities/student';
import { StudentPlan } from '@domain/entities/student-plan';
import { Plan } from '@domain/entities/plan';
import { ReservationDraft } from '@domain/entities/reservation';
import { SessionReservation } from '@domain/entities/session-reservation';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';

const session: ClassSession = {
  id: '10', courtId: '2', coachId: '5', categoryGroupId: '3',
  startAt: '2026-08-19T21:00:00.000Z', capacity: 4, availableSpots: 1,
};

const student: Student = {
  id: '4', phone: '1155667788', firstName: 'Bruno', lastName: 'Torres',
  birthDate: null, categoryId: '3', studentStatusId: '2',
  dominantHand: null, ranking: null, notes: null,
};

const studentPlan: StudentPlan = {
  id: '9', planId: 'p1', purchasedAt: null, creditsTotal: 8, creditsRemaining: 8, expiresAt: null,
};

const plan: Plan = {
  id: 'p1', name: 'Mensual x8', planTypeId: 't1', coachId: null, classCount: 8,
  price: null, validityDays: null, active: true,
};

const HOLD_VIVO = new Date(Date.now() + 30 * 60_000).toISOString();

/** Id que el doble le pone a la reserva que crea. La API real no lo devuelve: sale del GET. */
const RESERVA_CREADA_ID = '55';

const CATALOGS_DOUBLE = {
  paymentMethods: async () => [{ id: '3', name: 'efectivo' }],
} as unknown as CatalogsRepository;

function mount(
  over: { holdExpiresAt?: string } = {},
  rows: readonly SessionReservation[] = [],
) {
  const calls: string[] = [];
  // Estado mutable y compartido con el doble de ClassSessionsRepository de abajo: desde la
  // Tarea 3, SesionFacade relee `reservations()` (un GET) después de cada escritura en vez de
  // guardar el hold en memoria. Un doble que devolviera siempre `rows` sin tocar no reflejaría
  // el hold recién creado ni su cambio de estado — la API real sí lo hace.
  let state: SessionReservation[] = [...rows];
  const reservations = {
    reserve: async (draft: ReservationDraft) => {
      calls.push('reserve');
      state = [...state, {
        id: RESERVA_CREADA_ID, studentId: draft.studentId, studentPlanId: draft.studentPlanId,
        status: 'held', holdExpiresAt: over.holdExpiresAt ?? HOLD_VIVO,
      }];
    },
    confirm: async (id: string) => {
      calls.push('confirm');
      state = state.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r));
    },
    cancel: async (id: string) => {
      calls.push('cancel');
      state = state.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r));
    },
    confirmPayment: async (id: string) => {
      calls.push('confirmPayment');
      state = state.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r));
    },
  } as ReservationsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      SesionFacade,
      { provide: CatalogsRepository, useValue: CATALOGS_DOUBLE },
      ReservasFacade,
      { provide: ClassSessionsRepository, useValue: {
          list: async () => [session], waitingList: async () => [],
          reservations: async () => [...state],
          joinWaitingList: async () => undefined, leaveWaitingList: async () => undefined,
          cancel: async () => undefined, cancelDay: async () => undefined,
        } as ClassSessionsRepository },
      { provide: ReservationsRepository, useValue: reservations },
      { provide: StudentsRepository, useValue: {
          list: async () => [student], plans: async () => [studentPlan],
          create: async () => undefined, update: async () => undefined, remove: async () => undefined,
          purchasePlan: async () => undefined,
        } as StudentsRepository },
      { provide: PlansRepository, useValue: {
          list: async () => [plan],
          create: async () => undefined, update: async () => undefined, remove: async () => undefined,
          addCategory: async () => undefined,
          removeCategory: async () => undefined,
        } as PlansRepository },
    ],
  });

  const fixture = TestBed.createComponent(SesionModalComponent);
  fixture.componentRef.setInput('students', [student]);
  fixture.componentRef.setInput('labels', () => 'Cancha 2 · 18:00 · 3ra');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, calls };
}

/**
 * El tick de macrotask NO es de adorno: onStudent() y el catálogo de planes resuelven con
 * cadenas de promesas, y whenStable() solo no siempre las alcanza. Mismo helper que usan
 * reservas-page.component.spec.ts y grupos-categoria-page.component.spec.ts.
 */
async function settle(fixture: ComponentFixture<SesionModalComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

/** Abre el modal en la sesión de prueba y deja asentada la carga de la lista de espera. */
async function abrir(fixture: ComponentFixture<SesionModalComponent>): Promise<void> {
  fixture.componentInstance.open(session);
  await settle(fixture);
}

/** Elige el alumno y su plan usable, esperando a que se resuelva GET /students/:id/plans. */
async function elegirAlumnoYPlan(fixture: ComponentFixture<SesionModalComponent>, el: HTMLElement): Promise<void> {
  const alumno = el.querySelector<HTMLSelectElement>('#res-alumno')!;
  alumno.value = student.id;
  alumno.dispatchEvent(new Event('change'));
  fixture.detectChanges();
  await settle(fixture);

  const planSelect = el.querySelector<HTMLSelectElement>('#res-plan')!;
  planSelect.value = studentPlan.id;
  planSelect.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function boton(el: HTMLElement, texto: string): HTMLButtonElement {
  const hit = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
  if (!hit) throw new Error(`No se encontró el botón "${texto}"`);
  return hit;
}

describe('SesionModalComponent', () => {
  it('dos clicks seguidos en Reservar producen UNA sola llamada a reservar', async () => {
    // Regresión directa del CRITICAL: class-sessions.service.ts no chequea si el alumno ya
    // tiene una reserva en esta sesión y no hay índice único (classSessionId, studentId), así
    // que dos reservar() en vuelo son dos holds reales del mismo alumno.
    //
    // SIN detectChanges() entre los dos clicks, a propósito: es el escenario real (dos Enter en
    // el mismo macrotask). Con un detectChanges() en el medio el [disabled] ya reflejaría
    // facade.loading() y jsdom descartaría el segundo click ANTES de correr el handler,
    // haciendo pasar el test aunque se borrara el guard en código — que es justo el freno que
    // NO alcanza (ver AttendanceModalComponent, mismo argumento).
    const { fixture, el, calls } = mount();
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);

    const btn = boton(el, 'Reservar');
    btn.click();
    btn.click();

    await settle(fixture);
    expect(calls.filter((c) => c === 'reserve')).toHaveLength(1);
  });

  it('limpia alumno y plan después de un reservar() exitoso', async () => {
    const { fixture, el } = mount();
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);

    boton(el, 'Reservar').click();
    await settle(fixture);

    expect(el.querySelector<HTMLSelectElement>('#res-alumno')!.value).toBe('');
    expect(el.querySelector<HTMLSelectElement>('#res-plan')!.value).toBe('');
  });

  it('el botón Reservar está deshabilitado sin alumno o sin plan', async () => {
    const { fixture, el } = mount();
    await abrir(fixture);

    expect(boton(el, 'Reservar').disabled).toBe(true);

    const alumno = el.querySelector<HTMLSelectElement>('#res-alumno')!;
    alumno.value = student.id;
    alumno.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle(fixture);
    expect(boton(el, 'Reservar').disabled).toBe(true); // alumno sí, plan todavía no

    const planSelect = el.querySelector<HTMLSelectElement>('#res-plan')!;
    planSelect.value = studentPlan.id;
    planSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(boton(el, 'Reservar').disabled).toBe(false);
  });

  it('el select de plan muestra el nombre del plan, no sólo los créditos', async () => {
    const { fixture, el } = mount();
    await abrir(fixture);

    const alumno = el.querySelector<HTMLSelectElement>('#res-alumno')!;
    alumno.value = student.id;
    alumno.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle(fixture);

    const opcion = el.querySelector<HTMLOptionElement>(`#res-plan option[value="${studentPlan.id}"]`)!;
    expect(opcion.textContent).toContain('Mensual x8');
    expect(opcion.textContent).toContain('8 créditos');
  });

  it('un hold vencido muestra "Venció" y deshabilita Confirmar', async () => {
    const vencido = new Date(Date.now() - 60 * 60_000).toISOString(); // hace 1 hora
    const { fixture, el } = mount({ holdExpiresAt: vencido });
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);

    boton(el, 'Reservar').click();
    await settle(fixture);

    expect(seccion(el, 'Pendientes de confirmar')).toContain('Venció');
    expect(boton(el, 'Confirmar').disabled).toBe(true);
  });

  it('dos clicks seguidos en Confirmar producen UNA sola llamada a confirm', async () => {
    // El mismo freno que Reservar, pero acá el daño de no tenerlo es menor (409 del backend):
    // igual se prueba en código, no sólo con el [disabled] del template.
    const { fixture, el, calls } = mount();
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);

    boton(el, 'Reservar').click();
    await settle(fixture);

    const btn = boton(el, 'Confirmar');
    btn.click();
    btn.click();

    await settle(fixture);
    expect(calls.filter((c) => c === 'confirm')).toHaveLength(1);
  });
});

describe('SesionModalComponent · cobrar', () => {
  /** Deja un hold vivo en pantalla: reservar es el único camino por el que el modal lo ve. */
  async function conHold() {
    const { fixture, el, calls } = mount();
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);
    boton(el, 'Reservar').click();
    await settle(fixture);
    return { fixture, el, calls };
  }

  it('Cobrar despliega el formulario con los medios de pago', async () => {
    const { fixture, el } = await conHold();
    expect(el.querySelector('[data-test="cobro-form"]')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-test="cobrar"]')!.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-test="cobro-form"]')).not.toBeNull();
    const opciones = Array.from(el.querySelectorAll('[data-test="cobro-form"] option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Elegí un medio…', 'Efectivo']);
  });

  it('un segundo click en Cobrar vuelve a cerrar la fila', async () => {
    const { fixture, el } = await conHold();
    const cobrar = el.querySelector<HTMLButtonElement>('[data-test="cobrar"]')!;
    cobrar.click();
    fixture.detectChanges();
    cobrar.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-test="cobro-form"]')).toBeNull();
  });

  it('cobra sin gastar crédito y cierra la fila', async () => {
    const { fixture, el, calls } = await conHold();
    el.querySelector<HTMLButtonElement>('[data-test="cobrar"]')!.click();
    fixture.detectChanges();

    const monto = el.querySelector<HTMLInputElement>('[data-test="cobro-form"] input')!;
    monto.value = '12000';
    monto.dispatchEvent(new Event('input'));
    const medio = el.querySelector<HTMLSelectElement>('[data-test="cobro-form"] select')!;
    medio.value = '3';
    medio.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('[data-test="cobro-confirmar"]')!.click();
    await settle(fixture);

    // confirmPayment y NO confirm: son las dos salidas del hold y ésta no toca los créditos.
    expect(calls).toContain('confirmPayment');
    expect(calls).not.toContain('confirm');
    expect(el.querySelector('[data-test="cobro-form"]')).toBeNull();
    // El hold se descarta igual que al confirmar: la reserva quedó en 'confirmed'.
    expect(el.textContent).toContain('Ninguna reserva pendiente');
  });

  it('sin medio de pago NO sale a la red y deja el error a la vista', async () => {
    const { fixture, el, calls } = await conHold();
    el.querySelector<HTMLButtonElement>('[data-test="cobrar"]')!.click();
    fixture.detectChanges();

    const monto = el.querySelector<HTMLInputElement>('[data-test="cobro-form"] input')!;
    monto.value = '12000';
    monto.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('[data-test="cobro-confirmar"]')!.click();
    await settle(fixture);

    expect(calls).not.toContain('confirmPayment');
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Elegí un medio de pago');
    // La fila sigue abierta con el monto tipeado: es donde se corrige.
    expect(el.querySelector<HTMLInputElement>('[data-test="cobro-form"] input')!.value).toBe('12000');
  });
});

const VENCE_EN_30 = new Date(Date.now() + 30 * 60_000).toISOString();
const VENCIDO_HACE_5 = new Date(Date.now() - 5 * 60_000).toISOString();

/** Texto de la sección que arranca en el <h4> con ese título y termina en el siguiente <h4>. */
function seccion(el: HTMLElement, titulo: string): string {
  const nodos = Array.from(el.querySelectorAll('h4, .arow, .a-empty'));
  const desde = nodos.findIndex((n) => n.tagName === 'H4' && n.textContent?.trim() === titulo);
  if (desde === -1) throw new Error(`No se encontró la sección "${titulo}"`);
  const resto = nodos.slice(desde + 1);
  const hasta = resto.findIndex((n) => n.tagName === 'H4');
  return (hasta === -1 ? resto : resto.slice(0, hasta)).map((n) => n.textContent ?? '').join(' ');
}

describe('SesionModalComponent · Anotados', () => {
  it('una reserva confirmada va a Anotados y NO a Pendientes', async () => {
    const { fixture, el } = mount({}, [
      { id: '56', studentId: '4', studentPlanId: '9', status: 'confirmed', holdExpiresAt: null },
    ]);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).toContain('Bruno');
    expect(seccion(el, 'Pendientes de confirmar')).not.toContain('Bruno');
  });

  it('confirmar mueve la fila de "Pendientes de confirmar" a sólo "Anotados"', async () => {
    // El comportamiento central de la entrega: SesionFacade relee el roster después de
    // confirmar, y el doble de arriba muta su estado igual que la API real. Antes de
    // confirmar el hold vigente aparece en las DOS secciones (ver el test de abajo); después
    // de confirmar, la reserva pasa a 'confirmed' y sale de "Pendientes" sin dejar de estar en
    // "Anotados".
    const { fixture, el } = mount();
    await abrir(fixture);
    await elegirAlumnoYPlan(fixture, el);
    boton(el, 'Reservar').click();
    await settle(fixture);

    expect(seccion(el, 'Pendientes de confirmar')).toContain('Bruno');
    expect(seccion(el, 'Anotados')).toContain('Bruno');

    boton(el, 'Confirmar').click();
    await settle(fixture);

    expect(seccion(el, 'Pendientes de confirmar')).not.toContain('Bruno');
    expect(seccion(el, 'Anotados')).toContain('Bruno');
  });

  it('un hold vigente aparece en las DOS secciones', async () => {
    const { fixture, el } = mount({}, [
      { id: '55', studentId: '4', studentPlanId: '9', status: 'held',
        holdExpiresAt: VENCE_EN_30 },
    ]);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).toContain('Bruno');
    expect(seccion(el, 'Pendientes de confirmar')).toContain('min para que venza');
  });

  it('un hold VENCIDO sale de Anotados pero sigue en Pendientes con la marca', async () => {
    // No ocupa cupo: el backend no lo cuenta en countOccupiedSpots. Mostrarlo entre los
    // anotados diría que el lugar está tomado.
    const { fixture, el } = mount({}, [
      { id: '55', studentId: '4', studentPlanId: '9', status: 'held',
        holdExpiresAt: VENCIDO_HACE_5 },
    ]);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).not.toContain('Bruno');
    expect(seccion(el, 'Pendientes de confirmar')).toContain('Venció');
  });

  it('una cancelada no aparece en ninguna de las dos', async () => {
    const { fixture, el } = mount({}, [
      { id: '57', studentId: '4', studentPlanId: null, status: 'cancelled', holdExpiresAt: null },
    ]);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).not.toContain('Bruno');
    expect(seccion(el, 'Pendientes de confirmar')).not.toContain('Bruno');
  });

  it('una pending_review (WhatsApp sin plan) va a Anotados con "En revisión" y NO a Pendientes', async () => {
    // pending_review no ocupa cupo para el backend (no la cuenta countOccupiedSpots), pero es
    // un alumno real anotado por WhatsApp sin plan: dejarla afuera de las dos secciones la
    // haría invisible en el panel. holdExpiresAt: null a propósito — no expira por el mecanismo
    // de hold normal — así que no puede ir a "Pendientes", que muestra cuenta regresiva.
    const { fixture, el } = mount({}, [
      { id: '58', studentId: '4', studentPlanId: null, status: 'pending_review',
        holdExpiresAt: null },
    ]);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).toContain('Bruno');
    expect(seccion(el, 'Anotados')).toContain('En revisión');
    expect(seccion(el, 'Pendientes de confirmar')).not.toContain('Bruno');
  });

  it('sin reservas, las dos secciones muestran su vacío', async () => {
    const { fixture, el } = mount({}, []);
    await abrir(fixture);
    expect(seccion(el, 'Anotados')).toContain('Todavía no se anotó nadie');
    expect(seccion(el, 'Pendientes de confirmar')).toContain('Ninguna reserva pendiente');
  });
});
