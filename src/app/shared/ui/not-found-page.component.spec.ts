import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundPageComponent } from './not-found-page.component';

describe('NotFoundPageComponent', () => {
  it('explica que la página no existe y ofrece volver al panel', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotFoundPageComponent);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No encontramos esta página');

    // El bloque es el de pantalla completa y se anuncia como alerta.
    const bloque = el.querySelector('.ph') as HTMLElement;
    expect(bloque.classList.contains('ph-page')).toBe(true);
    expect(bloque.getAttribute('role')).toBe('alert');

    const volver = el.querySelector('a[href="/dashboard"]');
    expect(volver).toBeTruthy();
  });
});
