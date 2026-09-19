import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ToastHostComponent } from './toast-host.component';
import { ToastService } from './toast.service';

function mount() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const svc = TestBed.inject(ToastService);
  const fixture = TestBed.createComponent(ToastHostComponent);
  fixture.detectChanges();
  return { fixture, svc, el: fixture.nativeElement as HTMLElement };
}

describe('ToastHostComponent', () => {
  it('el contenedor es una región live cortés', () => {
    const { el } = mount();
    const wrap = el.querySelector('.toasts')!;
    expect(wrap.getAttribute('role')).toBe('status');
    expect(wrap.getAttribute('aria-live')).toBe('polite');
  });

  it('renderiza el stack con título y detalle', () => {
    const { fixture, svc, el } = mount();
    svc.show('ok', 'Cupo liberado', '7ma · Cancha 1 · 18:00');
    svc.show('info', 'No se pudo cancelar', 'Revisá tu conexión.');
    fixture.detectChanges();

    expect(el.querySelectorAll('.toast').length).toBe(2);
    expect(el.querySelector('.t-t')?.textContent).toContain('Cupo liberado');
    expect(el.querySelector('.t-d')?.textContent).toContain('7ma · Cancha 1 · 18:00');
  });

  it('aplica la clase de variante', () => {
    const { fixture, svc, el } = mount();
    svc.show('ok', 'a', '1');
    svc.show('info', 'b', '2');
    fixture.detectChanges();
    expect(el.querySelectorAll('.toast.ok').length).toBe(1);
    expect(el.querySelectorAll('.toast.info').length).toBe(1);
  });

  it('el ícono cambia según el tipo', () => {
    const { fixture, svc, el } = mount();
    svc.show('ok', 'a', '1');
    fixture.detectChanges();
    // 'ok' → check; 'info' → exclamación (docs/maquetas/index-v2.html:1430-1432)
    expect(el.querySelector('.toast.ok .t-ic path')?.getAttribute('d')).toBe('M5 12l5 5 9-11');

    svc.show('info', 'b', '2');
    fixture.detectChanges();
    expect(el.querySelector('.toast.info .t-ic path')?.getAttribute('d')).toBe('M12 8v5M12 16v.01');
  });

  it('aplica .out cuando el toast está saliendo', () => {
    const { fixture, svc, el } = mount();
    svc.show('ok', 'a', '1');
    fixture.detectChanges();
    expect(el.querySelector('.toast')?.classList.contains('out')).toBe(false);

    svc.dismiss(svc.toasts()[0].id);
    fixture.detectChanges();
    expect(el.querySelector('.toast')?.classList.contains('out')).toBe(true);
  });
});
