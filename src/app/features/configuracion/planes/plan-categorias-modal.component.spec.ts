import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PlanCategoriasModalComponent } from './plan-categorias-modal.component';
import { PlanCategoriasFacade } from './plan-categorias.facade';
import { PlanCategoriasStore } from './plan-categorias-store';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { Category } from '@domain/entities/category';
import { Plan } from '@domain/entities/plan';

const CATEGORIAS: Category[] = [
  { id: '1', name: 'Cuarta', levelOrder: 4 },
  { id: '2', name: 'Quinta', levelOrder: 5 },
];

const PLAN: Plan = {
  id: '7', name: 'Mensual 8', planTypeId: '2', coachId: null,
  classCount: 8, price: '12000', validityDays: 30, active: true,
};

/** `seed` precarga la pista del navegador para PLAN ANTES de open(). */
function setup(over: Partial<PlansRepository> = {}, seed: readonly string[] = []) {
  const calls: string[] = [];
  const repo = {
    addCategory: async (_p: string, c: string) => { calls.push(`add:${c}`); },
    removeCategory: async (_p: string, c: string) => { calls.push(`remove:${c}`); },
    ...over,
  } as PlansRepository;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      PlanCategoriasFacade,
      PlanCategoriasStore,
      { provide: PlansRepository, useValue: repo },
    ],
  });
  const fixture = TestBed.createComponent(PlanCategoriasModalComponent);
  fixture.componentRef.setInput('categories', CATEGORIAS);
  fixture.detectChanges();
  TestBed.inject(PlanCategoriasStore).write(PLAN.id, seed);
  fixture.componentInstance.open(PLAN);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, calls };
}

async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

describe('PlanCategoriasModalComponent', () => {
  beforeEach(() => localStorage.clear());

  it('renderiza un checkbox por categoría', () => {
    const { el } = setup();
    expect(el.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
  });

  it('el checkbox NO está dentro de un .field: usa el primitivo .checkbox-row', () => {
    // `.field input` es un selector de descendencia (styles/components.css): sin sacar el
    // checkbox de ahí hereda width:100%/min-height:48px y se ve como una caja de texto.
    const { el } = setup();
    const checkbox = el.querySelector('input[type=checkbox]')!;
    expect(checkbox.closest('.field')).toBeNull();
    expect(checkbox.closest('.checkbox-row')).not.toBeNull();
  });

  it('una categoría que está en la pista aparece tildada', () => {
    const { el } = setup({}, ['2']);
    expect(el.querySelector<HTMLInputElement>('#plan-cat-2')!.checked).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#plan-cat-1')!.checked).toBe(false);
  });

  it('tildar una categoría llama a addCategory con ese id', async () => {
    const { fixture, el, calls } = setup();
    const checkbox = el.querySelector<HTMLInputElement>('#plan-cat-1')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(calls).toEqual(['add:1']);
  });

  it('muestra el error del backend sin tapar las checkboxes', async () => {
    const { fixture, el } = setup({
      addCategory: () => Promise.reject({ kind: 'forbidden' as const }),
    });
    const checkbox = el.querySelector<HTMLInputElement>('#plan-cat-1')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('No tenés permisos');
    expect(el.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
  });

  it('el pie admite que la lista sale del navegador', () => {
    const { el } = setup();
    expect(el.textContent).toContain('este navegador');
  });
});
