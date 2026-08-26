import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AlumnoPlanesModalComponent } from './alumno-planes-modal.component';
import { AlumnoPlanesFacade } from './alumno-planes.facade';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { StudentPlan } from '@domain/entities/student-plan';
import { Student } from '@domain/entities/student';
import { Plan } from '@domain/entities/plan';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';

const ALUMNO: Student = {
  id: '7', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: null, categoryId: null, studentStatusId: '2',
  dominantHand: null, ranking: null, notes: null,
};

const PLANES = [
  { id: '10', name: 'Mensual 8 clases', price: '96000', active: true } as Plan,
  { id: '11', name: 'Plan viejo', price: '1000', active: false } as Plan,
];

const MEDIOS = [{ id: '3', name: 'efectivo' }];

function catalogsDouble() {
  return {
    paymentMethods: async () => MEDIOS,
  } as unknown as CatalogsRepository;
}

const sp = (over: Partial<StudentPlan> = {}): StudentPlan => ({
  id: '1', planId: '10', purchasedAt: '2026-08-01',
  creditsTotal: 8, creditsRemaining: 5, expiresAt: '2099-01-01', ...over,
});

interface Extras {
  readonly purchasePlan?: (studentId: string, draft: unknown) => Promise<void>;
  readonly catalogs?: CatalogsRepository;
}

async function mount(plans: () => Promise<StudentPlan[]>, extras: Extras = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      AlumnoPlanesFacade,
      {
        provide: StudentsRepository,
        useValue: { plans, purchasePlan: extras.purchasePlan ?? (async () => undefined) },
      },
      { provide: PlansRepository, useValue: { list: async () => PLANES } },
      { provide: CatalogsRepository, useValue: extras.catalogs ?? catalogsDouble() },
    ],
  });
  const fixture = TestBed.createComponent(AlumnoPlanesModalComponent);
  fixture.detectChanges();
  await fixture.componentInstance.open(ALUMNO);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function setup(plans: () => Promise<StudentPlan[]>) {
  return (await mount(plans)).nativeElement as HTMLElement;
}

describe('AlumnoPlanesModalComponent', () => {
  it('lista los planes con nombre, créditos y vencimiento', async () => {
    const root = await setup(async () => [sp()]);
    const fila = root.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('Mensual 8 clases');
    expect(fila.textContent).toContain('5');
    expect(fila.textContent).toContain('2099-01-01');
  });

  it('muestra los créditos utilizables en el encabezado', async () => {
    const root = await setup(async () => [sp({ id: '1', creditsRemaining: 5 }), sp({ id: '2', creditsRemaining: 2 })]);
    expect(root.querySelector('[data-test="creditos-totales"]')!.textContent).toContain('7');
  });

  // Un plan vencido con créditos se lee como crédito disponible y no lo es: sin la marca,
  // la pantalla miente sobre lo que el alumno puede usar.
  it('marca los planes vencidos', async () => {
    const root = await setup(async () => [sp({ expiresAt: '2020-01-01' })]);
    expect(root.querySelector('tbody tr')!.textContent).toContain('Vencido');
    expect(root.querySelector('[data-test="creditos-totales"]')!.textContent).toContain('0');
  });

  it('un alumno sin planes muestra el estado vacío, no una tabla en blanco', async () => {
    const root = await setup(async () => []);
    expect(root.querySelector('tbody')).toBeNull();
    expect(root.textContent).toContain('todavía no compró ningún plan');
  });

  it('si falla la carga muestra el error', async () => {
    const root = await setup(() => Promise.reject({ kind: 'network' as const }));
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('No pudimos conectar');
  });

  it('un plan sin vencimiento no se muestra como vencido', async () => {
    const root = await setup(async () => [sp({ expiresAt: null })]);
    const fila = root.querySelector('tbody tr')!;
    expect(fila.textContent).not.toContain('Vencido');
    expect(fila.textContent).toContain('No vence');
  });
});

describe('AlumnoPlanesModalComponent · vender plan', () => {
  const fill = (root: HTMLElement, planId: string, monto: string, medio: string) => {
    const set = (sel: string, value: string, ev: string) => {
      const el = root.querySelector(sel) as HTMLInputElement | HTMLSelectElement;
      el.value = value;
      el.dispatchEvent(new Event(ev));
    };
    set('#vp-plan', planId, 'change');
    set('#vp-monto', monto, 'input');
    set('#vp-medio', medio, 'change');
  };

  it('lista los medios de pago del catálogo', async () => {
    const root = await setup(async () => []);
    const opciones = Array.from(root.querySelectorAll('#vp-medio option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Elegí un medio…', 'Efectivo']);
  });

  /**
   * Sin este aviso, un catálogo que no cargó deja al usuario con "Elegí un medio de pago" y
   * ningún medio para elegir — un callejón sin salida sin explicación.
   */
  it('si el catálogo de medios no carga, lo dice', async () => {
    const fixture = await mount(async () => [], {
      catalogs: { paymentMethods: async () => { throw { kind: 'network' as const }; } } as unknown as CatalogsRepository,
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudieron cargar los medios de pago');
  });

  // Vender un plan inactivo es un 400 del backend ('planId inválido: ... o está inactivo').
  it('sólo ofrece planes activos', async () => {
    const root = await setup(async () => []);
    const opciones = Array.from(root.querySelectorAll('#vp-plan option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Elegí un plan…', 'Mensual 8 clases']);
  });

  it('elegir el plan pre-carga su precio de lista', async () => {
    const fixture = await mount(async () => []);
    const root = fixture.nativeElement as HTMLElement;
    const select = root.querySelector('#vp-plan') as HTMLSelectElement;
    select.value = '10';
    select.dispatchEvent(new Event('change'));
    // Zoneless: el signal ya cambió, pero el [value] recién se refleja en el próximo ciclo.
    fixture.detectChanges();
    expect((root.querySelector('#vp-monto') as HTMLInputElement).value).toBe('96000');
  });

  it('vende y re-lee la lista de planes', async () => {
    const calls: unknown[] = [];
    let vendido = false;
    const fixture = await mount(
      async () => (vendido ? [sp()] : []),
      {
        purchasePlan: async (studentId, draft) => { calls.push({ studentId, draft }); vendido = true; },
      },
    );
    const root = fixture.nativeElement as HTMLElement;
    fill(root, '10', '90000', '3');
    (root.querySelector('[data-test="vender"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(calls).toEqual([
      { studentId: '7', draft: { planId: '10', paymentMethodId: '3', amount: '90000' } },
    ]);
    // Re-lee en vez de parchear: los créditos y el vencimiento los calcula el backend.
    expect(root.querySelector('tbody tr')!.textContent).toContain('Mensual 8 clases');
  });

  it('un monto inválido queda en el banner y NO sale a la red', async () => {
    const calls: unknown[] = [];
    const fixture = await mount(async () => [], {
      purchasePlan: async (_s, d) => { calls.push(d); },
    });
    const root = fixture.nativeElement as HTMLElement;
    fill(root, '10', 'gratis', '3');
    (root.querySelector('[data-test="vender"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(calls).toEqual([]);
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('sin separador de miles');
    // El formulario sigue en pantalla: es donde se corrige.
    expect(root.querySelector('[data-test="vender"]')).not.toBeNull();
  });

  /**
   * El caso que más caro salía: la tabla muestra "$96.000" y `Number('96.000')` es 96. Sin la
   * validación estricta, escribir lo que se ve cobraba mil veces menos sin que nada avisara.
   */
  it('un monto con separador de miles NO sale a la red', async () => {
    const calls: unknown[] = [];
    const fixture = await mount(async () => [], {
      purchasePlan: async (_s, d) => { calls.push(d); },
    });
    const root = fixture.nativeElement as HTMLElement;
    fill(root, '10', '96.000', '3');
    (root.querySelector('[data-test="vender"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(calls).toEqual([]);
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('sin separador de miles');
  });

  /**
   * Si la VENTA entró y lo que falló fue la relectura, el formulario tiene que limpiarse igual:
   * dejarlo cargado con el banner de error invita a un segundo click que cobra dos veces.
   */
  it('venta exitosa con relectura fallida limpia el formulario igual', async () => {
    let vendido = false;
    const fixture = await mount(
      async () => { if (vendido) throw { kind: 'network' as const }; return []; },
      { purchasePlan: async () => { vendido = true; } },
    );
    const root = fixture.nativeElement as HTMLElement;
    fill(root, '10', '90000', '3');
    // detectChanges() ANTES del click: sin un ciclo acá, Angular nunca registra '90000' como
    // valor del binding y al comparar '' contra '' no reescribe el DOM — el input quedaría con
    // el texto viejo por un artefacto del test, no por un fallo del componente.
    fixture.detectChanges();

    (root.querySelector('[data-test="vender"]') as HTMLButtonElement).click();
    // Tick de macrotask: comprar() tiene un salto de promesa más que el resto (venta y
    // relectura son dos try separados), y whenStable() solo no lo alcanza.
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')!.textContent).toContain('No pudimos conectar');
    expect((root.querySelector('#vp-monto') as HTMLInputElement).value).toBe('');
  });

  it('si falla la venta conserva lo cargado en el formulario', async () => {
    const fixture = await mount(async () => [], {
      purchasePlan: () => Promise.reject({ kind: 'network' as const }),
    });
    const root = fixture.nativeElement as HTMLElement;
    fill(root, '10', '90000', '3');
    (root.querySelector('[data-test="vender"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((root.querySelector('#vp-monto') as HTMLInputElement).value).toBe('90000');
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('No pudimos conectar');
  });
});
