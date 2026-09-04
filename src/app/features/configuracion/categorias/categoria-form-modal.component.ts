import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { Category, CategoryInput } from '@domain/entities/category';

/**
 * `levelOrder` viaja como STRING hasta el dominio: '' y '0' son cosas distintas ("sin
 * jerarquizar" y "primera de todas") y un number no puede expresar la diferencia.
 * createCategoryDraft es el único lugar que hace la conversión.
 */
@Component({
  selector: 'app-categoria-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="category() ? 'Editar categoría' : 'Nueva categoría'" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). Acá es donde se corrige. -->
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

      <div class="field">
        <label for="categoria-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <input id="categoria-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>

      <div class="field">
        <label for="categoria-orden">Orden de nivel</label>
        <input id="categoria-orden" class="control" type="number" min="0" step="1"
               placeholder="Sin jerarquizar"
               [value]="levelOrder()" (input)="levelOrder.set(value($event))" />
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class CategoriaFormModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<CategoryInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** La categoría en edición, o null en alta. La pone open(), no un input: ver ahí por qué. */
  protected readonly category = signal<Category | null>(null);

  protected readonly name = signal('');
  protected readonly levelOrder = signal('');

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con la categoría por PARÁMETRO. Mismo razonamiento
   * que CanchaFormModalComponent.open(): un effect() sobre un input no se re-dispara cuando el
   * valor es Object.is-igual (dos altas seguidas reabrían con lo tipeado), y leer el input dentro
   * de open() devuelve el valor ANTERIOR porque el binding se refresca recién en la detección de
   * cambios (hazard documentado en grupo-detail-page.component.ts:60-63).
   */
  open(category: Category | null): void {
    this.category.set(category);
    this.name.set(category?.name ?? '');
    this.levelOrder.set(category?.levelOrder != null ? String(category.levelOrder) : '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({ name: this.name(), levelOrder: this.levelOrder() });
  }
}
