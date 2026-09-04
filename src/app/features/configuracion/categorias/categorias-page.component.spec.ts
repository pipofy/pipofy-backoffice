import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CategoriasPageComponent } from './categorias-page.component';
import { CategoriasFacade } from './categorias.facade';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category, CategoryDraft } from '@domain/entities/category';

const CATEGORIA: Category = { id: '1', name: '4ta', levelOrder: 4 };

async function settle(fixture: ComponentFixture<CategoriasPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<CategoriesRepository> = {}) {
  const repo = {
    list: async () => [CATEGORIA],
    create: async (_d: CategoryDraft) => undefined,
    update: async (_id: string, _d: CategoryDraft) => undefined,
    remove: async (_id: string) => undefined,
    ...over,
  } as CategoriesRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      CategoriasFacade,
      { provide: CategoriesRepository, useValue: repo },
    ],
  });
  const fixture = TestBed.createComponent(CategoriasPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const nueva = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.panel-head .btn-primary')!;
const editar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('tbody .btn-ghost')!;
const form = (el: HTMLElement) => el.querySelector<HTMLDialogElement>('app-categoria-form-modal dialog')!;
const nombre = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#categoria-nombre')!;
const guardar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-categoria-form-modal [data-test="save"]')!;
const cancelar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-categoria-form-modal .modal-foot .btn-ghost')!;
const avisoModal = (el: HTMLElement) => el.querySelector('app-categoria-form-modal .notice');
const filas = (el: HTMLElement) => el.querySelectorAll('tbody tr');
const buscador = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#categorias-q')!;

function escribir(el: HTMLElement, texto: string): void {
  const input = nombre(el);
  input.value = texto;
  input.dispatchEvent(new Event('input'));
}

describe('CategoriasPageComponent', () => {
  it('lista las categorías', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('4ta');
  });

  it('tras GUARDAR una categoría, "+ Nueva categoría" vuelve a abrir el formulario VACÍO', async () => {
    // editing ya vale null cuando se crea: el set(null) del segundo alta no cambia nada, así que
    // sincronizar el form con un effect sobre el input lo deja con lo recién tipeado. Un Guardar
    // de más ahí crea un duplicado.
    const { fixture, el } = await mount();
    nueva(el).click();
    await settle(fixture);
    escribir(el, '5ta');
    guardar(el).click();
    await settle(fixture);
    expect(form(el).open).toBe(false);

    nueva(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('');
  });

  it('EDITAR, cancelar y abrir "+ Nueva categoría" también arranca vacío', async () => {
    // La otra mitad del mismo bug: sembrar en open() leyendo el INPUT lo rompe, porque el binding
    // todavía no se refrescó cuando la página llama open() (hazard documentado en
    // grupo-detail-page.component.ts:60-63). Por eso open() recibe la categoría por parámetro.
    const { fixture, el } = await mount();
    editar(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('4ta');

    cancelar(el).click();
    await settle(fixture);
    nueva(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('');
  });

  it('un guardado fallido muestra el error DENTRO del modal y NO borra la tabla', async () => {
    // §8.3: "si la facade deja un error, el modal queda abierto mostrándolo". El .notice de la
    // página queda detrás del ::backdrop con blur(4px) (styles/components.css:254): invisible.
    const { fixture, el } = await mount();
    nueva(el).click();
    await settle(fixture);
    guardar(el).click();                       // nombre vacío → invariante de dominio
    await settle(fixture);

    expect(form(el).open).toBe(true);
    expect(avisoModal(el)!.textContent).toContain('El nombre de la categoría es obligatorio.');
    // El error de una ESCRITURA no puede reemplazar la lista: data() sigue intacto.
    expect(filas(el)).toHaveLength(1);
  });

  it('reabrir la página después de un error de guardado no repite el error en una tabla que está bien', async () => {
    // La facade vive en la ruta PADRE de /configuracion: al volver a esta tab, la página se
    // reconstruye pero data() ya existe, así que no se llama load() y run() nunca limpia el
    // error viejo. Sin clearError() en el constructor, el banner reaparecería solo.
    const { fixture, el } = await mount();
    nueva(el).click();
    await settle(fixture);
    guardar(el).click();                       // nombre vacío → invariante de dominio
    await settle(fixture);
    expect(el.querySelector('.panel [role="alert"]')).not.toBeNull();   // precondición: hay error

    // Simula volver a la tab: la página se destruye y se reconstruye, pero la facade —provista
    // en la ruta padre, no en esta página— es la MISMA instancia (mismo TestBed, sin reconfigurar).
    fixture.destroy();
    const fixture2 = TestBed.createComponent(CategoriasPageComponent);
    fixture2.detectChanges();
    await settle(fixture2);
    const el2 = fixture2.nativeElement as HTMLElement;

    expect(el2.querySelector('.panel [role="alert"]')).toBeNull();
  });

  it('el vacío real y el de búsqueda muestran textos distintos', async () => {
    const { fixture, el } = await mount({ list: async () => [] });
    // Sin query(): vacío real.
    expect(el.querySelector('.panel')!.textContent).toContain('Todavía no cargaste ninguna categoría');

    buscador(el).value = 'zzzz';
    buscador(el).dispatchEvent(new Event('input'));
    await settle(fixture);
    // Con query(): vacío de búsqueda, no el real.
    expect(el.querySelector('.panel')!.textContent).toContain('Ninguna categoría coincide con la búsqueda');
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ninguna categoría');
  });

  it('un error de CARGA se ve en la página pero no viaja al modal recién abierto', async () => {
    const { fixture, el } = await mount({ list: () => Promise.reject({ kind: 'network' as const }) });
    expect(el.querySelector('.panel [role="alert"]')!.textContent)
      .toContain('No pudimos conectar con el servidor.');
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ninguna categoría');

    nueva(el).click();
    await settle(fixture);
    expect(avisoModal(el)).toBeNull();
    expect(el.querySelector('.panel [role="alert"]')).toBeNull();   // openNew() lo limpió
  });
});
