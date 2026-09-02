import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AsistenciaSeccionComponent } from './asistencia-seccion.component';
import { SessionReservation } from '@domain/entities/session-reservation';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';

const fila = (id: string, studentId: string, status: string): SessionReservation => ({
  id,
  studentId,
  studentPlanId: null,
  status,
  holdExpiresAt: null,
});

const NOMBRES = new Map([
  ['4', 'Rita Pérez'],
  ['7', 'Juan Gómez'],
]);

function mount(rows: readonly SessionReservation[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(AsistenciaSeccionComponent);
  fixture.componentRef.setInput('reservas', rows);
  fixture.componentRef.setInput('nombres', NOMBRES);
  fixture.detectChanges();
  const emitidas: (readonly SessionAttendanceMark[])[] = [];
  fixture.componentInstance.guardar.subscribe((m) => emitidas.push(m));
  return { fixture, el: fixture.nativeElement as HTMLElement, emitidas };
}

/** Los botones de una fila, en orden: [Presente, Ausente]. */
function botones(el: HTMLElement, i: number): HTMLButtonElement[] {
  const filas = el.querySelectorAll('.att-row');
  return Array.from(filas[i].querySelectorAll('button'));
}

function click(el: HTMLElement, selector: string): void {
  el.querySelector<HTMLButtonElement>(selector)!.click();
}

describe('AsistenciaSeccionComponent', () => {
  it('no se renderiza si no hay ninguna reserva confirmada', () => {
    const { el } = mount([fila('55', '4', 'held')]);
    expect(el.querySelector('h4')).toBeNull();
  });

  it('lista sólo las confirmadas: los held y pending_review viven en Anotados', () => {
    const { el } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'held'),
      fila('57', '7', 'pending_review'),
    ]);
    expect(el.querySelectorAll('.att-row')).toHaveLength(1);
    expect(el.textContent).toContain('Rita Pérez');
  });

  it('muestra el hint cuando hay filas que no se pueden marcar', () => {
    const { el } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'held')]);
    expect(el.textContent).toContain('Sólo se puede marcar la asistencia de las reservas');
  });

  it('sin filas pendientes NO muestra el hint: no habría nada que explicar', () => {
    const { el } = mount([fila('55', '4', 'confirmed')]);
    expect(el.textContent).not.toContain('Sólo se puede marcar la asistencia');
  });

  it('Guardar está deshabilitado hasta que se marque algo', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    const guardar = el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!;
    expect(guardar.disabled).toBe(true);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    expect(guardar.disabled).toBe(false);
  });

  it('«Vinieron todos» marca a todas las confirmadas como presentes', () => {
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    click(el, '[data-test="todos"]');
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([
      { reservationId: '55', status: 'asistio' },
      { reservationId: '56', status: 'asistio' },
    ]);
  });

  it('emite sólo las filas marcadas, no las que quedaron en blanco', () => {
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    botones(el, 1)[1].click(); // Juan → Ausente
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([{ reservationId: '56', status: 'ausente' }]);
  });

  it('DESCARTA la marca huérfana: la reserva que dejó de estar confirmada no viaja', () => {
    // Es el borde que se lleva la entrega si el body se arma desde las marcas en vez del
    // roster. Entre marcar y guardar el alumno puede cancelar por WhatsApp; esa marca volvería
    // como fallo per-ítem que NUNCA va a entrar, y como el parcial no limpia la planilla, el
    // reintento fallaría para siempre.
    const { el, fixture, emitidas } = mount([
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'confirmed'),
    ]);
    botones(el, 0)[0].click();
    botones(el, 1)[0].click();
    fixture.detectChanges();
    fixture.componentRef.setInput('reservas', [
      fila('55', '4', 'confirmed'),
      fila('56', '7', 'cancelled'),
    ]);
    fixture.detectChanges();
    click(el, '[data-test="guardar-asistencia"]');
    expect(emitidas[0]).toEqual([{ reservationId: '55', status: 'asistio' }]);
  });

  it('resultado() con todo OK limpia la planilla y resume lo guardado', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [
        { reservationId: '55', ok: true, status: 'asistio', error: null },
        { reservationId: '56', ok: true, status: 'ausente', error: null },
      ],
      '',
    );
    fixture.detectChanges();
    expect(el.textContent).toContain('Asistencia guardada: 1 presente, 1 ausente.');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('resultado() parcial NO limpia y agrupa los fallidos por mensaje', () => {
    // Si el error es sistémico sale en todas las filas: una línea, no seis.
    const { el, fixture } = mount([fila('55', '4', 'confirmed'), fila('56', '7', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [
        {
          reservationId: '55',
          ok: false,
          status: null,
          error: 'La reserva no pertenece a esta clase',
        },
        {
          reservationId: '56',
          ok: false,
          status: null,
          error: 'La reserva no pertenece a esta clase',
        },
      ],
      '',
    );
    fixture.detectChanges();
    const alertas = Array.from(el.querySelectorAll('[role="alert"]'));
    expect(alertas).toHaveLength(1);
    expect(alertas[0].textContent).toContain('Rita Pérez, Juan Gómez');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('resultado(null) pinta el error del POST entero al lado del botón y no limpia', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    expect(el.textContent).toContain('No tenés permisos para hacer esto.');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('resultado() borra lo del guardado anterior antes de mostrar lo nuevo', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    fixture.componentInstance.resultado(
      [{ reservationId: '55', ok: true, status: 'asistio', error: null }],
      '',
    );
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No tenés permisos');
    expect(el.textContent).toContain('Asistencia guardada: 1 presente.');
  });

  it('un fallo que releído vacía el roster igual muestra el bloque de fallidos', () => {
    // Regresión del Important 1: sesion.facade.ts relee el roster tras un !ok (§3.4/§3.6), y si
    // esa relectura deja CERO confirmadas, el guard viejo (`@if (confirmadas().length)`) se
    // llevaba puesto todo el bloque de feedback con la sección. `resultado()` deja setFallos,
    // pero nadie lo mostraba.
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    // La relectura del facade ya corrió y la única fila dejó de estar confirmed.
    fixture.componentRef.setInput('reservas', [fila('55', '4', 'cancelled')]);
    fixture.componentInstance.resultado(
      [
        {
          reservationId: '55',
          ok: false,
          status: null,
          error: 'Solo se puede marcar asistencia sobre reservas confirmadas',
        },
      ],
      '',
    );
    fixture.detectChanges();
    expect(el.querySelector('h4')).not.toBeNull();
    const alertas = Array.from(el.querySelectorAll('[role="alert"]'));
    expect(alertas).toHaveLength(1);
    expect(alertas[0].textContent).toContain('Rita Pérez');
    expect(alertas[0].textContent).toContain('Solo se puede marcar asistencia');
  });

  it('los botones Presente/Ausente se deshabilitan mientras saving() está en true', () => {
    // Regresión del Important 2: sin [disabled], una marca hecha durante el POST en vuelo no
    // viaja en el body ya armado y se pierde en silencio cuando el éxito limpia `marcas`.
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const [presente, ausente] = botones(el, 0);
    expect(presente.disabled).toBe(true);
    expect(ausente.disabled).toBe(true);
  });

  it('reset() deja todo en blanco: es lo que llama open() del modal', () => {
    const { el, fixture } = mount([fila('55', '4', 'confirmed')]);
    botones(el, 0)[0].click();
    fixture.detectChanges();
    fixture.componentInstance.resultado(null, 'No tenés permisos para hacer esto.');
    fixture.detectChanges();
    fixture.componentInstance.reset();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No tenés permisos');
    expect(botones(el, 0)[0].getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector<HTMLButtonElement>('[data-test="guardar-asistencia"]')!.disabled).toBe(
      true,
    );
  });
});
