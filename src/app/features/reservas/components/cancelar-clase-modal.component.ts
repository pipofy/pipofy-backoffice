import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { CancelClassInput } from '@domain/entities/class-cancellation';

/**
 * Qué se está por cancelar, en copy ya armado. El modal NO conoce ClassSession: recibe la
 * frase y el número, igual que ConfirmDeleteModalComponent recibe `itemName` y no la entidad.
 * Así el mismo modal sirve para una clase y para el día entero.
 */
export interface CancelScope {
  /** "la clase de las 18:00 en Cancha 1" o "las 5 clases del 26/08". Va después de "¿Cancelar". */
  readonly what: string;
  /** Anotados afectados. Ver el comentario del template: es un piso, no un total exacto. */
  readonly affected: number;
}

/**
 * Cancelar no se deshace y le escribe a gente real, así que este modal es la feature: el
 * checkbox y el motivo son la decisión, no un trámite antes del botón.
 *
 * NO cancela: emite `confirmed` y la página decide, mismo criterio que
 * ConfirmDeleteModalComponent.
 */
@Component({
  selector: 'app-cancelar-clase-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Cancelar" icon="danger">
      <!-- El error va DENTRO del modal por lo mismo que en el form de alumnos: el .notice de
           la página queda detrás del ::backdrop, que tiene scrim + blur. -->
      @if (error()) { <p class="notice hold form-error" role="alert">{{ error() }}</p> }

      <p>¿Cancelar {{ scope().what }}? Esto no se puede deshacer.</p>

      @if (scope().affected > 0) {
        <!-- "al menos" y no el número exacto: availableSpots cuenta confirmadas + holds
             vigentes, y deja afuera las pending_review —las que entran por WhatsApp sin
             plan—, que el backend SÍ cancela. Prometer un total que puede quedar corto sería
             peor que no dar ninguno. -->
        <p class="a-body">
          Se cancelan también las reservas de al menos {{ scope().affected }}
          {{ scope().affected === 1 ? 'alumno' : 'alumnos' }} y se les devuelve el crédito
          a quienes lo hayan gastado.
        </p>
      }

      <div class="field field-dense">
        <label for="cancel-motivo">Motivo</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' (modal.component.ts) -->
        <textarea id="cancel-motivo" class="control" autofocus data-test="cancel-motivo"
                  [value]="reason()" (input)="reason.set(value($event))"></textarea>
        @if (notify()) {
          <p class="hint">Este texto es el que les va a llegar por WhatsApp.</p>
        }
      </div>

      <!-- .checkbox-row y NO un .field: el selector .field input es de DESCENDENCIA y le
           mete width:100% y borde a cualquier input, y convertiría el checkbox en una caja de
           texto. El primitivo de styles/components.css:134 resuelve la geometría. -->
      <label class="checkbox-row" for="cancel-avisar">
        <input id="cancel-avisar" type="checkbox" data-test="cancel-avisar"
               [checked]="notify()" (change)="notify.set(checked($event))" />
        Avisarles por WhatsApp
      </label>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Volver</button>
        <button type="button" class="btn btn-danger" data-test="cancel-confirm" (click)="onConfirm()">
          Cancelar {{ scope().affected === 0 ? 'igual' : '' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`.form-error{margin-bottom:var(--space-md)}`],
})
export class CancelarClaseModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly confirmed = output<CancelClassInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** Lo pone open(), no un input: ver ahí por qué. */
  protected readonly scope = signal<CancelScope>({ what: '', affected: 0 });

  protected readonly reason = signal('');
  protected readonly notify = signal(false);

  protected value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  /**
   * Siembra IMPERATIVA en cada apertura, con el alcance por PARÁMETRO: mismo hazard que
   * AlumnoFormModalComponent.open() — un effect() sobre un input no se re-dispara cuando el
   * valor es Object.is-igual, y leer el input dentro de open() devuelve el anterior.
   *
   * El motivo se limpia en CADA apertura: un motivo escrito para la clase de las 18:00 no
   * puede quedar cargado al abrir la de las 20:00.
   */
  open(scope: CancelScope): void {
    this.scope.set(scope);
    this.reason.set('');
    this.notify.set(false);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  /**
   * NO cierra: la página cierra sólo si la escritura salió bien. Cerrar acá se llevaría
   * puesto el motivo ya tipeado cuando el backend rechaza (mismo criterio que onCobrar).
   */
  protected onConfirm(): void {
    this.confirmed.emit({ reason: this.reason(), notify: this.notify() });
  }
}
