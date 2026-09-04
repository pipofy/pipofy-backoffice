import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { CategoriasFacade } from './categorias.facade';
import { CategoriaFormModalComponent } from './categoria-form-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { Category, CategoryInput } from '@domain/entities/category';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-categorias-page',
  standalone: true,
  imports: [CategoriaFormModalComponent, ConfirmDeleteModalComponent, PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categorias-page.component.html',
  styleUrl: './categorias-page.component.css',
})
export class CategoriasPageComponent {
  protected readonly facade = inject(CategoriasFacade);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(CategoriaFormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);

  protected readonly query = signal('');
  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<Category | null>(null);
  protected readonly deleting = signal<Category | null>(null);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
  }

  /** Filtra sobre sorted(), no sobre data(): el orden es de la facade (§Task 10). */
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    return q ? rows.filter((c) => c.name.toLowerCase().includes(q)) : rows;
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Ninguna categoría coincide con la búsqueda' : 'Todavía no cargaste ninguna categoría',
  );

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
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

  protected openEdit(category: Category): void {
    this.facade.clearError();
    this.editing.set(category);
    this.form().open(category);
  }

  protected askDelete(category: Category): void {
    this.deleting.set(category);
    this.confirm().open();
  }

  protected async onSaved(input: CategoryInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    if (this.facade.error()) return;   // el modal queda abierto para corregir
    this.form().close();
    this.toast.show('ok', 'Categoría guardada', editing ? 'Se actualizaron los datos.' : 'Se creó la categoría.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const category = this.deleting();
    if (!category) return;
    await this.facade.remove(category.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Categoría eliminada', `Se eliminó ${category.name}.`);
  }
}
