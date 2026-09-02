import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SesionFacade } from './sesion.facade';
import { ReservasFacade } from './reservas.facade';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { SessionReservation } from '@domain/entities/session-reservation';
import { ReservationDraft } from '@domain/entities/reservation';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { SessionAttendanceResult } from '@domain/entities/session-attendance';

const entry: WaitingListEntry = { id: '77', studentId: '4', requestedAt: null };
const input = { sessionId: '10', studentId: '4', studentPlanId: '9' };

const CATALOGS_DOUBLE = {
  paymentMethods: async () => [{ id: '3', name: 'efectivo' }],
} as unknown as CatalogsRepository;

function setup(
  over: Partial<ReservationsRepository> = {},
  rows: readonly SessionReservation[] = [],
  // Parámetros propios y no un Partial<ClassSessionsRepository>: un override entero perdería el
  // calls.push() del doble, que es justo lo que fija "relee sólo en el parcial".
  asistencia: () => Promise<SessionAttendanceResult[]> = async () => [],
  relecturaFalla = false,
) {
  const calls: string[] = [];
  // Estado mutable y compartido entre los dos dobles, igual que en
  // sesion-modal.component.spec.ts: SesionFacade relee `reservations()` (un GET) después de
  // cada escritura en vez de guardar el hold en memoria, así que un doble que devolviera
  // siempre `rows` sin tocar no podría probar que confirmar()/cancelar() sacan la fila de
  // holdsOf() — la API real sí lo hace.
  let state: SessionReservation[] = [...rows];
  const sessions = {
    list: async () => {
      calls.push('sessions.list');
      return [];
    },
    waitingList: async () => {
      calls.push('waitingList');
      return [entry];
    },
    reservations: async () => {
      calls.push('reservations');
      if (relecturaFalla) throw new Error('la relectura también falló');
      return [...state];
    },
    joinWaitingList: async () => {
      calls.push('join');
    },
    leaveWaitingList: async () => {
      calls.push('leave');
    },
    cancel: async () => undefined,
    cancelDay: async () => undefined,
    markAttendance: async () => {
      calls.push('markAttendance');
      return asistencia();
    },
  } as ClassSessionsRepository;

  const reservations = {
    reserve: async (draft: ReservationDraft) => {
      calls.push('reserve');
      state = [
        ...state,
        {
          id: '55',
          studentId: draft.studentId,
          studentPlanId: draft.studentPlanId,
          status: 'held',
          holdExpiresAt: null,
        },
      ];
    },
    confirm: async (id: string) => {
      calls.push('confirm');
      state = state.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r));
    },
    cancel: async (id: string) => {
      calls.push('cancel');
      state = state.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r));
    },
    ...over,
  } as ReservationsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      SesionFacade,
      { provide: CatalogsRepository, useValue: CATALOGS_DOUBLE },
      ReservasFacade,
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: ReservationsRepository, useValue: reservations },
    ],
  });
  return { facade: TestBed.inject(SesionFacade), calls };
}

describe('SesionFacade', () => {
  it('open() carga la lista de espera', async () => {
    const { facade } = setup();
    await facade.open('10');
    expect(facade.data()).toEqual([entry]);
  });

  it('reservar() sin plan NO llama al repo y deja el error de dominio', async () => {
    const { facade, calls } = setup();
    await facade.reservar('10', { ...input, studentPlanId: '' });
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({
      kind: 'domain',
      message: 'Elegí un plan con créditos: sin plan la reserva no se puede confirmar.',
    });
  });

  it('reservar() toma el hold Y relee sesiones y roster', async () => {
    // Cobertura que se había perdido al borrar 'reservar() deja el hold en pendientes y
    // refresca las sesiones': esa aserción era la única que probaba que reservar() relee la
    // grilla, no sólo el roster. reservas.load() y loadReservations() van en Promise.all, pero
    // el orden es determinista igual: los dos arrancan síncronamente (antes del primer await)
    // al construirse el array, en el orden en que aparecen ahí.
    const { facade, calls } = setup();
    await facade.reservar('10', input);
    expect(calls).toEqual(['reserve', 'sessions.list', 'reservations']);
  });

  it('cancelar() refresca las sesiones, las reservas Y la lista de espera', async () => {
    // offerNext() NO crea un hold nuevo: marca la anotación del primero de la lista como
    // 'notificado' con vencimiento a 15 minutos y le manda un WhatsApp; recién si el alumno
    // acepta por ahí toma el lugar (ver el docblock de cancelar() en sesion.facade.ts). La
    // anotación cambió de estado igual, así que sin este refresco la lista de espera se ve
    // desactualizada aunque el usuario no haya tocado ese bloque.
    const { facade, calls } = setup();
    await facade.reservar('10', input);
    calls.length = 0;
    await facade.cancelar('10', '55');
    expect(calls).toEqual(['cancel', 'sessions.list', 'reservations', 'waitingList']);
  });

  it('anotar() y quitar() releen la lista de espera', async () => {
    const { facade, calls } = setup();
    await facade.anotar('10', '4');
    expect(calls).toEqual(['join', 'waitingList']);
    calls.length = 0;
    await facade.quitar('10', '77');
    expect(calls).toEqual(['leave', 'waitingList']);
  });

  it('un fallo al confirmar deja el error y NO rechaza', async () => {
    const { facade } = setup({
      confirm: () => Promise.reject({ kind: 'domain' as const, message: 'El hold expiró' }),
    });
    await facade.confirmar('10', '55');
    expect(facade.error()).toEqual({ kind: 'domain', message: 'El hold expiró' });
  });
});

const HOLD_VIVO = {
  id: '55',
  studentId: '4',
  studentPlanId: '9',
  status: 'held',
  holdExpiresAt: '2099-01-01T00:00:00.000Z',
} as const;
const CONFIRMADA = {
  id: '56',
  studentId: '7',
  studentPlanId: '9',
  status: 'confirmed',
  holdExpiresAt: null,
} as const;
const CANCELADA = {
  id: '57',
  studentId: '8',
  studentPlanId: null,
  status: 'cancelled',
  holdExpiresAt: null,
} as const;

describe('SesionFacade · roster desde la API', () => {
  it('open() carga las reservas además de la lista de espera', async () => {
    const { facade, calls } = setup({}, [HOLD_VIVO, CONFIRMADA]);
    await facade.open('10');
    expect(calls).toContain('reservations');
    expect(facade.reservationsOf('10').map((r) => r.id)).toEqual(['55', '56']);
  });

  it('holdsOf() devuelve sólo los held, no las confirmadas ni las canceladas', async () => {
    const { facade } = setup({}, [HOLD_VIVO, CONFIRMADA, CANCELADA]);
    await facade.open('10');
    expect(facade.holdsOf('10').map((r) => r.id)).toEqual(['55']);
  });

  it('confirmar() saca el hold de pendientes', async () => {
    const { facade } = setup({}, [HOLD_VIVO]);
    await facade.open('10');
    expect(facade.holdsOf('10').map((r) => r.id)).toEqual(['55']);

    await facade.confirmar('10', '55');
    expect(facade.holdsOf('10')).toEqual([]);
  });

  it('cancelar() también saca el hold de pendientes', async () => {
    const { facade } = setup({}, [HOLD_VIVO]);
    await facade.open('10');
    expect(facade.holdsOf('10')).toHaveLength(1);

    await facade.cancelar('10', '55');
    expect(facade.holdsOf('10')).toEqual([]);
  });

  it('no devuelve las reservas de OTRA sesión', async () => {
    // El signal guarda una sola clase. Sin esta guarda, abrir la clase B mostraría el roster
    // de la A hasta que resolviera el GET — el mismo bug que arreglamos en el modal de planes.
    const { facade } = setup({}, [HOLD_VIVO]);
    await facade.open('10');
    expect(facade.reservationsOf('99')).toEqual([]);
  });

  it('los holds sobreviven a una facade nueva: salen de la API, no de memoria', async () => {
    // La regresión que justifica toda la tarea: antes el Map en memoria se perdía con un F5.
    const primera = setup({}, [HOLD_VIVO]);
    await primera.facade.open('10');
    expect(primera.facade.holdsOf('10')).toHaveLength(1);

    TestBed.resetTestingModule();
    const segunda = setup({}, [HOLD_VIVO]);
    await segunda.facade.open('10');
    expect(segunda.facade.holdsOf('10')).toHaveLength(1);
  });

  it('relee las reservas después de reservar, confirmar, cobrar y cancelar', async () => {
    const { facade, calls } = setup({ confirmPayment: async () => undefined }, []);
    await facade.open('10');
    const base = calls.filter((c) => c === 'reservations').length;

    await facade.reservar('10', input);
    await facade.confirmar('10', '55');
    await facade.cobrar('10', '55', { paymentMethodId: '3', amount: '1000' });
    await facade.cancelar('10', '55');

    expect(calls.filter((c) => c === 'reservations')).toHaveLength(base + 4);
  });
});

describe('SesionFacade.tomarAsistencia', () => {
  const MARCAS = [{ reservationId: '55', status: 'asistio' as const }];
  const OK = { reservationId: '55', ok: true, status: 'asistio' as const, error: null };
  const FALLO = {
    reservationId: '55',
    ok: false,
    status: null,
    error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
  };

  it('devuelve el resultado por ítem y NO relee: la asistencia no cambia el roster', async () => {
    // AttendanceService escribe la tabla `attendance` y nada más: la reserva sigue confirmed,
    // el cupo no cambia, la lista de espera no cambia. Releer sería un GET al pedo que
    // devolvería exactamente lo que ya está en pantalla.
    const { facade, calls } = setup({}, [], async () => [OK]);
    expect(await facade.tomarAsistencia('10', MARCAS)).toEqual([OK]);
    expect(calls).toEqual(['markAttendance']);
  });

  it('con un fallo per-ítem SÍ relee: la fila muerta tiene que salir de la planilla', async () => {
    // El fallo más probable es que la reserva haya dejado de estar `confirmed` entre la carga
    // del roster y el Guardar. Ésa no va a entrar nunca, por más que se reintente.
    const { facade, calls } = setup({}, [], async () => [FALLO]);
    expect(await facade.tomarAsistencia('10', MARCAS)).toEqual([FALLO]);
    expect(calls).toEqual(['markAttendance', 'reservations']);
  });

  it('si la relectura del parcial falla, NO pisa el resultado ni ensucia error()', async () => {
    // La relectura es una comodidad, no la operación: su fallo es de segundo orden y taparía el
    // bloque de fallidos, que es el que cuenta el problema real.
    const { facade } = setup({}, [], async () => [FALLO], true);
    const res = await facade.tomarAsistencia('10', MARCAS);
    expect(res).toEqual([FALLO]);
    expect(facade.error()).toBeNull();
  });

  it('devuelve null y deja el error cuando falla el POST ENTERO', async () => {
    const { facade } = setup({}, [], async () => {
      throw { kind: 'forbidden' };
    });
    expect(await facade.tomarAsistencia('10', MARCAS)).toBeNull();
    expect(facade.error()).toEqual({ kind: 'forbidden' });
  });

  it('sin marcas NO llama al repo y deja el error de dominio', async () => {
    const { facade, calls } = setup();
    expect(await facade.tomarAsistencia('10', [])).toBeNull();
    expect(calls).toEqual([]);
    expect(facade.error()).toEqual({
      kind: 'domain',
      message: 'Marcá al menos un alumno antes de guardar.',
    });
  });

  it('deja loading en false al terminar, pase lo que pase', async () => {
    const { facade } = setup({}, [], async () => {
      throw new Error('boom');
    });
    await facade.tomarAsistencia('10', MARCAS);
    expect(facade.loading()).toBe(false);
  });
});
