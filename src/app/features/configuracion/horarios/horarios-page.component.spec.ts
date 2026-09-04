import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HorariosPageComponent } from './horarios-page.component';
import { HorariosFacade } from './horarios.facade';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { Schedule, ScheduleDraft, SessionGenerationDraft, SessionGenerationResult } from '@domain/entities/schedule';
import { ToastService } from '@shared/ui/toast/toast.service';

const ROW: Schedule = {
  id: 'row', courtId: 'c1', coachId: 'p1', categoryGroupId: 'g1', sessionTypeId: '40',
  weekday: 1, startTime: '18:00', endTime: '19:30', capacity: 8, price: '5000',
  active: true, validFrom: null, validTo: null,
};

async function settle(fixture: ComponentFixture<HorariosPageComponent>): Promise<void> {
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

async function mount(over: Partial<SchedulesRepository> = {}): Promise<ComponentFixture<HorariosPageComponent>> {
  const repo = {
    list: async () => [ROW],
    create: async (_d: ScheduleDraft) => undefined,
    update: async (_id: string, _d: ScheduleDraft) => undefined,
    remove: async (_id: string) => undefined,
    generateSessions: async () => ({ created: 0, skipped: 0 }),
    ...over,
  } as SchedulesRepository;

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      HorariosFacade,
      { provide: SchedulesRepository, useValue: repo },
      {
        provide: CourtsRepository,
        useValue: { list: async () => [{ id: 'c1', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null }] },
      },
      {
        provide: CoachesRepository,
        useValue: { list: async () => [{ id: 'p1', displayName: 'M. Díaz', description: null }] },
      },
      {
        provide: CategoryGroupsRepository,
        useValue: { list: async () => [{ id: 'g1', name: 'Cuarta/Quinta' }] },
      },
      {
        provide: CatalogsRepository,
        useValue: { sessionTypes: async () => [{ id: '40', name: 'grupal' }] },
      },
    ],
  });
  const fixture = TestBed.createComponent(HorariosPageComponent);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
}

async function setup(rows: readonly Schedule[]): Promise<ComponentFixture<HorariosPageComponent>> {
  return mount({ list: async () => [...rows] });
}

async function setupConError(): Promise<ComponentFixture<HorariosPageComponent>> {
  return mount({ list: () => Promise.reject({ kind: 'network' as const }) });
}

async function setupConGenerate(result: SessionGenerationResult): Promise<ComponentFixture<HorariosPageComponent>> {
  return mount({ generateSessions: async (_d: SessionGenerationDraft) => result });
}

async function setupConGenerateError(): Promise<ComponentFixture<HorariosPageComponent>> {
  return mount({ generateSessions: () => Promise.reject({ kind: 'network' as const }) });
}

const nueva = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.panel-head .btn-primary')!;
const editarBtn = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('tbody .btn-ghost')!;
const eliminarBtn = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('tbody .btn-danger')!;
const form = (el: HTMLElement) => el.querySelector<HTMLDialogElement>('app-horario-form-modal dialog')!;
const guardar = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-horario-form-modal [data-test="save"]')!;
const avisoModal = (el: HTMLElement) => el.querySelector('app-horario-form-modal .notice');
const confirmDialog = (el: HTMLElement) => el.querySelector<HTMLDialogElement>('app-confirm-delete-modal dialog')!;
const confirmarBorrado = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('app-confirm-delete-modal [data-test="confirm"]')!;
// f.nativeElement es `any`: Array.from(any) degrada a unknown[] en modo strict (TS2571).
// Se tipa como HTMLElement antes de querySelectorAll, mismo patrón que planes-page.component.spec.ts.
const filas = (el: HTMLElement) => Array.from(el.querySelectorAll('tbody tr'));

describe('HorariosPageComponent', () => {
  it('muestra el horario como rango, y — cuando falta una punta', async () => {
    const f = await setup([
      { ...ROW, id: '1', startTime: '18:00', endTime: '19:30' },
      { ...ROW, id: '2', startTime: '18:00', endTime: null },
    ]);
    const rows = filas(f.nativeElement as HTMLElement);
    expect(rows[0].textContent).toContain('18:00 – 19:30');
    expect(rows[1].textContent).toContain('—');
  });

  it('resuelve los nombres de cancha, grupo y profesor, con — cuando no están', async () => {
    const f = await setup([{ ...ROW, courtId: '99' }]);
    expect(f.nativeElement.querySelector('tbody tr')!.textContent).toContain('—');
  });

  it('NO tiene buscador: los horarios de un club son decenas, no cientos', async () => {
    const f = await setup([ROW]);
    expect(f.nativeElement.querySelector('.search-box')).toBeNull();
  });

  it('el vacío sólo aparece cuando la lista LLEGÓ vacía', async () => {
    const f = await setupConError();
    expect(f.nativeElement.textContent).not.toContain('Todavía no cargaste');
    expect(f.nativeElement.querySelector('.notice')).toBeTruthy();
  });

  it('generables() cuenta activos CON día y horas, que es lo que el service procesa', async () => {
    const f = await setup([
      { ...ROW, id: '1', active: true,  weekday: 1,    startTime: '18:00', endTime: '19:30' },
      { ...ROW, id: '2', active: false, weekday: 1,    startTime: '18:00', endTime: '19:30' },
      { ...ROW, id: '3', active: true,  weekday: null, startTime: '18:00', endTime: '19:30' },
      { ...ROW, id: '4', active: true,  weekday: 1,    startTime: null,    endTime: '19:30' },
      { ...ROW, id: '5', active: true,  weekday: 1,    startTime: '18:00', endTime: null },
    ]);
    // generables() es protegido (input futuro del modal de generar, Task 15): mismo cast
    // que dashboard-page.component.spec.ts:146 para leerlo desde afuera de la clase.
    const generables = (f.componentInstance as unknown as { generables: () => number }).generables();
    expect(generables).toBe(1);
  });

  it('sin nada que generar, el botón queda deshabilitado', async () => {
    const f = await setup([{ ...ROW, active: false }]);
    const btn = f.nativeElement.querySelector('[data-test="generar"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('la tabla ordena por semana argentina', async () => {
    const f = await setup([
      { ...ROW, id: 'dom', weekday: 0 },
      { ...ROW, id: 'lun', weekday: 1 },
    ]);
    const rows = filas(f.nativeElement as HTMLElement);
    expect(rows[0].textContent).toContain('Lunes');
    expect(rows[1].textContent).toContain('Domingo');
  });

  it('tras GUARDAR un horario nuevo, el modal se cierra', async () => {
    const fixture = await mount();
    const el = fixture.nativeElement as HTMLElement;
    nueva(el).click();
    await settle(fixture);
    // La cancha, el profesor, el grupo, el tipo y el día ya vienen sembrados por open(null)
    // desde los lookups; sólo faltan las horas para que createScheduleDraft no invariante.
    const inicio = el.querySelector<HTMLInputElement>('#horario-inicio')!;
    inicio.value = '10:00';
    inicio.dispatchEvent(new Event('input'));
    const fin = el.querySelector<HTMLInputElement>('#horario-fin')!;
    fin.value = '11:00';
    fin.dispatchEvent(new Event('input'));
    guardar(el).click();
    await settle(fixture);
    expect(form(el).open).toBe(false);
  });

  it('EDITAR precarga la cancha y las horas del horario existente', async () => {
    const fixture = await mount();
    const el = fixture.nativeElement as HTMLElement;
    editarBtn(el).click();
    await settle(fixture);
    expect(el.querySelector<HTMLInputElement>('#horario-inicio')!.value).toBe('18:00');
    expect(el.querySelector<HTMLInputElement>('#horario-fin')!.value).toBe('19:30');
  });

  it('un guardado fallido muestra el error DENTRO del modal y NO borra la tabla', async () => {
    // §8.3: el modal queda abierto mostrando el error de la facade. Sin tocar las horas,
    // createScheduleDraft tira sobre el alta (input.startTime === '').
    const fixture = await mount();
    const el = fixture.nativeElement as HTMLElement;
    nueva(el).click();
    await settle(fixture);
    guardar(el).click();
    await settle(fixture);

    expect(form(el).open).toBe(true);
    expect(avisoModal(el)!.textContent).toContain('Poné una hora de inicio válida.');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('ELIMINAR pide confirmación antes de borrar, y REALMENTE llama a remove() con el id correcto', async () => {
    // Quien cierra el diálogo es ConfirmDeleteModalComponent.onConfirm() por su cuenta (emit()
    // + close()): sin esta aserción el test seguiría en verde con onDeleteConfirmed() vacío.
    // Mismo molde de `calls` que setup() en horarios.facade.spec.ts.
    const calls: string[] = [];
    const fixture = await mount({
      remove: async (id: string) => { calls.push(`remove:${id}`); },
    });
    const el = fixture.nativeElement as HTMLElement;
    eliminarBtn(el).click();
    await settle(fixture);
    expect(confirmDialog(el).open).toBe(true);

    confirmarBorrado(el).click();
    await settle(fixture);
    expect(confirmDialog(el).open).toBe(false);
    expect(calls).toEqual([`remove:${ROW.id}`]);
  });

  it('un error de CARGA se ve en la página pero no viaja al modal recién abierto', async () => {
    const fixture = await setupConError();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.panel [role="alert"]')).toBeTruthy();

    nueva(el).click();
    await settle(fixture);
    expect(avisoModal(el)).toBeNull();
    expect(el.querySelector('.panel [role="alert"]')).toBeNull(); // openNew() lo limpió
  });

  it('generar OK cierra el modal y el toast dice las DOS cifras', async () => {
    const f = await setupConGenerate({ created: 12, skipped: 3 });
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('[data-test="generar"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-test="confirmar"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts[0].desc).toContain('12');
    expect(toasts[0].desc).toContain('3');
  });

  it('generar 0 clases NO es un error: es un resultado válido', async () => {
    const f = await setupConGenerate({ created: 0, skipped: 40 });
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('[data-test="generar"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-test="confirmar"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(TestBed.inject(ToastService).toasts()[0].type).toBe('ok');
  });

  it('si generar falla, el modal QUEDA abierto', async () => {
    const f = await setupConGenerateError();
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('[data-test="generar"]') as HTMLButtonElement).click();
    f.detectChanges();
    (el.querySelector('[data-test="confirmar"]') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
    expect(el.querySelectorAll('dialog')[1].open).toBe(true);
  });

  it('coaches vacío por una falla previa: reconstruir la página reintenta loadLookups() aunque courts ya esté poblado', async () => {
    // Regresión: el gate original sólo miraba courts().length. Si /coaches falla y courts()
    // se pobló bien, volver a la tab (reconstruir el componente, mismo patrón que
    // profesores-page.component.spec.ts) nunca reintentaba — el select de Profesor quedaba
    // vacío para siempre y createScheduleDraft rechazaba el alta sin salida.
    let coachesCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        HorariosFacade,
        {
          provide: SchedulesRepository,
          useValue: {
            list: async () => [ROW],
            create: async (_d: ScheduleDraft) => undefined,
            update: async (_id: string, _d: ScheduleDraft) => undefined,
            remove: async (_id: string) => undefined,
            generateSessions: async () => ({ created: 0, skipped: 0 }),
          } as SchedulesRepository,
        },
        {
          provide: CourtsRepository,
          useValue: { list: async () => [{ id: 'c1', name: 'Cancha 1', code: null, surfaceTypeId: null, indoor: false, courtStatusId: null }] },
        },
        {
          provide: CoachesRepository,
          useValue: { list: async () => { coachesCalls++; throw new Error('x'); } },
        },
        {
          provide: CategoryGroupsRepository,
          useValue: { list: async () => [{ id: 'g1', name: 'Cuarta/Quinta' }] },
        },
        {
          provide: CatalogsRepository,
          useValue: { sessionTypes: async () => [{ id: '40', name: 'grupal' }] },
        },
      ],
    });

    const primero = TestBed.createComponent(HorariosPageComponent);
    primero.detectChanges();
    await settle(primero);
    expect(coachesCalls).toBe(1);
    const facade = TestBed.inject(HorariosFacade);
    expect(facade.courts().length).toBeGreaterThan(0);
    expect(facade.coaches()).toEqual([]);

    // "Cambiar de tab y volver": la facade sobrevive (ruta padre real); sólo se recrea el
    // componente, mismo patrón que profesores-page.component.spec.ts.
    const segundo = TestBed.createComponent(HorariosPageComponent);
    segundo.detectChanges();
    await settle(segundo);
    expect(coachesCalls).toBe(2);
  });
});
