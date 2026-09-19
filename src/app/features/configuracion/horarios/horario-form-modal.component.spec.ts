import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HorarioFormModalComponent } from './horario-form-modal.component';
import { Schedule } from '@domain/entities/schedule';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { CatalogItem } from '@data/dto/catalogs.dto';

const COURTS: Court[] = [
  { id: '10', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null },
  { id: '11', name: 'Cancha 2', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null },
];
const COACHES: Coach[] = [
  { id: '20', displayName: 'M. Díaz', description: null },
  { id: '21', displayName: 'J. Pérez', description: null },
];
const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: '30', name: 'Cuarta/Quinta' },
  { id: '31', name: 'Sexta' },
];
const SESSION_TYPES: CatalogItem[] = [
  { id: '40', name: 'individual' },
  { id: '41', name: 'mensual_grupal' },
];

const HORARIO: Schedule = {
  id: '1', courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
  weekday: 1, startTime: '18:00', endTime: '19:30', capacity: 8, price: '12000',
  active: true, validFrom: '2026-08-01', validTo: null,
};

/** Todos los inputs salvo `courts`: el test del lookup que llega tarde los separa. */
function setInputsRestantes(f: { componentRef: { setInput(name: string, value: unknown): void } }, error = '') {
  f.componentRef.setInput('coaches', COACHES);
  f.componentRef.setInput('categoryGroups', CATEGORY_GROUPS);
  f.componentRef.setInput('sessionTypes', SESSION_TYPES);
  f.componentRef.setInput('error', error);
}

function setup(schedule: Schedule | null, error = '') {
  // reset explícito: el test del select con lookup tardío llama setup() más de una vez DENTRO
  // del mismo it(), y TestBed no deja reconfigurar un módulo ya instanciado sin esto (mismo
  // patrón que plan-form-modal.component.spec.ts y alumno-form-modal.component.spec.ts).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(HorarioFormModalComponent);
  fixture.componentRef.setInput('courts', COURTS);
  setInputsRestantes(fixture, error);
  fixture.detectChanges();
  fixture.componentInstance.open(schedule);
  fixture.detectChanges();
  return fixture;
}

function setupConSaving(schedule: Schedule | null, saving: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(HorarioFormModalComponent);
  fixture.componentRef.setInput('courts', COURTS);
  setInputsRestantes(fixture);
  fixture.componentRef.setInput('saving', saving);
  fixture.detectChanges();
  fixture.componentInstance.open(schedule);
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLInputElement & HTMLSelectElement;
const opciones = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLOptionElement>(`${sel} option`));

/** Los chips de día. `.on` es el marcado, que es lo que reemplazó al value del select. */
const chips = (f: { nativeElement: HTMLElement }) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('[data-test="dia"]'));
const diasMarcados = (f: { nativeElement: HTMLElement }) =>
  chips(f).filter((c) => c.classList.contains('on')).map((c) => c.textContent?.trim());
const chip = (f: { nativeElement: HTMLElement }, label: string) =>
  chips(f).find((c) => c.textContent?.trim() === label)!;
/** El trigger del reloj ya no es un <input>: lo elegido se lee del texto del botón. */
const hora = (f: { nativeElement: HTMLElement }, controlId: string) =>
  f.nativeElement.querySelector<HTMLElement>(`#${controlId} .tt-val`)!.textContent?.trim();

describe('HorarioFormModalComponent', () => {
  it('precarga los once campos en edición', () => {
    const f = setup(HORARIO);
    expect(el(f, '[data-test="cancha"]').value).toBe('10');
    expect(el(f, '[data-test="profesor"]').value).toBe('20');
    expect(el(f, '[data-test="grupo"]').value).toBe('30');
    expect(el(f, '[data-test="tipo"]').value).toBe('40');
    expect(diasMarcados(f)).toEqual(['Lunes']);
    expect(hora(f, 'horario-inicio')).toBe('18:00');
    expect(hora(f, 'horario-fin')).toBe('19:30');
    expect(el(f, '#horario-cupo').value).toBe('8');
    expect(el(f, '#horario-precio').value).toBe('12000');
    expect(el(f, '#horario-desde').value).toBe('2026-08-01');
    expect(el(f, '#horario-activo').checked).toBe(true);
  });

  it('en el ALTA los cuatro selects de lookup caen en el primer elemento', () => {
    const f = setup(null);
    expect(el(f, '[data-test="cancha"]').value).toBe('10');
    expect(el(f, '[data-test="tipo"]').value).toBe('40');
  });

  it('en el ALTA el día arranca en LUNES', () => {
    expect(diasMarcados(setup(null))).toEqual(['Lunes']);
  });

  it('en el ALTA los días son MÚLTIPLES: se marcan y se desmarcan', () => {
    const f = setup(null);
    chip(f, 'Miércoles').click();
    chip(f, 'Viernes').click();
    f.detectChanges();
    expect(diasMarcados(f)).toEqual(['Lunes', 'Miércoles', 'Viernes']);
    chip(f, 'Lunes').click();
    f.detectChanges();
    expect(diasMarcados(f)).toEqual(['Miércoles', 'Viernes']);
  });

  it('los días marcados viajan TODOS en el emit', () => {
    const f = setup(null);
    chip(f, 'Jueves').click();
    f.detectChanges();
    let emitido: { weekdays: readonly string[] } | undefined;
    f.componentInstance.saved.subscribe((v) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido?.weekdays).toEqual(['1', '4']);
  });

  it('en EDICIÓN los chips son excluyentes: marcar otro día REEMPLAZA', () => {
    // Una fila de la tabla es UNA plantilla con UN weekday: dejar marcar dos ofrecería algo
    // que el PATCH no puede hacer.
    const f = setup(HORARIO);
    chip(f, 'Sábado').click();
    f.detectChanges();
    expect(diasMarcados(f)).toEqual(['Sábado']);
  });

  it('en el ALTA activo arranca en true', () => {
    expect(el(setup(null), '#horario-activo').checked).toBe(true);
  });

  it('NINGUNO de los cuatro selects ofrece opción vacía: los cuatro son obligatorios', () => {
    const f = setup(HORARIO);
    for (const sel of ['cancha', 'profesor', 'grupo', 'tipo']) {
      expect(opciones(f, `[data-test="${sel}"]`).some((o) => o.value === '' && !o.disabled)).toBe(false);
    }
  });

  it('un valor guardado que ya no está en la lista NO cae en la primera opción', () => {
    const f = setup({ ...HORARIO, courtId: '99' });
    const sel = el(f, '[data-test="cancha"]');
    expect(sel.value).toBe('99');
    expect(sel.options[sel.selectedIndex].textContent?.trim()).toBe('(no disponible)');
  });

  it('el select muestra el valor guardado aunque el lookup llegue TARDE', () => {
    // Es la pieza que arregla el caso B del §4.2 del spec anterior: [value] a secas no
    // alcanza, hace falta [selected] en cada <option>.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(HorarioFormModalComponent);
    f.componentRef.setInput('courts', []);
    setInputsRestantes(f);
    f.detectChanges();
    f.componentInstance.open(HORARIO);
    f.detectChanges();
    f.componentRef.setInput('courts', COURTS);
    f.detectChanges();
    expect(el(f, '[data-test="cancha"]').value).toBe('10');
  });

  it('EDITAR un horario con weekday null NO marca ningún día', () => {
    // La instancia excepcional del slice. §6.4 dice que estas filas existen y que la tabla
    // las muestra, o sea que tienen botón Editar. Con el select viejo el riesgo era caer en
    // selectedIndex 0 y decir "Lunes" sobre una fila sin día; con chips el equivalente es
    // que NINGUNO quede marcado, y no que se marque el primero.
    expect(diasMarcados(setup({ ...HORARIO, weekday: null }))).toEqual([]);
  });

  it('editar un horario sin horas deja los relojes vacíos', () => {
    const f = setup({ ...HORARIO, startTime: null, endTime: null });
    expect(hora(f, 'horario-inicio')).toBe('--:--');
    expect(hora(f, 'horario-fin')).toBe('--:--');
  });

  it('reabrir el modal cierra el popup del reloj que había quedado abierto', () => {
    // Ninguno de los dos <dialog> se destruye entre aperturas, y el reloj guarda su propio
    // abierto/cerrado: sin el close() de open(), queda arriba mostrando la hora del horario
    // ANTERIOR.
    const f = setup(HORARIO);
    const root: HTMLElement = f.nativeElement;
    root.querySelector<HTMLButtonElement>('#horario-inicio')!.click();
    f.detectChanges();
    expect(root.querySelector('.dial-face')).toBeTruthy();
    f.componentInstance.open(null);
    f.detectChanges();
    expect(root.querySelector('.dial-face')).toBeNull();
  });

  it('reabrir en alta después de tipear deja el formulario limpio', () => {
    // El <dialog> no se destruye entre aperturas: la siembra es imperativa y por parámetro.
    const f = setup(HORARIO);
    f.componentInstance.open(null);
    f.detectChanges();
    expect(el(f, '#horario-cupo').value).toBe('');
    expect(el(f, '#horario-desde').value).toBe('');
  });

  it('el precio se siembra en el DOM aunque el valor se repita entre aperturas', () => {
    // El <input> es el MISMO nodo entre aperturas y Angular sólo escribe el DOM cuando la
    // expresión del binding CAMBIA. Por eso la siembra es un `.value =` directo.
    // Ver plan-form-modal.component.ts:195-212 para la explicación completa.
    const f = setup(null);
    el(f, '#horario-precio').value = '9999';
    el(f, '#horario-precio').dispatchEvent(new Event('input'));
    f.detectChanges();
    f.componentInstance.open(null);
    f.detectChanges();
    expect(el(f, '#horario-precio').value).toBe('');
  });

  it('avisa que la vigencia no se puede vaciar', () => {
    expect(setup(HORARIO).nativeElement.textContent).toContain('no volver a dejarlas vacías');
  });

  it('emite los valores crudos, sin validar', () => {
    const f = setup(HORARIO);
    let emitido: unknown;
    f.componentInstance.saved.subscribe((v: unknown) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido).toEqual({
      courtId: '10', coachId: '20', categoryGroupId: '30', sessionTypeId: '40',
      weekdays: ['1'], startTime: '18:00', endTime: '19:30',
      capacity: '8', price: '12000', active: true,
      validFrom: '2026-08-01', validTo: '',
    });
  });

  it('el checkbox usa el primitivo del DS', () => {
    const f = setup(HORARIO);
    expect(f.nativeElement.querySelector('.field #horario-activo')).toBeNull();
    expect(f.nativeElement.querySelector('.checkbox-row #horario-activo')).toBeTruthy();
  });

  it('Guardar queda deshabilitado mientras se guarda', () => {
    const f = setupConSaving(HORARIO, true);
    expect((f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('cuando aparece un error, el cuerpo del modal vuelve arriba', () => {
    // Con 11 campos el modal SIEMPRE scrollea: el .notice queda en scrollTop 0 y la persona
    // está abajo, en Guardar. Sin esto, las nueve invariantes de createScheduleDraft son
    // invisibles (§8.3).
    const f = setup(HORARIO);
    const body = f.nativeElement.querySelector('.modal-body') as HTMLElement;
    body.scrollTop = 400;
    f.componentRef.setInput('error', 'La hora de fin tiene que ser posterior a la de inicio.');
    f.detectChanges();
    expect(body.scrollTop).toBe(0);
  });
});
