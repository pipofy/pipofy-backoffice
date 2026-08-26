import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { PlanesFacade } from './planes.facade';
import { PlanFormModalComponent } from './plan-form-modal.component';
import { PlanCategoriasModalComponent } from './plan-categorias-modal.component';
import { formatPlanPrice } from './plan-price';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { catalogLabel } from '@data/catalog-labels';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { Plan, PlanInput } from '@domain/entities/plan';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category } from '@domain/entities/category';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';

@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [PlanFormModalComponent, PlanCategoriasModalComponent, ConfirmDeleteModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planes-page.component.html',
  styleUrl: './planes-page.component.css',
})
export class PlanesPageComponent {
  protected readonly facade = inject(PlanesFacade);
  private readonly catalogs = inject(CatalogsRepository);
  private readonly categoriesRepo = inject(CategoriesRepository);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(PlanFormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);
  private readonly categorias = viewChild.required(PlanCategoriasModalComponent);

  protected readonly query = signal('');
  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<Plan | null>(null);
  protected readonly deleting = signal<Plan | null>(null);
  protected readonly planTypes = signal<readonly CatalogItem[]>([]);
  protected readonly categories = signal<readonly Category[]>([]);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    // La facade se provee en la ruta PADRE, así que cambiar de tab y volver no recarga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
    if (this.facade.coaches().length === 0) void this.facade.loadCoaches();

    // El catálogo falla en silencio a propósito: sin él el select queda vacío, pero la tabla
    // sigue siendo usable y el error de la lista es el que importa.
    void this.catalogs.planTypes().then((v) => this.planTypes.set(v)).catch(() => undefined);

    // Falla en SILENCIO, mismo criterio que el catálogo de tipos: sin categorías el modal
    // muestra su estado vacío, pero la tabla de planes sigue siendo usable.
    void this.categoriesRepo.list().then((v) => this.categories.set(v)).catch(() => undefined);
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    if (!q) return rows;
    return rows.filter((p) => p.name.toLowerCase().includes(q));
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected price(raw: string | null): string { return formatPlanPrice(raw); }

  /** El nombre del catálogo por id; '—' cuando todavía no llegó o el id no está. */
  protected planTypeName(id: string): string {
    const hit = this.planTypes().find((t) => t.id === id);
    return hit ? catalogLabel(hit.name) : '—';
  }

  protected coachName(id: string | null): string {
    if (id === null) return '—';
    return this.facade.coaches().find((c) => c.id === id)?.displayName ?? '—';
  }

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en un alta. */
  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(plan: Plan): void {
    this.facade.clearError();
    this.editing.set(plan);
    this.form().open(plan);
  }

  /**
   * SIN clearError() de PlanesFacade, a diferencia de openNew/openEdit: el modal de categorías
   * muestra el error de PlanCategoriasFacade, no el de la tabla, y IdSetHintFacade.open() ya lo
   * resetea. Limpiarlo acá sólo borraba el banner de la tabla que el usuario estaba leyendo.
   */
  protected openCategorias(plan: Plan): void {
    this.categorias().open(plan);
  }

  protected askDelete(plan: Plan): void {
    this.deleting.set(plan);
    this.confirm().open();
  }

  protected async onSaved(input: PlanInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    // El modal queda ABIERTO si falló: es donde el usuario puede corregir.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show('ok', 'Plan guardado', editing ? 'Se actualizaron los datos.' : 'Se creó el plan.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const plan = this.deleting();
    if (!plan) return;
    await this.facade.remove(plan.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Plan eliminado', `Se eliminó ${plan.name}.`);
  }
}
