import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AlumnoFormModalComponent } from './alumno-form-modal.component';
import { Student } from '@domain/entities/student';
import { Category } from '@domain/entities/category';

const CATEGORIAS: Category[] = [
  { id: '4', name: 'Cuarta', levelOrder: 4 },
  { id: '5', name: 'Quinta', levelOrder: 5 },
];

const ESTADOS = [
  { id: '1', name: 'active' },
  { id: '2', name: 'pending_classification' },
];

const ALUMNO: Student = {
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '5', studentStatusId: '1',
  dominantHand: 'zurdo', ranking: 12, notes: 'Buen revés',
};

const SIN_DATOS: Student = {
  id: '2', phone: '1199887766', firstName: '', lastName: '',
  birthDate: null, categoryId: null, studentStatusId: '2',
  dominantHand: null, ranking: null, notes: null,
};

function setup(alumno: Student | null, error = '', categorias = CATEGORIAS, estados = ESTADOS) {
  // reset explícito: el test del select llama setup() más de una vez DENTRO del mismo it(), y
  // TestBed no deja reconfigurar un módulo ya instanciado sin esto (mismo patrón que
  // plan-form-modal.component.spec.ts y cancha-form-modal.component.spec.ts).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(AlumnoFormModalComponent);
  fixture.componentRef.setInput('categories', categorias);
  fixture.componentRef.setInput('statuses', estados);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open(alumno);
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
const opciones = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLOptionElement>(`${sel} option`));

describe('AlumnoFormModalComponent', () => {
  it('precarga todos los campos en edición', () => {
    const f = setup(ALUMNO);
    expect(el(f, '#alumno-telefono').value).toBe('1155667788');
    expect(el(f, '#alumno-nombre').value).toBe('Ana');
    expect(el(f, '#alumno-apellido').value).toBe('Pérez');
    expect(el(f, '#alumno-nacimiento').value).toBe('2001-05-03');
    expect(el(f, '[data-test="alumno-categoria"]').value).toBe('5');
    expect(el(f, '[data-test="alumno-mano"]').value).toBe('zurdo');
    expect(el(f, '#alumno-ranking').value).toBe('12');
    expect(el(f, '#alumno-notas').value).toBe('Buen revés');
  });

  it('el teléfono es editable en el alta', () => {
    expect(el(setup(null), '#alumno-telefono').readOnly).toBe(false);
  });

  it('el teléfono es READONLY en la edición, con su aviso', () => {
    // students.service.update() no incluye phone en el data: de Prisma (§3.1): editarlo
    // devuelve 200 y no cambia nada. Ofrecerlo editable sería mentir en silencio.
    const f = setup(ALUMNO);
    expect(el(f, '#alumno-telefono').readOnly).toBe(true);
    expect(f.nativeElement.textContent).toContain('El teléfono no se puede cambiar');
  });

  it('readonly y NO disabled: un disabled no es enfocable y rompería el autofocus', () => {
    expect(el(setup(ALUMNO), '#alumno-telefono').disabled).toBe(false);
  });

  it('reabrir en alta después de tipear deja el formulario vacío', () => {
    const f = setup(null);
    el(f, '#alumno-nombre').value = 'Beto';
    el(f, '#alumno-nombre').dispatchEvent(new Event('input'));
    f.detectChanges();
    f.componentInstance.open(null);
    f.detectChanges();
    expect(el(f, '#alumno-nombre').value).toBe('');
  });

  it('la categoría ofrece vaciarse sólo mientras el alumno no tiene ninguna', () => {
    // categoryId se OMITE cuando es null (BigInt(null) → 500) y omitirlo no lo borra.
    expect(opciones(setup(SIN_DATOS), '[data-test="alumno-categoria"]').some((o) => o.value === '')).toBe(true);
    expect(opciones(setup(ALUMNO), '[data-test="alumno-categoria"]').some((o) => o.value === '')).toBe(false);
  });

  it('la mano hábil SIEMPRE ofrece vaciarse', () => {
    // dominantHand es un String? libre: mandarlo en null lo borra sin problema (§3.3).
    expect(opciones(setup(ALUMNO), '[data-test="alumno-mano"]').some((o) => o.value === '')).toBe(true);
  });

  it('una categoría que ya no está en la lista no cae en la primera opción', () => {
    const f = setup({ ...ALUMNO, categoryId: '99' });
    const select = el(f, '[data-test="alumno-categoria"]');
    expect(select.value).toBe('99');
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('(no disponible)');
  });

  it('el select muestra la categoría guardada aunque la lista llegue tarde', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(AlumnoFormModalComponent);
    f.componentRef.setInput('categories', []);
    f.componentRef.setInput('statuses', ESTADOS);
    f.componentRef.setInput('error', '');
    f.detectChanges();
    f.componentInstance.open(ALUMNO);
    f.detectChanges();
    f.componentRef.setInput('categories', CATEGORIAS);
    f.detectChanges();
    expect(el(f, '[data-test="alumno-categoria"]').value).toBe('5');
  });

  it('avisa que la fecha no se puede vaciar, sólo cuando ya hay una', () => {
    expect(setup(ALUMNO).nativeElement.textContent).toContain('no volver a dejar vacía');
    expect(setup(SIN_DATOS).nativeElement.textContent).not.toContain('no volver a dejar vacía');
  });

  it('vaciar la fecha de un alumno que ya la tenía emite vacío, sin rescatarla', () => {
    // El modal emite lo que hay en el campo y nada más. Que vaciarla no la borre lo garantiza
    // toStudentRequest omitiendo la clave (ver 'OMITE birthDate cuando es null' en
    // student.mapper.spec.ts), no un rescate acá: si el backend algún día acepta vaciarla,
    // se toca el mapper y esto no tiene que estar resucitando la fecha vieja por su cuenta.
    const f = setup(ALUMNO);
    let emitido: { birthDate: string } | undefined;
    f.componentInstance.saved.subscribe((v: { birthDate: string }) => { emitido = v; });
    el(f, '#alumno-nacimiento').value = '';
    el(f, '#alumno-nacimiento').dispatchEvent(new Event('input'));
    f.detectChanges();
    // ComponentFixture.nativeElement es `any`: pasar un genérico explícito a querySelector sobre
    // una expresión `any` da TS2347. Se castea el resultado en vez de tipar la llamada, mismo
    // patrón que plan-form-modal.component.spec.ts y cancha-form-modal.component.spec.ts.
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido!.birthDate).toBe('');
  });

  it('en un alumno sin fecha, dejarla vacía emite vacío', () => {
    const f = setup(SIN_DATOS);
    let emitido: { birthDate: string } | undefined;
    f.componentInstance.saved.subscribe((v: { birthDate: string }) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido!.birthDate).toBe('');
  });

  it('el estado NO se ofrece en el alta: el backend no acepta la clave ahí', () => {
    // CreateStudentDto no declara studentStatusId — lo fuerza a 'pending_classification'.
    // Un select acá prometería algo que la request no puede cumplir.
    expect(setup(null).nativeElement.querySelector('[data-test="alumno-estado"]')).toBeNull();
  });

  it('el estado se precarga y se humaniza en la edición', () => {
    const f = setup(ALUMNO);
    expect(el(f, '[data-test="alumno-estado"]').value).toBe('1');
    expect(opciones(f, '[data-test="alumno-estado"]').map((o) => o.textContent?.trim()))
      .toEqual(['Activo', 'Sin clasificar']);
  });

  it('el estado no ofrece vaciarse: la columna es NOT NULL', () => {
    const f = setup(ALUMNO);
    expect(opciones(f, '[data-test="alumno-estado"]').some((o) => o.value === '')).toBe(false);
  });

  it('un estado fuera del catálogo no cae en la primera opción', () => {
    // Mismo hazard que la categoría: si el catálogo no cargó, [value] a secas deja
    // selectedIndex 0 y la pantalla muestra "Activo" sobre un alumno que no lo está.
    const f = setup(ALUMNO, '', CATEGORIAS, []);
    const select = el(f, '[data-test="alumno-estado"]');
    expect(select.value).toBe('1');
    expect(opciones(f, '[data-test="alumno-estado"]')[0].disabled).toBe(true);
  });

  it('emite los valores crudos, sin validar', () => {
    const f = setup(ALUMNO);
    let emitido: unknown;
    f.componentInstance.saved.subscribe((v: unknown) => { emitido = v; });
    (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    expect(emitido).toEqual({
      phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
      birthDate: '2001-05-03', categoryId: '5', studentStatusId: '1', dominantHand: 'zurdo',
      ranking: '12', notes: 'Buen revés',
    });
  });

  it('muestra el error adentro del modal', () => {
    const f = setup(null, 'Ya existe un alumno con ese teléfono en este club');
    expect(f.nativeElement.querySelector('.notice')!.textContent).toContain('Ya existe un alumno');
  });
});
