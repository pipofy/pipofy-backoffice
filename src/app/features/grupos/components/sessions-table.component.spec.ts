import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SessionsTableComponent } from './sessions-table.component';
import { GroupSession } from '@domain/entities/group';

const sesion = (over: Partial<GroupSession> = {}): GroupSession => ({
  id: '301',
  startAt: '2026-09-07T21:00:00.000Z',
  courtName: 'Cancha 1',
  status: 'programada',
  enrolled: 3,
  capacity: 4,
  waiting: 0,
  yaPaso: true,
  ...over,
});

function render(sessions: readonly GroupSession[]) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(SessionsTableComponent);
  fixture.componentRef.setInput('sessions', sessions);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SessionsTableComponent', () => {
  it('ofrece tomar asistencia en una sesión que ya pasó', () => {
    const el = render([sesion()]);
    expect(el.querySelector('button.btn-primary')?.textContent).toContain('Tomar asistencia');
  });

  it('no la ofrece en una futura', () => {
    const el = render([sesion({ yaPaso: false })]);
    expect(el.querySelector('button.btn-primary')).toBeNull();
  });

  // markBulk no la bloquea, pero tomar asistencia de una clase cancelada no significa nada.
  it('no la ofrece en una cancelada, aunque ya haya pasado', () => {
    const el = render([sesion({ status: 'cancelada' })]);
    expect(el.querySelector('button.btn-primary')).toBeNull();
  });

  it('muestra fecha y hora LOCALES y los inscriptos sobre el cupo', () => {
    const celdas = [...render([sesion()]).querySelectorAll('tbody td')].map((c) => c.textContent?.trim());
    // 21:00Z es 18:00 en Argentina, y test-setup.ts fija esa TZ.
    expect(celdas[0]).toBe('07/09');
    expect(celdas[1]).toBe('18:00');
    expect(celdas[4]).toBe('3/4');
  });

  it('muestra el placeholder sin sesiones', () => {
    expect(render([]).textContent).toContain('todavía no tiene sesiones');
  });
});
