import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { Coach, CoachInput } from '@domain/entities/coach';

/**
 * Sólo EDICIÓN de la descripción de un profesor existente. Por eso `open()` pide un Coach y
 * no acepta null, a diferencia de los otros cinco modales del proyecto. El ALTA vive en el
 * modal hermano, `profesor-nuevo-modal.component.ts` (misma carpeta).
 *
 * Un solo campo, porque `PATCH /coaches/:id` sólo escribe `description` (§3.10). El nombre
 * va como subtítulo y no como campo deshabilitado: un control que no puede funcionar es
 * peor que su ausencia.
 */
@Component({
  selector: 'app-profesor-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Editar profesor" [subtitle]="coach()?.displayName ?? ''" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). -->
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

      <div class="field field-dense">
        <label for="profesor-descripcion">Descripción</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <textarea id="profesor-descripcion" class="control" autofocus
                  [value]="description()" (input)="description.set(value($event))"></textarea>
        <p class="hint">Es lo único editable: el nombre y el email se cambian desde el usuario.</p>
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save"
                [disabled]="saving()" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class ProfesorFormModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  /** true mientras la escritura está en vuelo: regla 5 de §8.0. */
  readonly saving = input(false);
  readonly saved = output<CoachInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** El profesor en edición. Lo pone open(), no un input: ver ahí por qué. */
  protected readonly coach = signal<Coach | null>(null);
  protected readonly description = signal('');

  protected value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con el profesor por PARÁMETRO (regla 3 de §8.0).
   * Las dos partes importan: un effect() sobre un input no se re-dispara cuando el valor es
   * Object.is-igual, y leer el input dentro de open() devuelve el valor ANTERIOR porque el
   * binding se refresca recién en la detección de cambios.
   */
  open(coach: Coach): void {
    this.coach.set(coach);
    this.description.set(coach.description ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  /** Emite lo que hay; createCoachDraft (dominio) es el que recorta y decide el null. */
  protected onSave(): void {
    this.saved.emit({ description: this.description() });
  }
}
