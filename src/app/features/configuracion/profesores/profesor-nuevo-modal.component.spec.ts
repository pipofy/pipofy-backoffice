import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProfesorNuevoModalComponent } from './profesor-nuevo-modal.component';
import { NewUserInput } from '@domain/entities/new-user';

function setup(error = '') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(ProfesorNuevoModalComponent);
  fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  fixture.componentInstance.open();
  fixture.detectChanges();
  return fixture;
}

const input = (f: { nativeElement: HTMLElement }, id: string) =>
  f.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

const escribir = (
  f: { nativeElement: HTMLElement; detectChanges: () => void },
  id: string,
  valor: string,
) => {
  const el = input(f, id);
  el.value = valor;
  el.dispatchEvent(new Event('input'));
  f.detectChanges();
};

const guardar = (f: { nativeElement: HTMLElement }) =>
  (f.nativeElement.querySelector('[data-test="save"]') as HTMLButtonElement).click();

describe('ProfesorNuevoModalComponent', () => {
  it('abre vacío', () => {
    const f = setup();
    expect(input(f, 'profesor-email').value).toBe('');
    expect(input(f, 'profesor-nombre').value).toBe('');
    expect(input(f, 'profesor-apellido').value).toBe('');
  });

  it('emite los tres campos', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    escribir(f, 'profesor-nombre', 'Ana');
    escribir(f, 'profesor-apellido', 'Pérez');
    guardar(f);
    expect(emitidos).toEqual([{ email: 'ana@club.com', nombre: 'Ana', apellido: 'Pérez' }]);
  });

  it('con un email inválido NO emite', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'no-es-un-email');
    guardar(f);
    expect(emitidos).toEqual([]);
  });

  it('el segundo click seguido NO reemite', () => {
    // En zoneless el input `error`/estado del padre no se propaga entre dos clicks: el guard
    // tiene que estar en el componente, no sólo en [disabled].
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    guardar(f);
    guardar(f);
    expect(emitidos).toHaveLength(1);
  });

  it('markFailed() vuelve a habilitar el envío', () => {
    const f = setup();
    const emitidos: NewUserInput[] = [];
    f.componentInstance.saved.subscribe((v: NewUserInput) => emitidos.push(v));
    escribir(f, 'profesor-email', 'ana@club.com');
    guardar(f);
    f.componentInstance.markFailed();
    f.detectChanges();
    guardar(f);
    expect(emitidos).toHaveLength(2);
  });

  it('reabrir limpia lo tipeado', () => {
    const f = setup();
    escribir(f, 'profesor-email', 'ana@club.com');
    f.componentInstance.open();
    f.detectChanges();
    expect(input(f, 'profesor-email').value).toBe('');
  });

  it('muestra el error DENTRO del modal', () => {
    // El .notice de la página queda detrás del ::backdrop, que tiene scrim + blur.
    expect(setup('Ya existe un usuario con ese email').nativeElement.textContent).toContain(
      'Ya existe un usuario con ese email',
    );
  });

  it('avisa que se manda un mail con contraseña temporal', () => {
    expect(setup().nativeElement.textContent).toContain('contraseña temporal');
  });
});
