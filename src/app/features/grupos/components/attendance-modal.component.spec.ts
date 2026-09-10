import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AttendanceModalComponent, AttendanceTarget } from './attendance-modal.component';
import { Group, GroupSession, RosterMember } from '@domain/entities/group';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';

const GRUPO: Group = {
  id: '7', category: '7ma+8va', teacher: 'Diego A.', courtName: 'Cancha 1',
  weekday: 1, startTime: '18:00', capacity: 4, enrolled: 2, waiting: 0,
  nextSessionId: '301', sessions: [],
};

const SESION: GroupSession = {
  id: '301', startAt: '2026-09-07T21:00:00.000Z', courtName: 'Cancha 1',
  status: 'programada', enrolled: 2, capacity: 4, waiting: 0, yaPaso: true,
};

const miembro = (over: Partial<RosterMember> = {}): RosterMember => ({
  id: '500', studentId: '88', name: 'Lucía Pereyra', category: '7ma',
  status: 'confirmed', attendanceStatus: null, ...over,
});

function render(roster: readonly RosterMember[]) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(AttendanceModalComponent);
  const target: AttendanceTarget = { group: GRUPO, session: SESION, roster };
  fixture.componentRef.setInput('target', target);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, comp: fixture.componentInstance };
}

const segmentos = (el: HTMLElement) => el.querySelectorAll<HTMLButtonElement>('.segp');
const guardar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!;

describe('AttendanceModalComponent', () => {
  it('UN SOLO MODO: siempre "Tomar asistencia", sin checkbox de política ni créditos', () => {
    const { el, comp } = render([miembro()]);
    comp.open();
    expect(el.querySelector('h3')!.textContent).toContain('Tomar asistencia');
    expect(el.querySelector('[data-testid="confirm"]')!.textContent).toContain('Guardar asistencia');
    expect(el.querySelector('.att-policy')).toBeNull();
    expect(el.textContent).not.toContain('créd');
    expect(el.textContent).not.toContain('Clases a computar');
  });

  it('el subtítulo lleva grupo · fecha hora LOCALES · cancha', () => {
    const { el, comp } = render([miembro()]);
    comp.open();
    // 21:00Z es 18:00 en Argentina, y test-setup.ts fija esa TZ.
    expect(el.querySelector('.m-sub')!.textContent)
      .toContain('7ma+8va · Lunes 18:00 · 07/09 18:00 · Cancha 1');
  });

  it('open() prellena Ausente a quien ya está marcado ausente, y Presente al resto', () => {
    const { fixture, el, comp } = render([
      miembro({ id: '1', attendanceStatus: 'ausente' }),
      miembro({ id: '2', attendanceStatus: 'asistio' }),
      miembro({ id: '3', attendanceStatus: null }),
    ]);
    comp.open();
    fixture.detectChanges();
    const emitidas: (readonly SessionAttendanceMark[])[] = [];
    comp.confirmed.subscribe((m) => emitidas.push(m));
    guardar(el).click();
    expect(emitidas[0]).toEqual([
      { reservationId: '1', status: 'ausente' },
      { reservationId: '2', status: 'asistio' },
      { reservationId: '3', status: 'asistio' },
    ]);
  });

  it('el resumen se actualiza al togglear', () => {
    const { fixture, el, comp } = render([miembro({ id: '1' }), miembro({ id: '2' })]);
    comp.open();
    fixture.detectChanges();
    expect(el.querySelector('.att-summary')!.textContent).toContain('Presentes 2');

    segmentos(el)[3].click();          // el segundo → Ausente
    fixture.detectChanges();
    const resumen = el.querySelector('.att-summary')!.textContent!;
    expect(resumen).toContain('Presentes 1');
    expect(resumen).toContain('Ausentes 1');
  });

  // El guard es de CÓDIGO: .btn.loading es sólo pointer-events:none y no frena el Enter del teclado.
  it('DOS activaciones seguidas del botón emiten UNA sola vez', () => {
    const { fixture, el, comp } = render([miembro()]);
    comp.open();
    fixture.detectChanges();
    let veces = 0;
    comp.confirmed.subscribe(() => veces++);

    // SIN detectChanges() entre los dos clicks, a propósito: es el escenario real (dos Enter en el
    // mismo macrotask, antes de que corra la detección de cambios). Con un detectChanges() en el
    // medio el botón queda disabled y jsdom descarta el segundo click ANTES del handler
    // (HTMLElement-impl.js: `if (isDisabled(this)) return`), así que el test pasaría en verde
    // aunque se borrara el guard: estaría probando el [disabled] del template, que es justo el
    // freno que NO alcanza. Así, el guard de confirm() es lo único que evita el segundo emit.
    guardar(el).click();
    guardar(el).click();

    expect(veces).toBe(1);

    fixture.detectChanges();
    expect(guardar(el).disabled).toBe(true);
  });

  it('markFailed() deja el modal abierto y el botón disponible otra vez', () => {
    const { fixture, el, comp } = render([miembro()]);
    comp.open();
    fixture.detectChanges();
    let veces = 0;
    comp.confirmed.subscribe(() => veces++);

    guardar(el).click();
    fixture.detectChanges();
    expect(guardar(el).disabled).toBe(true);

    comp.markFailed();
    fixture.detectChanges();
    expect(guardar(el).disabled).toBe(false);
    guardar(el).click();
    expect(veces).toBe(2);
    expect(el.querySelector('dialog')!.open).toBe(true);   // NO se cerró
  });

  it('reabrir después de un fallo arranca en limpio', () => {
    const { fixture, el, comp } = render([miembro({ id: '1' }), miembro({ id: '2' })]);
    comp.open();
    fixture.detectChanges();
    segmentos(el)[3].click();                 // el segundo, ausente
    fixture.detectChanges();
    guardar(el).click();
    fixture.detectChanges();
    comp.markFailed();
    fixture.detectChanges();

    comp.open();                              // reabrir
    fixture.detectChanges();
    expect(segmentos(el)[3].classList.contains('on-a')).toBe(false);   // volvió a presente
  });
});
