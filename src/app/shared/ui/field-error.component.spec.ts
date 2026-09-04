import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FieldErrorComponent } from './field-error.component';

async function render(show: boolean, message: string) {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(FieldErrorComponent);
  fixture.componentRef.setInput('show', show);
  fixture.componentRef.setInput('message', message);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FieldErrorComponent', () => {
  it('no renderiza nada si show=false', async () => {
    const el = await render(false, 'Error X');
    expect(el.querySelector('.err-msg')).toBeNull();
  });
  it('renderiza el mensaje con role=alert si show=true', async () => {
    const el = await render(true, 'Ingresá tu email.');
    const msg = el.querySelector('.err-msg');
    expect(msg?.getAttribute('role')).toBe('alert');
    expect(msg?.textContent).toContain('Ingresá tu email.');
  });
});
