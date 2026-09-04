import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GruposCategoriaPageComponent } from './grupos-categoria-page.component';
import { GruposCategoriaFacade } from './grupos-categoria.facade';
import { GrupoItemsStore } from './grupo-items-store';
import { GrupoItemsFacade } from './grupo-items.facade';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { CategoryGroup, CategoryGroupDraft } from '@domain/entities/category-group';

const GRUPOS: CategoryGroup[] = [
  { id: '1', name: 'Principiantes' },
  { id: '2', name: 'Avanzados' },
];

async function settle(fixture: ComponentFixture<GruposCategoriaPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<CategoryGroupsRepository> = {}) {
  const repo = {
    list: async () => GRUPOS,
    create: async (_d: CategoryGroupDraft) => undefined,
    update: async (_id: string, _d: CategoryGroupDraft) => undefined,
    remove: async (_id: string) => undefined,
    ...over,
  } as CategoryGroupsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      GruposCategoriaFacade,
      GrupoItemsStore,
      GrupoItemsFacade,
      { provide: CategoryGroupsRepository, useValue: repo },
      // La página lo pide para poblar las checkboxes del modal de categorías. Devuelve [] :
      // ningún test de esta pantalla mira el contenido del modal.
      { provide: CategoriesRepository, useValue: {
          list: async () => [],
          create: async () => undefined,
          update: async () => undefined,
          remove: async () => undefined,
        } as CategoriesRepository },
    ],
  });
  const fixture = TestBed.createComponent(GruposCategoriaPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const filas = (el: HTMLElement) => Array.from(el.querySelectorAll('tbody tr'));
const buscador = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#grupos-q')!;

describe('GruposCategoriaPageComponent', () => {
  it('renderiza una fila por grupo, ordenados por nombre', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(2);
    expect(filas(el)[0].textContent).toContain('Avanzados');
  });

  it('el buscador filtra por nombre', async () => {
    const { fixture, el } = await mount();
    buscador(el).value = 'princi';
    buscador(el).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('Principiantes');
  });

  it('sin resultados de búsqueda muestra el vacío correspondiente', async () => {
    const { fixture, el } = await mount();
    buscador(el).value = 'zzz';
    buscador(el).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // Escopado a .panel: el modal de categorías vive fuera de .panel y tiene su propio vacío,
    // siempre en el DOM aunque el <dialog> esté cerrado (Angular no lo desmonta).
    expect(el.querySelector('.panel app-placeholder')!.textContent).toContain('Ningún grupo coincide');
  });

  it('una lista vacía muestra el vacío de "todavía no cargaste"', async () => {
    const { el } = await mount({ list: async () => [] });
    expect(el.querySelector('.panel app-placeholder')!.textContent).toContain('Todavía no cargaste');
  });

  it('si la carga FALLA muestra el banner y NO el vacío', async () => {
    // Con data() en null la carga falló: decir "todavía no cargaste ningún grupo" sería mentir.
    const { el } = await mount({ list: () => Promise.reject({ kind: 'forbidden' as const }) });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ningún grupo');
  });

  /**
   * Abre el alta y escribe un nombre VÁLIDO antes de guardar. Sin esto,
   * createCategoryGroupDraft tira la invariante y el repo nunca se llama: el test pasaría
   * en verde probando otra cosa que la que dice su nombre.
   */
  async function altaConNombre(fixture: ComponentFixture<GruposCategoriaPageComponent>, el: HTMLElement) {
    el.querySelector<HTMLButtonElement>('.panel-head .btn-primary')!.click();
    fixture.detectChanges();
    const nombre = el.querySelector<HTMLInputElement>('#grupo-nombre')!;
    nombre.value = 'Avanzados';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="save"]')!.click();
    await settle(fixture);
  }

  it('un error de guardado NO reemplaza la tabla', async () => {
    // El banner va FUERA de la cadena @if/@else justamente por esto.
    const { fixture, el } = await mount({ create: () => Promise.reject({ kind: 'network' as const }) });
    await altaConNombre(fixture, el);
    expect(filas(el)).toHaveLength(2);
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('el modal queda ABIERTO cuando el guardado falla', async () => {
    // Es donde el usuario puede corregir: cerrarlo lo obligaría a tipear todo de nuevo.
    const { fixture, el } = await mount({ create: () => Promise.reject({ kind: 'network' as const }) });
    await altaConNombre(fixture, el);
    const dialog = el.querySelector<HTMLDialogElement>('app-grupo-categoria-form-modal dialog')!;
    expect(dialog.open).toBe(true);
  });

  it('el modal se CIERRA cuando el guardado sale bien', async () => {
    const { fixture, el } = await mount();
    await altaConNombre(fixture, el);
    const dialog = el.querySelector<HTMLDialogElement>('app-grupo-categoria-form-modal dialog')!;
    expect(dialog.open).toBe(false);
  });
});
