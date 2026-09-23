import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '@config/app-config';
import { SiteFooterComponent } from './site-footer.component';

/** Monta el footer con la marca dada y devuelve el fixture ya estable. */
async function mount(brand: typeof DEFAULT_APP_CONFIG.brand) {
  await TestBed.configureTestingModule({
    imports: [SiteFooterComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, brand } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SiteFooterComponent);
  await fixture.whenStable();
  return fixture;
}

describe('SiteFooterComponent', () => {
  it('con tagline y links renderiza el tagline, los labels y los <a href="#">', async () => {
    const fixture = await mount({
      name: 'PipoFy',
      tagline: 'El backoffice de tu club',
      logoHorizontal: 'brand/logo-horizontal.svg',
      footerLinks: [
        { label: 'Términos', href: null },
        { label: 'Privacidad', href: null },
        { label: 'Soporte', href: null },
      ],
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sf-blurb')?.textContent).toContain('El backoffice de tu club');
    const links = Array.from(el.querySelectorAll('nav a')) as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Términos', 'Privacidad', 'Soporte']);
    expect(links.every((a) => a.getAttribute('href') === '#')).toBe(true);
  });

  it('un link con href real renderiza <a> con ese href (routerLink), sin href="#"', async () => {
    const fixture = await mount({
      name: 'PipoFy',
      tagline: '',
      logoHorizontal: 'brand/logo-horizontal.svg',
      footerLinks: [{ label: 'Términos', href: '/terminos' }],
    });
    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('nav a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/terminos');
    expect(el.querySelector('a[href="#"]')).toBeNull();
  });

  it('con el default del kernel (tagline y links vacíos) no renderiza .sf-blurb ni nav', async () => {
    const fixture = await mount(DEFAULT_APP_CONFIG.brand);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sf-blurb')).toBeNull();
    expect(el.querySelector('nav')).toBeNull();
  });

  it('el © lleva el año actual y brand.name', async () => {
    const fixture = await mount({
      name: 'PipoFy',
      tagline: '',
      logoHorizontal: 'brand/logo-horizontal.svg',
      footerLinks: [],
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sf-legal span')?.textContent).toBe(
      `© ${new Date().getFullYear()} PipoFy`,
    );
  });
});
