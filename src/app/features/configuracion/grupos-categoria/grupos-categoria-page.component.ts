import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { GruposCategoriaFacade } from './grupos-categoria.facade';
import { GrupoCategoriaFormModalComponent } from './grupo-categoria-form-modal.component';
import { GrupoItemsModalComponent } from './grupo-items-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { CategoryGroup, CategoryGroupInput } from '@domain/entities/category-group';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category } from '@domain/entities/category';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-grupos-categoria-page',
  standalone: true,
  imports: [
    GrupoCategoriaFormModalComponent,
    GrupoItemsModalComponent,
    ConfirmDeleteModalComponent,
    PlaceholderComponent,
    NoticeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grupos-categoria-page.component.html',
  styleUrl: './grupos-categoria-page.component.css',
})
export class GruposCategoriaPageComponent {
  protected readonly facade = inject(GruposCategoriaFacade);
  private readonly toast = inject(ToastService);
  private readonly categoriesRepo = inject(CategoriesRepository);

  private readonly form = viewChild.required(GrupoCategoriaFormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);
  private readonly items = viewChild.required(GrupoItemsModalComponent);

  protected readonly query = signal('');
  protected readonly categories = signal<readonly Category[]>([]);
  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<CategoryGroup | null>(null);
  protected readonly deleting = signal<CategoryGroup | null>(null);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    // La facade se provee en la ruta PADRE, así que cambiar de tab y volver no recarga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Fallan en silencio, igual que los catálogos de canchas: sin categorías el modal queda
    // vacío, pero la tabla de grupos sigue siendo usable.
    void this.categoriesRepo.list().then((v) => this.categories.set(v)).catch(() => undefined);
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    if (!q) return rows;
    return rows.filter((g) => g.name.toLowerCase().includes(q));
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Ningún grupo coincide con la búsqueda' : 'Todavía no cargaste ningún grupo de categoría',
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

  protected openEdit(group: CategoryGroup): void {
    this.facade.clearError();
    this.editing.set(group);
    this.form().open(group);
  }

  protected openItems(group: CategoryGroup): void {
    this.items().open(group);
  }

  protected askDelete(group: CategoryGroup): void {
    this.deleting.set(group);
    this.confirm().open();
  }

  protected async onSaved(input: CategoryGroupInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    // El modal queda ABIERTO si falló: es donde el usuario puede corregir.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show(
      'ok',
      'Grupo guardado',
      editing ? 'Se actualizaron los datos.' : 'Se creó el grupo.',
    );
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const group = this.deleting();
    if (!group) return;
    await this.facade.remove(group.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Grupo eliminado', `Se eliminó ${group.name}.`);
  }
}
