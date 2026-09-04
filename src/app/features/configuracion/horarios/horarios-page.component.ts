import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HorariosFacade } from './horarios.facade';
import { HorarioFormModalComponent } from './horario-form-modal.component';
import { GenerarClasesModalComponent } from './generar-clases-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { weekdayLabel } from './weekday-label';
import { Schedule, ScheduleInput, SessionGenerationInput } from '@domain/entities/schedule';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-horarios-page',
  standalone: true,
  imports: [
    HorarioFormModalComponent,
    GenerarClasesModalComponent,
    ConfirmDeleteModalComponent,
    PlaceholderComponent,
    NoticeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './horarios-page.component.html',
  styleUrl: './horarios-page.component.css',
})
export class HorariosPageComponent {
  protected readonly facade = inject(HorariosFacade);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(HorarioFormModalComponent);
  private readonly generar = viewChild.required(GenerarClasesModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);

  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<Schedule | null>(null);
  protected readonly deleting = signal<Schedule | null>(null);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    // La facade se provee en la ruta PADRE, así que cambiar de tab y volver no recarga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
    // Los cuatro lookups fallan en SILENCIO y de forma INDEPENDIENTE (loadLookup deja []).
    // Mirar sólo courts() (como acá antes) deja sin reintento a cualquiera de los otros tres:
    // si /coaches falla y courts llegó bien, volver a esta tab ve courts() poblado y nunca
    // vuelve a pedir coaches, así que el select de Profesor queda vacío para siempre.
    // Por eso el gate mira los CUATRO. Las otras pantallas no necesitan esto porque van
    // contra CatalogsRepository, que borra la entrada del cache al fallar
    // (catalogs.repository.ts:38) y por eso se auto-reintenta sola en la próxima llamada.
    // Contrapartida aceptada: un lookup legítimamente vacío (un club sin profesores cargados
    // todavía) hace reintentar en cada visita a la tab. Es aceptable: la request es barata y
    // el caso es transitorio.
    if (
      this.facade.courts().length === 0 ||
      this.facade.coaches().length === 0 ||
      this.facade.categoryGroups().length === 0 ||
      this.facade.sessionTypes().length === 0
    ) {
      void this.facade.loadLookups();
    }
  }

  /** Los que generateSessions REALMENTE va a procesar, hasta donde el front puede saberlo:
   *  activos y con día y horas cargadas (schedules.service.ts:169). Los borrados ya no
   *  están: HttpSchedulesRepository los filtra al leer (§3.1).
   *
   *  Sobre data() y no sobre sorted(): ordenar para contar es trabajo tirado. */
  protected readonly generables = computed(
    () => (this.facade.data() ?? []).filter(
      (s) => s.active && s.weekday !== null && s.startTime !== null && s.endTime !== null,
    ).length,
  );

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** Copy del error de generación, para el .notice DENTRO del modal (§8.4): distinto de
   *  errorText(), que es el de la lista/guardado y vive en el banner de la página. */
  protected generarErrorText(): string {
    const err = this.facade.generateError();
    return err ? domainErrorMessage(err) : '';
  }

  protected rango(s: Schedule): string {
    if (s.startTime === null || s.endTime === null) return '—';
    return `${s.startTime} – ${s.endTime}`;
  }

  protected dia(weekday: number | null): string {
    return weekdayLabel(weekday);
  }

  /** Cancha, Grupo y Profesor se resuelven por .find() sobre el lookup, con '—' cuando no
   *  está — igual que en Planes y Alumnos (§8.3). */
  protected courtName(id: string): string {
    return this.facade.courts().find((c) => c.id === id)?.name ?? '—';
  }

  protected coachName(id: string): string {
    return this.facade.coaches().find((c) => c.id === id)?.displayName ?? '—';
  }

  protected groupName(id: string): string {
    return this.facade.categoryGroups().find((g) => g.id === id)?.name ?? '—';
  }

  /** clearGenerateError() antes de abrir: regla 4 de §8.0, un error viejo no puede aparecer
   *  en una apertura nueva (mismo motivo que openNew()/openEdit() con clearError()). */
  protected openGenerar(): void {
    this.facade.clearGenerateError();
    this.generar().open();
  }

  protected async onGenerarConfirmado(input: SessionGenerationInput): Promise<void> {
    const r = await this.facade.generate(input);
    // null = falló: el modal queda ABIERTO, que es donde se corrige el rango (§4, §8.4).
    if (r === null) return;
    this.generar().close();
    // created === 0 sigue siendo 'ok': que no haya nada nuevo que generar es un resultado
    // válido, y el desc lo explica solo.
    this.toast.show('ok', 'Clases generadas', `${r.created} creadas · ${r.skipped} ya existían.`);
  }

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en un alta. */
  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(schedule: Schedule): void {
    this.facade.clearError();
    this.editing.set(schedule);
    this.form().open(schedule);
  }

  protected askDelete(schedule: Schedule): void {
    this.deleting.set(schedule);
    this.confirm().open();
  }

  /** Sin un campo "nombre" en Schedule, el día + rango es lo que identifica la fila para
   *  quien confirma el borrado. */
  protected deleteItemName(): string {
    const s = this.deleting();
    if (!s) return 'este horario';
    return `el horario de ${weekdayLabel(s.weekday)} ${this.rango(s)}`;
  }

  protected async onSaved(input: ScheduleInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    // El modal queda ABIERTO si falló: es donde el usuario puede corregir.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show('ok', 'Horario guardado', editing ? 'Se actualizaron los datos.' : 'Se creó el horario.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const schedule = this.deleting();
    if (!schedule) return;
    await this.facade.remove(schedule.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Horario eliminado', 'Se eliminó el horario.');
  }
}
