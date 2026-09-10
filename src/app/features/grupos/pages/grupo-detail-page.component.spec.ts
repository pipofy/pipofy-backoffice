import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { GrupoDetailPageComponent } from './grupo-detail-page.component';
import { GruposFacade } from '../grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Group, GroupSession } from '@domain/entities/group';
import { SessionReservation } from '@domain/entities/session-reservation';
import { InvalidAttendanceError } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';

const flushRepo = () => new Promise((r) => setTimeout(r, 0));

const sesion = (over: Partial<GroupSession> = {}): GroupSession => ({
  id: '301', startAt: '2026-09-07T21:00:00.000Z', courtName: 'Cancha 1',
  status: 'programada', enrolled: 2, capacity: 4, waiting: 1, yaPaso: true, ...over,
});

const grupo = (over: Partial<Group> = {}): Group => ({
  id: '7', category: '7ma+8va', teacher: 'Diego A.', courtName: 'Cancha 1',
  weekday: 1, startTime: '18:00', capacity: 4, enrolled: 2, waiting: 1,
  nextSessionId: '301', sessions: [sesion()], ...over,
});

const reserva = (over: Partial<SessionReservation> = {}): SessionReservation => ({
  id: '500', studentId: '88', studentPlanId: null, status: 'confirmed',
  holdExpiresAt: null, attendanceStatus: null, studentName: 'Lucía Pereyra',
  studentCategoryId: '3', ...over,
});

interface Opciones {
  readonly id?: string;
  readonly groups?: Group[];
  readonly listGroupsFalla?: boolean;
  readonly reservations?: SessionReservation[];
  /** El resultado POR ÍTEM que devuelve markBulk. Por defecto, todo ok. */
  readonly resultados?: { reservationId: string; ok: boolean; status: 'asistio' | 'ausente' | null; error: string | null }[];
  readonly guardarFalla?: boolean;
}

/**
 * La facade es la REAL y los dobles son los repositorios: así el test recorre la cadena
 * completa —effect → loadDetalle → reservations(nextSessionId)— en vez de verificar un doble
 * de la facade que devolvería lo que se le pida.
 */
function setup(o: Opciones = {}) {
  const calls: string[] = [];

  const groups = {
    listGroups: async () => {
      calls.push('listGroups');
      if (o.listGroupsFalla) return Promise.reject({ kind: 'network' as const });
      return o.groups ?? [grupo()];
    },
  } as unknown as GroupsRepository;

  const sessions = {
    reservations: async (id: string) => {
      calls.push(`reservations:${id}`);
      return o.reservations ?? [reserva()];
    },
    waitingList: async (id: string) => {
      calls.push(`waitingList:${id}`);
      return [{ id: 'w1', studentId: '91', requestedAt: '2026-09-01T12:00:00.000Z' }];
    },
    markAttendance: async (id: string) => {
      calls.push(`markAttendance:${id}`);
      if (o.guardarFalla) throw new InvalidAttendanceError('Marcá al menos un alumno antes de guardar.');
      return o.resultados ?? [{ reservationId: '500', ok: true, status: 'asistio' as const, error: null }];
    },
  } as unknown as ClassSessionsRepository;

  const categories = {
    list: async () => [{ id: '3', name: '7ma', levelOrder: 7 }],
  } as unknown as CategoriesRepository;
  const students = {
    list: async () => [{
      id: '91', phone: '+549110', firstName: 'Julián', lastName: 'Vera', birthDate: null,
      categoryId: null, studentStatusId: '1', dominantHand: null, ranking: null, notes: null,
    }],
  } as unknown as StudentsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      GruposFacade,
      { provide: GroupsRepository, useValue: groups },
      { provide: ClassSessionsRepository, useValue: sessions },
      { provide: CategoriesRepository, useValue: categories },
      { provide: StudentsRepository, useValue: students },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: o.id ?? '7' }) } } },
    ],
  });
  return { calls };
}

async function mount(o: Opciones = {}) {
  const { calls } = setup(o);
  const fixture = TestBed.createComponent(GrupoDetailPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await flushRepo();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, calls, toasts: TestBed.inject(ToastService) };
}

/** Click + los dos saltos que necesita `openAttendance`, que pide el roster de la sesión. */
async function abrirModal(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }, el: HTMLElement) {
  el.querySelector<HTMLButtonElement>('app-sessions-table tbody button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  await flushRepo();
  fixture.detectChanges();
}

async function confirmar(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }, el: HTMLElement) {
  el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
  await fixture.whenStable();
  await flushRepo();
  fixture.detectChanges();
}

describe('GrupoDetailPageComponent', () => {
  it('renderiza hero, roster, lista de espera y sesiones', async () => {
    const { el } = await mount();
    expect(el.querySelector('.stu-hero h2')!.textContent).toContain('7ma+8va · Lunes 18:00');
    expect(el.querySelector('.stu-hero .st-sub')!.textContent).toContain('Diego A.');
    expect(el.querySelectorAll('app-roster-table tbody tr')).toHaveLength(1);
    expect(el.querySelector('.waitlist-card')!.textContent).toContain('Julián Vera');
    expect(el.querySelectorAll('app-sessions-table tbody tr')).toHaveLength(1);
  });

  it('el detalle pide el roster de la próxima sesión del grupo', async () => {
    const { calls } = await mount();
    expect(calls).toContain('reservations:301');
    expect(calls).toContain('waitingList:301');
  });

  // Un grupo en receso no tiene próxima sesión programada: no hay roster que pedir.
  it('sin próxima sesión no le pide el roster a nadie', async () => {
    const { calls, el } = await mount({ groups: [grupo({ nextSessionId: null, sessions: [] })] });
    expect(calls.filter((c) => c.startsWith('reservations'))).toEqual([]);
    expect(el.querySelector('app-roster-table')!.textContent).toContain('Nadie inscripto');
  });

  it('las 4 fichas del hero, en orden, con la fecha LOCAL de la próxima programada', async () => {
    const { el } = await mount({
      groups: [grupo({ sessions: [sesion(), sesion({ id: '302', startAt: '2026-12-14T21:00:00.000Z', yaPaso: false })] })],
    });
    const fichas = el.querySelectorAll('.st-fact');
    expect(fichas[0].textContent).toContain('Cupo');
    expect(fichas[1].textContent).toContain('Inscriptos');
    expect(fichas[1].querySelector('.v')!.textContent).toContain('2');
    expect(fichas[2].textContent).toContain('En lista de espera');
    expect(fichas[3].textContent).toContain('Próxima sesión');
    expect(fichas[3].querySelector('.v')!.textContent).toContain('14/12');
  });

  it('la lista de espera muestra la fecha de anotación y el 1ro en la fila', async () => {
    const { el } = await mount();
    const entrada = el.querySelector('.waitlist-card .arow')!;
    expect(entrada.textContent).toContain('1ro en la fila');
    expect(entrada.textContent).toContain('anotado 01/09');
  });

  it('TOMAR ASISTENCIA guarda y avisa con el conteo, sin recargar el grupo', async () => {
    const { fixture, el, calls, toasts } = await mount();
    await abrirModal(fixture, el);
    expect(el.querySelector('dialog')!.open).toBe(true);

    await confirmar(fixture, el);

    expect(calls).toContain('markAttendance:301');
    // markBulk no toca cupo, créditos ni estados: releer sería una llamada de más.
    expect(calls.filter((c) => c === 'listGroups')).toHaveLength(1);
    expect(el.querySelector('dialog')).toBeNull();          // el target se limpió
    expect(toasts.toasts()[0].type).toBe('ok');
    expect(toasts.toasts()[0].title).toBe('Asistencia registrada');
    expect(toasts.toasts()[0].desc).toContain('1 presente(s) · 0 ausente(s)');
  });

  // El modal SÓLO ofrece las confirmed: AttendanceService.mark() tira 400 sobre el resto.
  it('una sesión con reservas held pero ninguna confirmada avisa y NO abre el modal', async () => {
    const { fixture, el, toasts } = await mount({
      reservations: [reserva({ status: 'held', holdExpiresAt: '2999-01-01T00:00:00.000Z' })],
    });
    await abrirModal(fixture, el);
    expect(el.querySelector('dialog')).toBeNull();
    expect(toasts.toasts()[0].title).toBe('Nadie confirmado');
  });

  it('el éxito PARCIAL de markBulk sale como tal, no como éxito', async () => {
    // markBulk itera con un try por ítem: la mitad guardada es un resultado de primera clase.
    const { fixture, el, toasts } = await mount({
      reservations: [reserva({ id: '500' }), reserva({ id: '501', studentId: '89' })],
      resultados: [
        { reservationId: '500', ok: true, status: 'asistio', error: null },
        { reservationId: '501', ok: false, status: null, error: 'La reserva no está confirmada.' },
      ],
    });
    await abrirModal(fixture, el);
    await confirmar(fixture, el);

    expect(toasts.toasts()[0].type).toBe('info');
    expect(toasts.toasts()[0].title).toBe('Asistencia guardada a medias');
    expect(toasts.toasts()[0].desc).toContain('1 de 2 se guardaron');
  });

  it('si falla al guardar, el modal QUEDA ABIERTO y sale el toast en español', async () => {
    // Rechaza con un DomainRuleError CRUDO, no con un { kind } ya normalizado: es lo que tira de
    // verdad el repo, y es lo único que prueba que toDomainError haga falta acá.
    const { fixture, el, toasts } = await mount({ guardarFalla: true });
    await abrirModal(fixture, el);
    await confirmar(fixture, el);

    expect(el.querySelector('dialog')!.open).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.disabled).toBe(false);
    expect(toasts.toasts()[0].type).toBe('info');
    expect(toasts.toasts()[0].title).toBe('No se pudo guardar');
    expect(toasts.toasts()[0].desc).toBe('Marcá al menos un alumno antes de guardar.');
  });

  it('MIENTRAS CARGA muestra "Cargando grupo…", NUNCA "No encontramos ese grupo"', async () => {
    // Con la lista vacía, groups().find() da undefined para CUALQUIER id. Si la rama de "no
    // existe" fuera antes que la de loading, un deep-link mostraría el error toda la latencia.
    setup();
    const fixture = TestBed.createComponent(GrupoDetailPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cargando grupo…');
    expect(el.textContent).not.toContain('No encontramos ese grupo');
  });

  it('un id inexistente muestra el mensaje y el link a la lista', async () => {
    const { el } = await mount({ id: '99' });
    expect(el.textContent).toContain('No encontramos ese grupo');
    expect(el.querySelector('a[href="/grupos"]')).toBeTruthy();
  });

  it('el error del detalle habla del grupo, no de los grupos', async () => {
    const { el } = await mount({ listGroupsFalla: true });
    expect(el.textContent).toContain('No se pudo cargar el grupo');
    expect(el.textContent).not.toContain('los grupos');
  });

  it('ya no muestra el cartel de datos de demostración', async () => {
    const { el } = await mount();
    expect(el.textContent).not.toContain('Datos de demostración');
  });
});
