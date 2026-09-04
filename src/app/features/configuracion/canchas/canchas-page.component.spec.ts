import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CanchasPageComponent } from './canchas-page.component';
import { CanchasFacade } from './canchas.facade';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { Court, CourtDraft } from '@domain/entities/court';

const CANCHA: Court = {
  id: '1', name: 'Cancha 1', code: 'C1', surfaceTypeId: '3', indoor: true, courtStatusId: '1',
};

async function settle(fixture: ComponentFixture<CanchasPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<CourtsRepository> = {}) {
  const repo = {
    list: async () => [CANCHA],
    create: async (_d: CourtDraft) => undefined,
    update: async (_id: string, _d: CourtDraft) => undefined,
    remove: async (_id: string) => undefined,
    ...over,
  } as CourtsRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      CanchasFacade,
      { provide: CourtsRepository, useValue: repo },
      {
        provide: CatalogsRepository,
        useValue: {
          surfaceTypes: async () => [{ id: '1', name: 'cemento' }, { id: '3', name: 'sintetico' }],
          courtStatuses: async () => [{ id: '1', name: 'disponible' }],
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CanchasPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const nueva = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.panel-head .btn-primary')!;
const editar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('tbody .btn-ghost')!;
const form = (el: HTMLElement) => el.querySelector<HTMLDialogElement>('app-cancha-form-modal dialog')!;
const nombre = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#cancha-nombre')!;
const guardar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-cancha-form-modal [data-test="save"]')!;
const cancelar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-cancha-form-modal .modal-foot .btn-ghost')!;
const avisoModal = (el: HTMLElement) => el.querySelector('app-cancha-form-modal .notice');
const filas = (el: HTMLElement) => el.querySelectorAll('tbody tr');
const buscador = (el: HTMLElement) => el.querySelector<HTMLInputElement>('#canchas-q')!;

function escribir(el: HTMLElement, texto: string): void {
  const input = nombre(el);
  input.value = texto;
  input.dispatchEvent(new Event('input'));
}

describe('CanchasPageComponent', () => {
  it('lista las canchas resolviendo los catálogos', async () => {
    const { el } = await mount();
    expect(filas(el)).toHaveLength(1);
    expect(filas(el)[0].textContent).toContain('Cancha 1');
    expect(filas(el)[0].textContent).toContain('Sintético');
  });

  it('tras GUARDAR una cancha, "+ Nueva cancha" vuelve a abrir el formulario VACÍO', async () => {
    // editing ya vale null cuando se crea: el set(null) del segundo alta no cambia nada, así que
    // sincronizar el form con un effect sobre el input lo deja con lo recién tipeado. Un Guardar
    // de más ahí crea un duplicado.
    const { fixture, el } = await mount();
    nueva(el).click();
    await settle(fixture);
    escribir(el, 'Cancha 5');
    guardar(el).click();
    await settle(fixture);
    expect(form(el).open).toBe(false);

    nueva(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('');
  });

  it('EDITAR, cancelar y abrir "+ Nueva cancha" también arranca vacío', async () => {
    // La otra mitad del mismo bug: sembrar en open() leyendo el INPUT lo rompe, porque el binding
    // [court] todavía no se refrescó cuando la página llama open() (mismo hazard documentado en
    // grupo-detail-page.component.ts:60-63). Por eso open() recibe la cancha por parámetro.
    const { fixture, el } = await mount();
    editar(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('Cancha 1');

    cancelar(el).click();
    await settle(fixture);
    nueva(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('');
  });

  it('reabrir la MISMA fila descarta los cambios abandonados', async () => {
    const { fixture, el } = await mount();
    editar(el).click();
    await settle(fixture);
    escribir(el, 'Cancha renombrada');
    cancelar(el).click();
    await settle(fixture);

    editar(el).click();
    await settle(fixture);
    expect(nombre(el).value).toBe('Cancha 1');
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
    expect(avisoModal(el)!.textContent).toContain('El nombre de la cancha es obligatorio.');
    // El error de una ESCRITURA no puede reemplazar la lista: data() sigue intacto.
    expect(filas(el)).toHaveLength(1);
  });

  it('el vacío real y el de búsqueda muestran textos distintos', async () => {
    const { fixture, el } = await mount({ list: async () => [] });
    // Sin query(): vacío real.
    expect(el.querySelector('.panel')!.textContent).toContain('Todavía no cargaste ninguna cancha');

    buscador(el).value = 'zzzz';
    buscador(el).dispatchEvent(new Event('input'));
    await settle(fixture);
    // Con query(): vacío de búsqueda, no el real.
    expect(el.querySelector('.panel')!.textContent).toContain('Ninguna cancha coincide con la búsqueda');
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ninguna cancha');
  });

  it('un error de CARGA se ve en la página pero no viaja al modal recién abierto', async () => {
    const { fixture, el } = await mount({ list: () => Promise.reject({ kind: 'network' as const }) });
    const aviso = el.querySelector('.panel [role="alert"]');
    expect(aviso!.textContent).toContain('No pudimos conectar con el servidor.');
    expect(el.querySelector('.panel')!.textContent).not.toContain('Todavía no cargaste ninguna cancha');

    nueva(el).click();
    await settle(fixture);
    expect(avisoModal(el)).toBeNull();
    expect(el.querySelector('.panel [role="alert"]')).toBeNull();   // openNew() lo limpió
  });
});
