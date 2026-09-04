import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { CategoryGroup, CategoryGroupInput } from '@domain/entities/category-group';

/**
 * El mismo componente para alta y edición: `open(null)` es alta, `open(grupo)` es edición.
 *
 * No valida: emite lo que hay y la facade corre createCategoryGroupDraft, que es la única
 * sede de la invariante. Duplicar el "nombre requerido" acá daría dos copys que se
 * desincronizan.
 *
 * Un solo campo porque la membresía del grupo (qué categorías tiene) NO se puede leer:
 * ningún endpoint del backend incluye `items`. Ver §2.3 del spec.
 */
@Component({
  selector: 'app-grupo-categoria-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="group() ? 'Editar grupo' : 'Nuevo grupo'" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). Acá es donde se corrige. -->
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

      <div class="field field-dense">
        <label for="grupo-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <input id="grupo-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class GrupoCategoriaFormModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<CategoryGroupInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** El grupo en edición, o null en alta. Lo pone open(), no un input: ver ahí por qué. */
  protected readonly group = signal<CategoryGroup | null>(null);

  protected readonly name = signal('');

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con el grupo por PARÁMETRO. Las dos partes importan.
   *
   * Con un effect() sobre un input, Angular corta el set cuando el valor nuevo es Object.is-igual
   * al viejo: dar de alta dos grupos seguidos (`editing` sigue en null) reabría el formulario con
   * lo que se acababa de tipear, y un Guardar de más creaba un duplicado.
   *
   * Y leer el input DENTRO de open() tampoco alcanza: la página hace `editing.set(g); form().open()`
   * y el binding recién se refresca en la detección de cambios, así que el input todavía tiene el
   * valor ANTERIOR — el mismo hazard que documenta grupo-detail-page.component.ts:60-63. El
   * parámetro es el único valor que ya está fresco cuando se abre.
   */
  open(group: CategoryGroup | null): void {
    this.group.set(group);
    this.name.set(group?.name ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({ name: this.name() });
  }
}
