import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlanesPageComponent } from './planes-page.component';
import { PlanesFacade } from './planes.facade';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Plan, PlanDraft } from '@domain/entities/plan';
import { PlanCategoriasFacade } from './plan-categorias.facade';
import { PlanCategoriasStore } from './plan-categorias-store';

const PLAN: Plan = {
  id: '1', name: 'Mensual 8', planTypeId: '2', coachId: '5',
  classCount: 8, price: '12000', validityDays: 30, active: true,
};

async function settle(fixture: ComponentFixture<PlanesPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<PlansRepository> = {}) {
  const repo = {
    list: async () => [PLAN],
    create: async (_d: PlanDraft) => undefined,
    update: async (_id: string, _d: PlanDraft) => undefined,
    remove: async (_id: string) => undefined,
    addCategory: async () => undefined,
    removeCategory: async () => undefined,
    ...over,
  } as PlansRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PlanesFacade,
      { provide: PlansRepository, useValue: repo },
      {
        provide: CoachesRepository,
        useValue: { list: async () => [{ id: '5', displayName: 'Juan Gómez', description: null }] },
      },
      {
        provide: CatalogsRepository,
        useValue: { planTypes: async () => [{ id: '2', name: 'nivelacion' }] },
      },
      {
        provide: CategoriesRepository,
        useValue: { list: async () => [{ id: '1', name: 'Cuarta', levelOrder: 4 }] },
      },
      PlanCategoriasFacade,
      PlanCategoriasStore,
    ],
  });
  const fixture = TestBed.createComponent(PlanesPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const filas = (el: HTMLElement) => Array.from(el.querySelectorAll('tbody tr'));

describe('PlanesPageComponent', () => {
  it('renderiza una fila por plan con el tipo traducido y el profesor resuelto', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(1);
    const texto = filas(el)[0].textContent!;
    expect(texto).toContain('Mensual 8');
    expect(texto).toContain('Nivelación');
    expect(texto).toContain('Juan Gómez');
  });

  it('muestra el precio formateado', async () => {
    const { el } = await mount();
    expect(filas(el)[0].textContent).toContain('$12.000');
  });

  it('un plan sin profesor muestra una raya, no un hueco', async () => {
    const { el } = await mount({ list: async () => [{ ...PLAN, coachId: null }] });
    expect(filas(el)[0].textContent).toContain('—');
  });

  it('el buscador filtra por nombre', async () => {
    const { fixture, el } = await mount({ list: async () => [PLAN, { ...PLAN, id: '2', name: 'Suelto' }] });
    const q = el.querySelector<HTMLInputElement>('#planes-q')!;
    q.value = 'suelto';
    q.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(1);
  });

  it('si la carga FALLA muestra el banner y NO el vacío', async () => {
    const { el } = await mount({ list: () => Promise.reject({ kind: 'forbidden' as const }) });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    // Escopado a .panel: el modal de categorías tiene su propio .a-empty, siempre en el DOM
    // esté el <dialog> abierto o no (ModalComponent no usa @if), y colisiona con este selector.
    expect(el.querySelector('.panel .a-empty')).toBeNull();
  });

  it('un error de guardado NO reemplaza la tabla', async () => {
    const { fixture, el } = await mount({ update: () => Promise.reject({ kind: 'network' as const }) });
    // No 'tbody .btn-ghost' a secas: desde que la fila también tiene el botón "Categorías"
    // (mismas clases), ese selector agarraría el botón equivocado y el nombre vacío del alta
    // dispararía el error de validación de createPlanDraft en vez de ejercitar el reject de
    // update() que este test dice cubrir.
    const botones = Array.from(el.querySelectorAll<HTMLButtonElement>('tbody .btn-ghost'));
    botones.find((b) => b.textContent?.trim() === 'Editar')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="save"]')!.click();
    await settle(fixture);
    expect(filas(el)).toHaveLength(1);
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('PlanesPageComponent · categorías del plan', () => {
  it('cada fila tiene un botón Categorías', async () => {
    const { el } = await mount();
    const boton = filas(el)[0].querySelector('[data-test="categorias"]');
    expect(boton).not.toBeNull();
    expect(boton!.textContent!.trim()).toBe('Categorías');
  });

  it('el botón abre el modal con las categorías del club', async () => {
    const { fixture, el } = await mount();
    el.querySelector<HTMLButtonElement>('[data-test="categorias"]')!.click();
    await settle(fixture);
    // El contenido proyectado (ModalComponent no tiene @if) está en el DOM esté el modal
    // abierto o no: #plan-cat-1 NO prueba la apertura, prueba que la categoría del doble de
    // CategoriesRepository llegó al modal. Lo que prueba la apertura es el atributo `open`
    // del <dialog>, que showModal() setea (test-setup.ts).
    expect(el.querySelector('#plan-cat-1')).not.toBeNull();
    expect(el.querySelector('app-plan-categorias-modal dialog')!.hasAttribute('open')).toBe(true);
  });
});
