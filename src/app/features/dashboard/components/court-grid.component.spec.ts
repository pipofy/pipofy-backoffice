import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CourtGridComponent } from './court-grid.component';
import { CourtGrid } from '@domain/entities/dashboard-snapshot';

const grid: CourtGrid = {
  courts: [
    { name: 'Cancha 1', meta: 'Cemento · Techada' },
    { name: 'Central', meta: 'Polvo de ladrillo · Descubierta' },
  ],
  hours: ['16:00'],
  sessions: [
    [
      {
        id: '10',
        category: '8va',
        professor: 'Diego A.',
        occupied: 4,
        capacity: 4,
        state: 'full',
      },
      null,
    ],
  ],
};

function mount() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(CourtGridComponent);
  fixture.componentRef.setInput('grid', grid);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('CourtGridComponent', () => {
  it('renderiza encabezados de cancha con su meta', () => {
    const { el } = mount();
    expect(el.querySelectorAll('.court-grid .ch:not(.corner)').length).toBe(2);
    expect(el.textContent).toContain('Cemento · Techada');
  });

  it('renderiza una sesión con ocupación y flag, y un slot vacío', () => {
    const { el } = mount();
    const sess = el.querySelector('.sess');
    expect(sess?.classList.contains('full')).toBe(true);
    expect(sess?.textContent).toContain('8va');
    expect(sess?.textContent).toContain('4/4');
    expect(el.querySelector('.slot.empty')).toBeTruthy();
  });

  it('marca el flag correcto según el estado', () => {
    const { el } = mount();
    expect(el.querySelector('.s-flag')).toBeNull(); // 'full' no lleva flag
  });

  it('no divide por cero cuando la sesión no tiene cupo cargado', () => {
    // capacity: 0 es real contra la API: ClassSession.capacity es nullable y el mapper lo
    // normaliza a 0 (spec §3.3). Sin la guarda de pct(), el ancho de la barra sale NaN.
    const grid: CourtGrid = {
      courts: [{ name: 'Cancha 1', meta: 'Cemento · Techada' }],
      hours: ['18:00'],
      sessions: [
        [
          {
            id: '10',
            category: '7ma',
            professor: 'Diego A.',
            occupied: 0,
            capacity: 0,
            state: 'full',
          },
        ],
      ],
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CourtGridComponent);
    fixture.componentRef.setInput('grid', grid);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.occ-bar i') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  // jsdom no calcula layout, así que no se puede medir cuántas columnas ocupa realmente la
  // grilla. Lo que sí se puede verificar es que el número de canchas llegue al CSS como
  // custom property `--n` (court-grid.component.css usa `repeat(var(--n), ...)`): si alguien
  // vuelve a cablear un número fijo de columnas en el CSS, este test no lo detecta, pero si
  // alguien deja de pasar `--n` desde el template, sí.
  it.each([3, 5])('escribe --n con el número de canchas del input (%i canchas)', (n) => {
    // Con `hours: []` la grilla no se dibuja: entra el estado vacío "no hay clases hoy".
    // Hace falta al menos una fila para que `.court-grid` exista y tenga el `--n`.
    const manyCourts: CourtGrid = {
      courts: Array.from({ length: n }, (_, i) => ({ name: `Cancha ${i + 1}`, meta: '' })),
      hours: ['18:00'],
      sessions: [Array.from({ length: n }, () => null)],
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CourtGridComponent);
    fixture.componentRef.setInput('grid', manyCourts);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.court-grid') as HTMLElement;
    expect(el.style.getPropertyValue('--n')).toBe(String(n));
  });

  // El test de arriba (--n en el estilo inline) NO alcanza por sí solo: se puede escribir --n
  // y de todos modos tener el CSS cableado a un número fijo (repeat(4, ...)), que es
  // exactamente el bug original — jsdom no calcula layout, así que no hay forma de detectarlo
  // midiendo la grilla renderizada. La única forma de que el candado exista es leer el CSS
  // real. Angular inlina el contenido de styleUrl en `ɵcmp.styles` en tiempo de compilación
  // (confirmado inspeccionándolo): es el CSS que termina sirviéndose, con selectores de
  // encapsulación agregados pero sin tocar los valores de las declaraciones, así que sirve
  // igual que leer el archivo — y no depende de resolver rutas de filesystem, que el bundler
  // de test (esbuild, plataforma browser) no soporta.
  it('court-grid.component.css define las columnas con var(--n), no con un número fijo', () => {
    const cmp = (CourtGridComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp;
    const css = cmp.styles.join('\n');
    const rule = css.match(/\.court-grid\[[^\]]*\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('repeat(var(--n)');
    expect(rule).not.toMatch(/repeat\(\d/);
  });

  it('sin canchas cargadas muestra el placeholder de vacío con la ruta a Configuración', () => {
    const emptyGrid: CourtGrid = { courts: [], hours: [], sessions: [] };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CourtGridComponent);
    fixture.componentRef.setInput('grid', emptyGrid);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Todavía no hay canchas cargadas');
    expect(el.textContent).toContain('Configuración → Canchas');
  });

  it('con canchas pero sin horas muestra el placeholder de "no hay clases hoy"', () => {
    const noHoursGrid: CourtGrid = {
      courts: [{ name: 'Cancha 1', meta: 'Cemento · Techada' }],
      hours: [],
      sessions: [],
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(CourtGridComponent);
    fixture.componentRef.setInput('grid', noHoursGrid);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No hay clases programadas para hoy');
  });

  it('el texto accesible de la celda menciona cancha, hora y profesor', () => {
    // El profesor vive en .s-prof, dentro del .sess que quedó aria-hidden: si no está también
    // en el .sr-only, un lector de pantalla deja de anunciarlo (regresión sobre la regresión).
    const { el } = mount();
    const srText = el.querySelector('.slot .sr-only')?.textContent ?? '';
    expect(srText).toContain('Cancha 1');
    expect(srText).toContain('16:00');
    expect(srText).toContain('completa'); // state: 'full' → 'completa'
    expect(srText).toContain('Diego A.'); // nombre completo, no las iniciales ('D')
  });
});
