import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ICONS } from '@config/icons';
import { IconComponent } from './icon.component';

function mount(name: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ICONS, useValue: { pelota: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>' } },
    ],
  });
  const fixture = TestBed.createComponent(IconComponent);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('IconComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renderiza el markup del registro y queda oculto a lectores de pantalla', () => {
    const el = mount('pelota');
    expect(el.querySelector('svg circle')).toBeTruthy();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains('icon')).toBe(true);
  });

  it('un nombre desconocido renderiza vacío y avisa por consola', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = mount('inexistente');
    expect(el.querySelector('svg')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('inexistente'));
  });
});
