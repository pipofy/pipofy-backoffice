import { ChangeDetectionStrategy, Component, inject, input, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { Category } from '@domain/entities/category';
import { Plan } from '@domain/entities/plan';
import { domainErrorMessage } from '@domain/errors';
import { PlanCategoriasFacade } from './plan-categorias.facade';

/**
 * A qué categorías les corresponde este plan. Es la pantalla que desbloquea VENDER: desde
 * `bfe503c`, `StudentPlansService.purchase()` rechaza con 400 la venta de un plan sin
 * categorías, y también la de un alumno cuya categoría no esté entre las del plan.
 *
 * El pie dice la verdad incómoda a propósito: la API no devuelve la asignación, así que esto
 * muestra lo cargado desde este navegador. Esconderlo haría que un desfase parezca un bug.
 */
@Component({
  selector: 'app-plan-categorias-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Categorías del plan" [subtitle]="plan()?.name ?? ''" icon="primary">
      @if (errorText()) { <p class="notice hold form-error" role="alert">{{ errorText() }}</p> }

      <!-- FUERA de .field a propósito: .field input es un selector de descendencia y
           convertiría el checkbox en una caja de texto. El primitivo .checkbox-row de
           styles/components.css resuelve la geometría. -->
      @for (cat of categories(); track cat.id) {
        <label class="checkbox-row" [for]="'plan-cat-' + cat.id">
          <input
            type="checkbox"
            [id]="'plan-cat-' + cat.id"
            [checked]="isSelected(cat.id)"
            (change)="onToggle(cat.id, $event)" />
          {{ cat.name || '(sin nombre)' }}
        </label>
      } @empty {
        <p class="a-empty">Todavía no cargaste ninguna categoría.</p>
      }

      <p class="m-sub hint">
        Un plan sin categorías no se puede vender: la API rechaza la compra. Y como no devuelve
        qué categorías tiene un plan, esta lista recuerda lo que cargaste desde este navegador y
        se corrige sola al tildar o destildar.
      </p>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cerrar</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .form-error{margin-bottom:var(--space-md)}
    .hint{margin-top:var(--space-md)}
  `],
})
export class PlanCategoriasModalComponent {
  readonly categories = input.required<readonly Category[]>();

  protected readonly facade = inject(PlanCategoriasFacade);
  private readonly modal = viewChild.required(ModalComponent);

  /** Sólo para el subtítulo. Lo pone open() por parámetro, igual que el form modal. */
  protected readonly plan = signal<Plan | null>(null);

  open(plan: Plan): void {
    this.plan.set(plan);
    this.facade.open(plan.id);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected isSelected(categoryId: string): boolean {
    return this.facade.selected().includes(categoryId);
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onToggle(categoryId: string, e: Event): void {
    void this.facade.toggle(categoryId, (e.target as HTMLInputElement).checked);
  }
}
