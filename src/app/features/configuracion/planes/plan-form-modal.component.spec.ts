import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlanFormModalComponent } from './plan-form-modal.component';
import { Plan, PlanInput } from '@domain/entities/plan';
import { Coach } from '@domain/entities/coach';

const TIPOS = [{ id: '1', name: 'mensual_grupal' }, { id: '2', name: 'nivelacion' }];
const COACHES: Coach[] = [
  { id: '5', displayName: 'Juan Gómez', description: null },
  { id: '6', displayName: 'Ana Ruiz', description: null },
];

const PLAN: Plan = {
  id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '6',
  classCount: 8, price: '12000', validityDays: 30, active: true,
};

function setup(plan: Plan | null, error = '', tipos = TIPOS, coaches = COACHES) {
  // reset explícito: el test "el select de tipo NUNCA ofrece opción vacía" llama setup() dos
  // veces DENTRO del mismo it(), y TestBed no deja reconfigurar un módulo ya instanciado sin
  // esto (el reset automático de Angular sólo corre ENTRE tests, no dentro de uno).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(PlanFormModalComponent);
  fixture.componentRef.setInput('planTypes', tipos);
  fixture.componentRef.setInput('coaches', coaches);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open(plan);
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLInputElement & HTMLSelectElement;
const opciones = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLOptionElement>(`${sel} option`));

describe('PlanFormModalComponent', () => {
  it('precarga todos los campos en edición', () => {
    const f = setup(PLAN);
    expect(el(f, '#plan-nombre').value).toBe('Mensual 8');
    expect(el(f, '[data-test="plan-type"]').value).toBe('2');
    expect(el(f, '[data-test="plan-coach"]').value).toBe('6');
    expect(el(f, '#plan-clases').value).toBe('8');
    expect(el(f, '#plan-precio').value).toBe('12000');
    expect(el(f, '#plan-validez').value).toBe('30');
    expect(el(f, '#plan-activo').checked).toBe(true);
  });

  it('en alta arranca vacío y activo', () => {
    const f = setup(null);
    expect(el(f, '#plan-nombre').value).toBe('');
    expect(el(f, '#plan-activo').checked).toBe(true);
  });

  it('reabrir en alta después de tipear deja el formulario vacío', () => {
    const f = setup(null);
    el(f, '#plan-nombre').value = 'Suelto';
    el(f, '#plan-nombre').dispatchEvent(new Event('input'));
    el(f, '#plan-precio').value = '9000';
    el(f, '#plan-precio').dispatchEvent(new Event('input'));
    f.detectChanges();
    f.componentInstance.open(null);
    f.detectChanges();
    expect(el(f, '#plan-nombre').value).toBe('');
    expect(el(f, '#plan-precio').value).toBe('');
  });

  it('reabrir el mismo plan en edición después de cambiar el precio sin guardar muestra el precio original', () => {
    // El <input> de precio es el MISMO nodo del DOM entre aperturas (el <dialog> de
    // ModalComponent nunca se destruye): un binding [value] sembrado con el mismo string que
    // ya tenía (acá, '12000' → '12000' en las dos aperturas de PLAN) no reescribiría nada,
    // porque Angular sólo toca el DOM cuando la expresión del binding CAMBIA. La siembra
    // imperativa (`priceInput().nativeElement.value = ...`) no tiene ese problema.
    const f = setup(PLAN);   // PLAN.price === '12000'
    el(f, '#plan-precio').value = '99999';
    el(f, '#plan-precio').dispatchEvent(new Event('input'));
    f.detectChanges();
    f.componentInstance.open(PLAN);   // reabre el MISMO plan, sin haber guardado el cambio
    f.detectChanges();
    expect(el(f, '#plan-precio').value).toBe('12000');
  });

  it('el select de tipo NUNCA ofrece opción vacía', () => {
    // planTypeId es obligatorio también en el PATCH (§3.4): ofrecer el vacío sería mentir.
    expect(opciones(setup(null), '[data-test="plan-type"]').some((o) => o.value === '')).toBe(false);
    expect(opciones(setup(PLAN), '[data-test="plan-type"]').some((o) => o.value === '')).toBe(false);
  });

  it('el select de profesor SIEMPRE ofrece opción vacía, tenga o no uno asignado', () => {
    // El PATCH manda coachId en null y plans.service.update lo pasa por fkOpcional(), así
    // que a un plan con profesor se le puede sacar. Verificado contra el server: PATCH → 200.
    expect(opciones(setup(null), '[data-test="plan-coach"]').some((o) => o.value === '')).toBe(true);
    expect(opciones(setup(PLAN), '[data-test="plan-coach"]').some((o) => o.value === '')).toBe(true);
  });

  it('el select muestra el valor guardado aunque las opciones lleguen tarde', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(PlanFormModalComponent);
    f.componentRef.setInput('planTypes', []);
    f.componentRef.setInput('coaches', []);
    f.componentRef.setInput('error', '');
    f.detectChanges();
    f.componentInstance.open(PLAN);
    f.detectChanges();
    f.componentRef.setInput('planTypes', TIPOS);
    f.componentRef.setInput('coaches', COACHES);
    f.detectChanges();
    expect(el(f, '[data-test="plan-type"]').value).toBe('2');
  });

  it('un profesor que ya no está en la lista no cae en la primera opción', () => {
    const f = setup({ ...PLAN, coachId: '99' });
    const select = el(f, '[data-test="plan-coach"]');
    expect(select.value).toBe('99');
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('(no disponible)');
  });

  it('emite los valores crudos, sin validar', () => {
    const f = setup(PLAN);
    let emitido: unknown;
    f.componentInstance.saved.subscribe((v: unknown) => { emitido = v; });
    // ComponentFixture.nativeElement es `any`: pasar un genérico explícito a querySelector sobre
    // una expresión `any` da TS2347. Se castea el resultado en vez de tipar la llamada, mismo
    // patrón que cancha-form-modal.component.spec.ts.
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido).toEqual({
      name: 'Mensual 8', planTypeId: '2', coachId: '6',
      classCount: '8', price: '12000', validityDays: '30', active: true,
    });
  });

  it('muestra el error adentro del modal', () => {
    const f = setup(PLAN, 'Elegí un tipo de plan.');
    expect(f.nativeElement.querySelector('.notice')!.textContent).toContain('Elegí un tipo de plan.');
  });

  it('en alta, con el catálogo ya cargado, el tipo por defecto queda sincronizado con lo que se ve', () => {
    // Caso C del spec de sonda (§4.1): sin sincronizar, planTypeId queda en '' mientras el
    // <select> cae en la primera <option> por las suyas — el modelo dice una cosa, la pantalla
    // otra. Se verifica sobre lo que emite onSave(), no sobre el DOM: el DOM ya mostraba la
    // primera opción antes del arreglo, así que un assert de DOM pasaría igual con el bug.
    const f = setup(null);
    let emitido: PlanInput | undefined;
    f.componentInstance.saved.subscribe((v: PlanInput) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido?.planTypeId).toBe(TIPOS[0].id);
    expect(emitido?.planTypeId).not.toBe('');
  });

  it('en alta, si el catálogo llega DESPUÉS de abrir el modal, el tipo por defecto igual queda sincronizado', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(PlanFormModalComponent);
    f.componentRef.setInput('planTypes', []);
    f.componentRef.setInput('coaches', []);
    f.componentRef.setInput('error', '');
    f.detectChanges();
    f.componentInstance.open(null);
    f.detectChanges();
    f.componentRef.setInput('planTypes', TIPOS);
    f.detectChanges();

    let emitido: PlanInput | undefined;
    f.componentInstance.saved.subscribe((v: PlanInput) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido?.planTypeId).toBe(TIPOS[0].id);
  });

  it('un precio con decimales llega completo a onSave()', () => {
    // El campo de precio es NO CONTROLADO (sin [value]): no hay binding con el que Angular
    // pueda competir mientras se tipea, así que no hace falta espiar el setter del DOM como
    // antes — alcanza con verificar que lo que queda en el input (el (input) handler lee
    // directo de e.target.value) llega intacto a onSave() a través de `price`.
    const f = setup(null);
    const input = el(f, '#plan-precio');
    input.value = '12000.5';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();

    let emitido: PlanInput | undefined;
    f.componentInstance.saved.subscribe((v: PlanInput) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido?.price).toBe('12000.5');
  });

  it('el checkbox NO vive dentro de un .field', () => {
    // `.field input` es un selector de descendencia: le daría width:100% + min-height, o sea
    // una caja de texto bordeada en vez de un checkbox. Mismo motivo que .checkbox-row en Canchas.
    const f = setup(null);
    expect(el(f, '#plan-activo').closest('.field')).toBeNull();
  });
});
