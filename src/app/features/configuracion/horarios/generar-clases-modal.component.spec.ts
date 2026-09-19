import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GenerarClasesModalComponent } from './generar-clases-modal.component';
import { sessionRangeForSchedule } from '@domain/entities/schedule';
import { localDateKey } from '@domain/local-date';

function setup(generables: number, error = ''): ComponentFixture<GenerarClasesModalComponent> {
  // reset explícito: mismo patrón que horario-form-modal.component.spec.ts, necesario porque
  // más de un it() en este archivo llama setup()/setupGenerando() más de una vez.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(GenerarClasesModalComponent);
  fixture.componentRef.setInput('generables', generables);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open();
  fixture.detectChanges();
  return fixture;
}

function setupGenerando(generables: number): ComponentFixture<GenerarClasesModalComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(GenerarClasesModalComponent);
  fixture.componentRef.setInput('generables', generables);
  fixture.componentRef.setInput('generating', true);
  fixture.detectChanges();
  fixture.componentInstance.open();
  fixture.detectChanges();
  return fixture;
}

/** Alias con nombre propio: mismo setup(), sólo para que el it() se lea igual que el brief. */
const setupConError = (generables: number, error: string) => setup(generables, error);

const el = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLInputElement;

describe('GenerarClasesModalComponent', () => {
  it('arranca con las cuatro semanas que define el dominio, y desde HOY en local', () => {
    // El horizonte (§4) lo define sessionRangeForSchedule, el mismo que usa el alta al
    // generar: acá se compara contra él y no contra un 28 escrito a mano, que es lo que los
    // tenía peleados por un día. `localDateKey` y no toISOString: después de las 21 local
    // el UTC ya es mañana.
    const f = setup(8);
    const esperado = sessionRangeForSchedule({ validFrom: null, validTo: null }, localDateKey(new Date()))!;
    expect(el(f, '[data-test="desde"]').value).toBe(esperado.from);
    expect(el(f, '[data-test="hasta"]').value).toBe(esperado.to);
    const desde = new Date(esperado.from + 'T00:00:00Z');
    const hasta = new Date(esperado.to + 'T00:00:00Z');
    // 28 días CONTANDO el de hoy.
    expect((hasta.getTime() - desde.getTime()) / 86_400_000).toBe(27);
  });

  it('dice HASTA cuántos horarios, no un número exacto', () => {
    // El contador replica tres de los cinco filtros del service: los de vigencia dependen
    // del rango elegido y no se pueden saber acá (§8.4).
    expect(setup(8).nativeElement.textContent).toContain('hasta 8 horarios');
  });

  it('avisa que no se puede deshacer', () => {
    expect(setup(8).nativeElement.querySelector('.notice')!.textContent)
      .toContain('no se pueden borrar');
  });

  it('el botón de confirmar NO es rojo: esto CREA, no destruye', () => {
    // Rojo significa "destruye" en el DS y sus dos únicos consumidores son borrar y
    // cancelar. Además el botón que abre este modal es .btn-ghost (azul).
    const btn = setup(8).nativeElement.querySelector('[data-test="confirmar"]') as HTMLButtonElement;
    expect(btn.classList.contains('btn-danger')).toBe(false);
    expect(btn.classList.contains('btn-primary')).toBe(true);
  });

  it('emite el rango crudo', () => {
    const f = setup(8);
    let emitido: { from: string; to: string } | undefined;
    f.componentInstance.confirmed.subscribe((v: { from: string; to: string }) => { emitido = v; });
    el(f, '[data-test="desde"]').value = '2026-08-03';
    el(f, '[data-test="desde"]').dispatchEvent(new Event('input'));
    el(f, '[data-test="hasta"]').value = '2026-08-30';
    el(f, '[data-test="hasta"]').dispatchEvent(new Event('input'));
    f.detectChanges();
    (f.nativeElement.querySelector('[data-test="confirmar"]') as HTMLButtonElement).click();
    expect(emitido).toEqual({ from: '2026-08-03', to: '2026-08-30' });
  });

  it('el botón se deshabilita mientras genera: un doble click DUPLICA de verdad', () => {
    // §3.11: la idempotencia del backend es findFirst+create sin transacción y sin @@unique.
    const f = setupGenerando(8);
    expect((f.nativeElement.querySelector('[data-test="confirmar"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra el error de generación adentro del modal', () => {
    const f = setupConError(8, 'El rango no puede superar los 60 días.');
    expect(f.nativeElement.querySelector('[role="alert"]')!.textContent).toContain('60 días');
  });
});
