import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { TimeDialComponent } from './time-dial.component';

/**
 * El campo de hora de toda la app: un control que muestra 'HH:mm' y abre el reloj en un popup.
 *
 * Reemplaza al `<input type="time">` con la misma forma — `[value]` entra, `(valueChange)`
 * sale, siempre 'HH:mm' o '' — así que se cambia uno por otro sin tocar nada más. Lo único
 * que suma es `label`, que es el título del popup, y `controlId` para el `<label for>`.
 *
 * POPUP y no un panel en línea: el reloj mide 260px y el formulario que lo usa ya scrollea,
 * así que en línea o empuja medio formulario o se recorta contra el borde del `.modal-body`.
 * Arriba de todo no compite con nada. `<dialog>` apila en el top layer, así que abrirlo desde
 * adentro de otro modal funciona — es el único lugar del repo donde hay dos abiertos.
 *
 * El popup edita un BORRADOR y recién confirma en "Listo": Cancelar y Escape tienen que
 * devolver la hora anterior, no la que quedó a medio elegir. El dial en cambio es controlado
 * (emite en cada toque), y ese borrador es justamente el estado que alguien tiene que tener.
 */
@Component({
  selector: 'app-time-picker-field',
  standalone: true,
  imports: [ModalComponent, TimeDialComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './time-picker-field.component.css',
  template: `
    <button
      type="button"
      class="control control-btn time-trigger"
      [id]="controlId()"
      aria-haspopup="dialog"
      (click)="open()"
    >
      <span class="tt-val" [class.empty]="value() === ''">{{ value() || '--:--' }}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7" />
        <path d="M12 7.5V12l3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
    </button>

    <app-modal #modal icon="primary" [title]="label()" (closed)="draft.set(null)">
      <svg modal-icon width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7" />
        <path d="M12 7.5V12l3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>

      <!-- Detrás del @if para que se REMONTE en cada apertura: así la vista del dial vuelve a
           arrancar en "hora" sin que nadie tenga que resetearla.
           La comparación con null es EXPLÍCITA y no un @if (draft(); as x): el '' de
           "abierto todavía sin hora" es falsy, y con la forma corta el reloj no se montaba
           justo en el alta. -->
      @if (draft() !== null) {
        <app-time-dial [value]="draft()!" (valueChange)="draft.set($event)" />
      }

      <div class="modal-foot" modal-foot>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él el <dialog> se autoenfoca a sí mismo y el foco no llega a ningún control (modal.component.ts). Va en Cancelar porque un Enter reflejo sobre el foco inicial tiene que ser inocuo. -->
        <button type="button" class="btn btn-ghost" autofocus (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="time-ok"
                [disabled]="draft() === ''" (click)="confirm()">Listo</button>
      </div>
    </app-modal>
  `,
})
export class TimePickerFieldComponent {
  /** 'HH:mm', o '' cuando no hay hora. */
  readonly value = input.required<string>();
  /** Para el `<label for>` de quien lo usa, y para el título del popup. */
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly valueChange = output<string>();

  /**
   * Lo que se está eligiendo, y a la vez si el popup está abierto: `null` es cerrado, `''` es
   * abierto sin hora todavía. UNA sola señal y no un `abierto` aparte — eran dos campos que
   * nunca pueden discrepar, y el que los desincronice deja el reloj montado con un borrador
   * viejo. Sólo sale de acá en confirm().
   */
  protected readonly draft = signal<string | null>(null);

  private readonly modal = viewChild.required(ModalComponent);

  open(): void {
    // Siembra en CADA apertura y desde el input: el valor pudo cambiarlo el formulario (otro
    // registro cargado en el mismo modal) sin pasar por acá.
    this.draft.set(this.value());
    this.modal().open();
  }

  /** Cierra sin confirmar. Lo llama también el botón Cancelar, y el `closed` del modal lo
   *  cubre para Escape y para el click al backdrop. */
  close(): void {
    this.draft.set(null);
    this.modal().close();
  }

  protected confirm(): void {
    this.valueChange.emit(this.draft() ?? '');
    this.close();
  }
}
