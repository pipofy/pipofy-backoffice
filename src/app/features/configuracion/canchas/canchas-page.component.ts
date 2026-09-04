import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { CanchasFacade } from './canchas.facade';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { catalogLabel } from '@data/catalog-labels';
import { CanchaFormModalComponent } from './cancha-form-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { Court, CourtInput } from '@domain/entities/court';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-canchas-page',
  standalone: true,
  imports: [CanchaFormModalComponent, ConfirmDeleteModalComponent, PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canchas-page.component.html',
  styleUrl: './canchas-page.component.css',
})
export class CanchasPageComponent {
  protected readonly facade = inject(CanchasFacade);
  private readonly catalogs = inject(CatalogsRepository);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(CanchaFormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);

  protected readonly query = signal('');
  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<Court | null>(null);
  protected readonly deleting = signal<Court | null>(null);
  protected readonly surfaceTypes = signal<readonly CatalogItem[]>([]);
  protected readonly courtStatuses = signal<readonly CatalogItem[]>([]);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    // La facade se provee en la ruta PADRE, así que cambiar de tab y volver no recarga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Los catálogos fallan en silencio a propósito: sin ellos los selects quedan vacíos,
    // pero la tabla sigue siendo usable y el error de la lista es el que importa.
    void this.catalogs.surfaceTypes().then((v) => this.surfaceTypes.set(v)).catch(() => undefined);
    void this.catalogs.courtStatuses().then((v) => this.courtStatuses.set(v)).catch(() => undefined);
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    if (!q) return rows;
    return rows.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q),
    );
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Ninguna cancha coincide con la búsqueda' : 'Todavía no cargaste ninguna cancha',
  );

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  /** El nombre del catálogo por id; '—' cuando la cancha no tiene el FK cargado. */
  protected surfaceName(id: string | null): string {
    const hit = this.surfaceTypes().find((s) => s.id === id);
    return hit ? catalogLabel(hit.name) : '—';
  }

  protected statusName(id: string | null): string {
    const hit = this.courtStatuses().find((s) => s.id === id);
    return hit ? catalogLabel(hit.name) : '—';
  }

  /**
   * clearError() antes de abrir: la página le pasa su error al modal, y sin esto un error viejo
   * del load() aparecería adentro de un formulario recién abierto que no tiene nada que ver.
   */
  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(court: Court): void {
    this.facade.clearError();
    this.editing.set(court);
    this.form().open(court);
  }

  protected askDelete(court: Court): void {
    this.deleting.set(court);
    this.confirm().open();
  }

  protected async onSaved(input: CourtInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    // El modal queda ABIERTO si falló: es donde el usuario puede corregir.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show('ok', 'Cancha guardada', editing ? 'Se actualizaron los datos.' : 'Se creó la cancha.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const court = this.deleting();
    if (!court) return;
    await this.facade.remove(court.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Cancha eliminada', `Se eliminó ${court.name}.`);
  }
}
