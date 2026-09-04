import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlaceholderComponent, type PlaceholderTone } from './placeholder.component';

/** Monta el primitivo con un tone y devuelve el elemento que lleva el rol. */
async function mount(tone: PlaceholderTone) {
  await TestBed.configureTestingModule({
    imports: [PlaceholderComponent],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();

  const fixture = TestBed.createComponent(PlaceholderComponent);
  fixture.componentRef.setInput('tone', tone);
  fixture.componentRef.setInput('title', 'Nada por acá');
  await fixture.whenStable();
  return fixture;
}

describe('PlaceholderComponent', () => {
  // El mapeo tone → rol ARIA es la única lógica del primitivo, y es la que arregla
  // los 12 textos de carga que hoy no se anuncian a lectores de pantalla.
  const CASOS: readonly [PlaceholderTone, string | null][] = [
    ['empty', null],
    ['error', 'alert'],
    ['loading', 'status'],
    ['wip', null],
  ];

  for (const [tone, rol] of CASOS) {
    it(`tone="${tone}" declara role=${rol ?? 'ninguno'}`, async () => {
      const fixture = await mount(tone);
      const bloque = fixture.nativeElement.querySelector('.ph') as HTMLElement;

      expect(bloque).toBeTruthy();
      expect(bloque.getAttribute('role')).toBe(rol);
    });
  }

  it('muestra el title y el body', async () => {
    const fixture = await mount('empty');
    fixture.componentRef.setInput('body', 'Cargá el primero desde el botón de arriba.');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Nada por acá');
    expect(fixture.nativeElement.textContent).toContain('Cargá el primero');
  });

  it('sin body no renderiza el párrafo de body', async () => {
    const fixture = await mount('empty');

    expect(fixture.nativeElement.querySelector('.ph-body')).toBeNull();
  });

  it('size="page" marca el bloque, size="inline" no', async () => {
    const fixture = await mount('empty');
    const bloque = fixture.nativeElement.querySelector('.ph') as HTMLElement;
    expect(bloque.classList.contains('ph-page')).toBe(false);

    fixture.componentRef.setInput('size', 'page');
    await fixture.whenStable();
    expect(bloque.classList.contains('ph-page')).toBe(true);
  });

  it('la ilustración está oculta a lectores de pantalla', async () => {
    const fixture = await mount('error');
    const art = fixture.nativeElement.querySelector('.ph-art') as HTMLElement;

    expect(art.getAttribute('aria-hidden')).toBe('true');
  });
});
