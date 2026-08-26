import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CancelarClaseModalComponent, CancelScope } from './cancelar-clase-modal.component';
import { CancelClassInput } from '@domain/entities/class-cancellation';

const CLASE: CancelScope = { what: 'la clase de Cancha 1 · 18:00 · 7ma', affected: 3 };

function setup(scope: CancelScope = CLASE, error = '') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(CancelarClaseModalComponent);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open(scope);
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLInputElement & HTMLTextAreaElement;

function confirmar(f: { nativeElement: HTMLElement }) {
  (f.nativeElement.querySelector('[data-test="cancel-confirm"]') as HTMLButtonElement).click();
}

describe('CancelarClaseModalComponent', () => {
  it('nombra qué se está por cancelar', () => {
    expect(setup().nativeElement.textContent).toContain('la clase de Cancha 1 · 18:00 · 7ma');
  });

  it('avisa que se cancelan las reservas y se devuelve el crédito', () => {
    const texto = setup().nativeElement.textContent;
    expect(texto).toContain('3 alumnos');
    expect(texto).toContain('crédito');
  });

  it('con 3 anotados dice "alumnos" y con 1 dice "alumno"', () => {
    expect(setup({ what: 'x', affected: 1 }).nativeElement.textContent).toContain('1 alumno');
  });

  it('sin anotados no promete nada sobre créditos', () => {
    expect(setup({ what: 'x', affected: 0 }).nativeElement.textContent).not.toContain('crédito');
  });

  it('el aviso por WhatsApp arranca APAGADO', () => {
    // Avisarle a la gente es irreversible: tiene que ser una decisión, no el default.
    expect(el(setup(), '[data-test="cancel-avisar"]').checked).toBe(false);
  });

  it('emite el motivo y el aviso tal cual, sin validar', () => {
    // La invariante vive en createCancelClassDraft, igual que en el form de alumnos.
    const f = setup();
    let emitido: CancelClassInput | undefined;
    f.componentInstance.confirmed.subscribe((v: CancelClassInput) => { emitido = v; });
    el(f, '[data-test="cancel-motivo"]').value = '  Se llovió  ';
    el(f, '[data-test="cancel-motivo"]').dispatchEvent(new Event('input'));
    el(f, '[data-test="cancel-avisar"]').click();
    f.detectChanges();
    confirmar(f);
    expect(emitido).toEqual({ reason: '  Se llovió  ', notify: true });
  });

  it('el hint de WhatsApp aparece SÓLO con el aviso tildado', () => {
    const f = setup();
    expect(f.nativeElement.querySelector('.hint')).toBeNull();
    el(f, '[data-test="cancel-avisar"]').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.hint')?.textContent).toContain('WhatsApp');
  });

  it('NO se cierra al confirmar: cerrar lo decide la página si la escritura salió bien', () => {
    const f = setup();
    confirmar(f);
    f.detectChanges();
    expect(el(f, '[data-test="cancel-motivo"]')).not.toBeNull();
  });

  it('cada apertura limpia el motivo y el aviso', () => {
    // Un motivo escrito para la clase de las 18:00 no puede quedar cargado en la de las 20:00.
    const f = setup();
    el(f, '[data-test="cancel-motivo"]').value = 'Se llovió';
    el(f, '[data-test="cancel-motivo"]').dispatchEvent(new Event('input'));
    el(f, '[data-test="cancel-avisar"]').click();
    f.detectChanges();

    f.componentInstance.open({ what: 'otra clase', affected: 0 });
    f.detectChanges();
    expect(el(f, '[data-test="cancel-motivo"]').value).toBe('');
    expect(el(f, '[data-test="cancel-avisar"]').checked).toBe(false);
  });

  it('el checkbox NO vive dentro de .field, y usa el primitivo del DS', () => {
    // `.field input` (styles/components.css:83) es un selector de descendencia: width:100% +
    // min-height convierten el checkbox en una caja de texto bordeada. El primitivo
    // .checkbox-row (styles/components.css:134) es el que le da la geometría correcta.
    // jsdom no aplica CSS, así que sin esta aserción el bug sólo se ve en el browser.
    const root = setup().nativeElement as HTMLElement;
    expect(root.querySelector('.field #cancel-avisar')).toBeNull();
    expect(root.querySelector('.checkbox-row #cancel-avisar')).toBeTruthy();
  });

  it('muestra el error ADENTRO del modal', () => {
    // El .notice de la página queda detrás del ::backdrop, que tiene scrim + blur.
    const f = setup(CLASE, 'Escribí el motivo: es el texto que le va a llegar…');
    expect(f.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Escribí el motivo');
  });
});
