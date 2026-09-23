import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CanchaFormModalComponent } from './cancha-form-modal.component';
import { Court } from '@domain/entities/court';

const SURFACES = [{ id: '1', name: 'cemento' }, { id: '3', name: 'sintetico' }];
const STATUSES = [{ id: '1', name: 'disponible' }];

const CON_FK: Court = {
  id: '1', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
};
const SIN_FK: Court = {
  id: '2', name: 'Cancha 2', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null,
};

/**
 * El formulario se siembra en open(), no en un effect sobre un input: sin abrirlo, los signals
 * están en sus valores iniciales. Mismo arranque que attendance-modal.component.spec.ts:30.
 */
function setup(court: Court | null, error = '') {
  // reset explícito: los tests de la opción vacía llaman setup() más de una vez DENTRO del
  // mismo it(), y TestBed no deja reconfigurar un módulo ya instanciado sin esto (mismo
  // patrón que alumno-form-modal.component.spec.ts y plan-form-modal.component.spec.ts).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(CanchaFormModalComponent);
  fixture.componentRef.setInput('surfaceTypes', SURFACES);
  fixture.componentRef.setInput('courtStatuses', STATUSES);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open(court);
  fixture.detectChanges();
  return fixture;
}

const opciones = (fixture: { nativeElement: HTMLElement }, campo: 'surface' | 'status') =>
  Array.from(fixture.nativeElement.querySelectorAll<HTMLOptionElement>(`[data-test="${campo}"] option`));

const tieneVacia = (opts: HTMLOptionElement[]) => opts.some((o) => o.value === '');

describe('CanchaFormModalComponent', () => {
  it('la superficie SIEMPRE ofrece la opción vacía', () => {
    // El PATCH manda el FK en null y courts.service.update lo pasa por fkOpcional(), así
    // que un FK ya asignado sí se puede vaciar. Verificado contra el server: PATCH → 200.
    expect(tieneVacia(opciones(setup(null), 'surface'))).toBe(true);
    expect(tieneVacia(opciones(setup(CON_FK), 'surface'))).toBe(true);
    expect(tieneVacia(opciones(setup(SIN_FK), 'surface'))).toBe(true);
  });

  it('el estado SIEMPRE ofrece la opción vacía', () => {
    // Misma regla que superficie: courtStatusId también pasa por fkOpcional() en el update.
    expect(tieneVacia(opciones(setup(null), 'status'))).toBe(true);
    expect(tieneVacia(opciones(setup(CON_FK), 'status'))).toBe(true);
    expect(tieneVacia(opciones(setup(SIN_FK), 'status'))).toBe(true);
  });

  it('emite saved con lo que hay en el formulario', () => {
    const fixture = setup(CON_FK);
    let emitted: unknown = null;
    fixture.componentInstance.saved.subscribe((v) => { emitted = v; });

    (fixture.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();

    expect(emitted).toEqual({
      name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
    });
  });

  it('REABRIR en alta arranca en limpio, aunque el input no haya cambiado', () => {
    // El camino real: crear "Cancha 5" → guardar → cerrar → "+ Nueva cancha". `editing` nunca
    // dejó de ser null, así que un effect sobre el input no se re-dispara y el formulario
    // reaparecía con "Cancha 5" cargada: un Guardar de más crea un duplicado.
    const fixture = setup(null);
    const nombre = fixture.nativeElement.querySelector('#cancha-nombre') as HTMLInputElement;
    nombre.value = 'Cancha 5';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.componentInstance.close();
    fixture.componentInstance.open(null);
    fixture.detectChanges();

    let emitted: unknown = null;
    fixture.componentInstance.saved.subscribe((v) => { emitted = v; });
    (fixture.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();

    expect((fixture.nativeElement.querySelector('#cancha-nombre') as HTMLInputElement).value).toBe('');
    expect(emitted).toEqual({ name: '', code: '', surfaceTypeId: '', indoor: false, courtStatusId: '' });
  });

  it('muestra el error de la facade DENTRO del modal', () => {
    // §8.3. En la página el .notice queda detrás del ::backdrop (scrim + blur, components.css:254).
    const fixture = setup(null, 'El nombre de la cancha es obligatorio.');
    const aviso = fixture.nativeElement.querySelector('dialog [role="alert"]') as HTMLElement;
    expect(aviso.textContent).toContain('El nombre de la cancha es obligatorio.');
  });

  it('sin error no renderiza el aviso', () => {
    expect(setup(null).nativeElement.querySelector('dialog [role="alert"]')).toBeNull();
  });

  it('el checkbox Techada NO vive dentro de .field, y usa el primitivo del DS', () => {
    // `.field input` (styles/components.css:83) es un selector de descendencia: width:100% +
    // min-height convierten el checkbox en una caja de texto bordeada. El primitivo
    // .checkbox-row (styles/components.css:134) es el que le da la geometría correcta.
    // .att-policy y .terms NO lo usan a propósito: ver §5.3 del spec del slice.
    const el = setup(null).nativeElement as HTMLElement;
    expect(el.querySelector('.field #cancha-techada')).toBeNull();
    expect(el.querySelector('.checkbox-row #cancha-techada')).toBeTruthy();
  });
});

const surfaceSelect = (f: { nativeElement: HTMLElement }) =>
  f.nativeElement.querySelector('[data-test="surface"]') as HTMLSelectElement;

describe('CanchaFormModalComponent — el <select> muestra el valor guardado', () => {
  it('cuando las opciones ya estaban cargadas', () => {
    expect(surfaceSelect(setup(CON_FK)).value).toBe('3');
  });

  it('cuando las opciones llegan DESPUÉS de abrir el modal', () => {
    // La página pide los catálogos async en su constructor: quien abre "Editar" antes de
    // que resuelvan caía en la PRIMERA opción y veía una superficie que no era la suya.
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CanchaFormModalComponent);
    fixture.componentRef.setInput('surfaceTypes', []);
    fixture.componentRef.setInput('courtStatuses', []);
    fixture.componentRef.setInput('error', '');
    fixture.detectChanges();

    fixture.componentInstance.open(CON_FK);
    fixture.detectChanges();

    fixture.componentRef.setInput('surfaceTypes', SURFACES);
    fixture.componentRef.setInput('courtStatuses', STATUSES);
    fixture.detectChanges();

    expect(surfaceSelect(fixture).value).toBe('3');
  });

  it('cuando el valor guardado ya no está entre las opciones', () => {
    // Sin la opción huérfana el <select> cae en la primera y la pantalla miente.
    const fixture = setup({ ...CON_FK, surfaceTypeId: '99' });
    expect(surfaceSelect(fixture).value).toBe('99');
    const seleccionada = surfaceSelect(fixture).options[surfaceSelect(fixture).selectedIndex];
    expect(seleccionada.textContent?.trim()).toBe('(no disponible)');
    expect(seleccionada.disabled).toBe(true);
  });

  it('la opción vacía queda seleccionada cuando no hay valor', () => {
    expect(surfaceSelect(setup(SIN_FK)).value).toBe('');
  });
});
