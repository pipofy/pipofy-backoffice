import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { RosterTableComponent } from './roster-table.component';
import { RosterMember } from '@domain/entities/group';

const miembro = (over: Partial<RosterMember> = {}): RosterMember => ({
  id: '500', studentId: '88', name: 'Lucía Pereyra', category: '7ma',
  status: 'confirmed', attendanceStatus: null, ...over,
});

function render(roster: readonly RosterMember[], capacity = 4): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(RosterTableComponent);
  fixture.componentRef.setInput('roster', roster);
  fixture.componentRef.setInput('capacity', capacity);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('RosterTableComponent', () => {
  it('una fila por integrante, con sus iniciales y su categoría', () => {
    const el = render([miembro(), miembro({ id: '501', name: 'Bruno Torres', category: '8va' })], 4);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector('.avatar-sm')!.textContent).toContain('LP');
    expect(filas[0].textContent).toContain('Lucía Pereyra');
    expect(filas[1].querySelector('.cat-badge')!.textContent).toContain('8va');
  });

  it('marca la fila held sin esconderla: ocupa cupo para el backend', () => {
    const el = render([miembro({ id: 'a', status: 'confirmed' }), miembro({ id: 'b', status: 'held' })], 4);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('Sin confirmar');
  });

  it('ya no tiene columnas de créditos ni de asistencia', () => {
    // La tercera es la de acciones. Lleva encabezado: un <th> vacío deja a un lector de
    // pantalla anunciando una columna sin nombre, y es la de los botones destructivos.
    const th = [...render([miembro()], 4).querySelectorAll('thead th')].map((t) => t.textContent?.trim());
    expect(th).toEqual(['Alumno', 'Categoría', 'Acciones']);
  });

  it('cada fila ofrece SIEMPRE quitar, y el aria-label nombra la CLASE, no el grupo', () => {
    // Sacar a alguien cancela su reserva de una sesión: no existe la inscripción a un grupo.
    const el = render([miembro()], 4);
    const btn = el.querySelector<HTMLButtonElement>('[data-test="quitar"]')!;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-label')).toContain('esta clase');
    // El texto VISIBLE también nombra la clase: el panel de arriba dice "al grupo".
    expect(btn.textContent).toContain('Quitar de esta clase');
  });

  it('muestra el contador de ocupación en el panel-head', () => {
    const el = render([miembro(), miembro({ id: '501' }), miembro({ id: '502' })], 4);
    expect(el.querySelector('.panel-head')!.textContent).toContain('3/4');
  });

  it('las filas NO son clickeables ni tienen botón de abrir (D8: no hay ficha adonde ir)', () => {
    const el = render([miembro()], 4);
    expect(el.querySelector('.row-link')).toBeNull();
    expect(el.querySelector('.row-open')).toBeNull();
  });

  it('muestra el placeholder con el roster vacío', () => {
    expect(render([], 4).textContent).toContain('Nadie inscripto');
  });
});
