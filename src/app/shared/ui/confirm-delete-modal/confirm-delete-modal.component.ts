import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';

/**
 * En el backend el borrado es soft delete, pero para el usuario es borrar y no vuelve:
 * el copy dice eso y no "se archivará".
 *
 * El componente NO borra: emite `confirmed` y la página decide. Así el mismo modal sirve
 * para canchas y categorías sin saber de ninguna de las dos.
 */
@Component({
  selector: 'app-confirm-delete-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="action()" icon="danger">
      <p>¿{{ action() }} {{ itemName() }}? Esta acción no se puede deshacer.</p>
      @if (warning()) { <p class="hint">{{ warning() }}</p> }
      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al botón de eliminar (modal.component.ts) -->
        <button type="button" class="btn btn-danger" data-test="confirm" autofocus (click)="onConfirm()">
          {{ action() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDeleteModalComponent {
  readonly itemName = input.required<string>();
  /** El verbo. Por defecto 'Eliminar', que es lo que hacen casi todos los call sites. */
  readonly action = input('Eliminar');
  /** Aviso de un efecto que el usuario NO ve venir (p. ej. un WhatsApp a un tercero). */
  readonly warning = input('');
  readonly confirmed = output<void>();

  private readonly modal = viewChild.required(ModalComponent);

  open(): void { this.modal().open(); }
  close(): void { this.modal().close(); }

  protected onConfirm(): void {
    this.confirmed.emit();
    this.close();
  }
}
