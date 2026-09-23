import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '@config/app-config';
import { BrandmarkComponent } from './brandmark.component';

async function mount() {
  await TestBed.configureTestingModule({
    imports: [BrandmarkComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: APP_CONFIG,
        useValue: {
          ...DEFAULT_APP_CONFIG,
          brand: { ...DEFAULT_APP_CONFIG.brand, name: 'PipoFy', logoHorizontal: 'brand/logo-horizontal.svg' },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BrandmarkComponent);
  await fixture.whenStable();
  return fixture;
}

describe('BrandmarkComponent', () => {
  it('renderiza el img con src/alt de la marca y el aria-label por defecto', async () => {
    const fixture = await mount();
    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('img') as HTMLImageElement;
    const a = el.querySelector('a') as HTMLAnchorElement;

    expect(img.getAttribute('src')).toBe('brand/logo-horizontal.svg');
    expect(img.getAttribute('alt')).toBe('PipoFy');
    expect(a.getAttribute('aria-label')).toBe('PipoFy · ir al panel');
  });

  it('un ariaLabel explícito reemplaza el default', async () => {
    const fixture = await mount();
    fixture.componentRef.setInput('ariaLabel', 'Ir al inicio');
    await fixture.whenStable();
    const a = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(a.getAttribute('aria-label')).toBe('Ir al inicio');
  });
});
