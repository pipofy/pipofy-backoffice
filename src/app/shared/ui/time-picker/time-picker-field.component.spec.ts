import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TimePickerFieldComponent } from './time-picker-field.component';
import { TimeDialComponent } from './time-dial.component';

function setup(value = ''): ComponentFixture<TimePickerFieldComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const f = TestBed.createComponent(TimePickerFieldComponent);
  f.componentRef.setInput('value', value);
  f.componentRef.setInput('controlId', 'hora-test');
  f.componentRef.setInput('label', 'Hora de inicio');
  f.detectChanges();
  return f;
}

const root = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const tick = (f: ComponentFixture<unknown>, label: string) =>
  Array.from(root(f).querySelectorAll<HTMLButtonElement>('.tick'))
    .find((b) => b.textContent?.trim() === label)!;
const trigger = (f: ComponentFixture<unknown>) => root(f).querySelector<HTMLButtonElement>('#hora-test')!;
const listo = (f: ComponentFixture<unknown>) => root(f).querySelector<HTMLButtonElement>('[data-test="time-ok"]')!;
const porTexto = (f: ComponentFixture<unknown>, texto: string) =>
  Array.from(root(f).querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === texto)!;

describe('TimePickerFieldComponent', () => {
  it('sin valor muestra el placeholder y no abre nada solo', () => {
    const f = setup();
    expect(trigger(f).textContent).toContain('--:--');
    expect(root(f).querySelector('.dial-face')).toBeNull();
  });

  it('muestra la hora que recibe', () => {
    expect(trigger(setup('18:30')).textContent).toContain('18:30');
  });

  it('elegir hora y minuto y confirmar emite HH:mm', () => {
    const f = setup();
    let emitido: string | undefined;
    f.componentInstance.valueChange.subscribe((v) => { emitido = v; });
    trigger(f).click();
    f.detectChanges();
    tick(f, '9').click();
    f.detectChanges();
    tick(f, '45').click();
    f.detectChanges();
    listo(f).click();
    expect(emitido).toBe('09:45');
  });

  it('elegir la hora pasa SOLO a la vista de minutos', () => {
    const f = setup();
    trigger(f).click();
    f.detectChanges();
    // En la vista de horas hay 24 marcas (dos anillos); en la de minutos, 12.
    expect(root(f).querySelectorAll('.tick').length).toBe(24);
    tick(f, '9').click();
    f.detectChanges();
    expect(root(f).querySelectorAll('.tick').length).toBe(12);
  });

  it('cancelar NO emite: la hora anterior queda como estaba', () => {
    const f = setup('18:00');
    let emitido: string | undefined;
    f.componentInstance.valueChange.subscribe((v) => { emitido = v; });
    trigger(f).click();
    f.detectChanges();
    tick(f, '7').click();
    f.detectChanges();
    porTexto(f, 'Cancelar').click();
    f.detectChanges();
    expect(emitido).toBeUndefined();
    expect(trigger(f).textContent).toContain('18:00');
  });

  it('reabrir arranca de nuevo en la hora del input, no en lo tocado la vez anterior', () => {
    // El borrador es del POPUP, no del campo: cancelar y volver a abrir tiene que mostrar el
    // valor de afuera. Con el mismo valor entre aperturas es donde un effect() fallaría.
    const f = setup('18:00');
    trigger(f).click();
    f.detectChanges();
    tick(f, '7').click();
    f.detectChanges();
    porTexto(f, 'Cancelar').click();
    f.detectChanges();
    trigger(f).click();
    f.detectChanges();
    expect(root(f).querySelector('.dial-head .unit')!.textContent?.trim()).toBe('18');
  });

  it('reabrir vuelve a la vista de HORAS aunque se haya cerrado en minutos', () => {
    const f = setup('18:00');
    trigger(f).click();
    f.detectChanges();
    tick(f, '7').click();
    f.detectChanges();
    expect(root(f).querySelectorAll('.tick').length).toBe(12);
    porTexto(f, 'Cancelar').click();
    f.detectChanges();
    trigger(f).click();
    f.detectChanges();
    expect(root(f).querySelectorAll('.tick').length).toBe(24);
  });

  it('Listo queda deshabilitado mientras no haya hora elegida', () => {
    const f = setup();
    trigger(f).click();
    f.detectChanges();
    expect(listo(f).disabled).toBe(true);
    tick(f, '9').click();
    f.detectChanges();
    expect(listo(f).disabled).toBe(false);
  });
});

describe('TimeDialComponent', () => {
  function dial(value: string): ComponentFixture<TimeDialComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const f = TestBed.createComponent(TimeDialComponent);
    f.componentRef.setInput('value', value);
    f.detectChanges();
    return f;
  }

  it('marca la hora que recibe, y el 00 del anillo interno no se confunde con el 12', () => {
    // 00 y 12 comparten posición (arriba); lo que los distingue es el anillo, o sea el radio.
    const f = dial('00:00');
    const marcada = Array.from(root(f).querySelectorAll<HTMLElement>('.tick.on'));
    expect(marcada).toHaveLength(1);
    expect(marcada[0].textContent?.trim()).toBe('00');
  });

  it('elegir hora conserva los minutos que ya había', () => {
    const f = dial('18:45');
    let emitido: string | undefined;
    f.componentInstance.valueChange.subscribe((v) => { emitido = v; });
    Array.from(root(f).querySelectorAll<HTMLButtonElement>('.tick'))
      .find((b) => b.textContent?.trim() === '20')!.click();
    expect(emitido).toBe('20:45');
  });

  it('sin valor, elegir sólo la hora emite HH:00 y no una hora a medio armar', () => {
    const f = dial('');
    let emitido: string | undefined;
    f.componentInstance.valueChange.subscribe((v) => { emitido = v; });
    Array.from(root(f).querySelectorAll<HTMLButtonElement>('.tick'))
      .find((b) => b.textContent?.trim() === '8')!.click();
    expect(emitido).toBe('08:00');
  });

  it('sin valor no dibuja la aguja: no hay nada que señalar', () => {
    expect(root(dial('')).querySelector('.hand')).toBeNull();
    expect(root(dial('08:00')).querySelector('.hand')).toBeTruthy();
  });
});
