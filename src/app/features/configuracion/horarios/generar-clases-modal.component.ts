import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { SessionGenerationInput } from '@domain/entities/schedule';

/**
 * El guardarraíl de "Generar clases" (§4): crea ClassSession que NO se pueden borrar —no
 * existe DELETE— así que las cuatro piezas de abajo son alcance, no decoración.
 *
 * No inyecta la facade —ninguno de los otros cinco modales de la feature lo hace tampoco—:
 * `generables` llega por input() calculado en la PÁGINA (ver horarios-page.component.ts),
 * y `generate()` no puede pasar por SignalStore.run() (su T es Schedule[], no
 * SessionGenerationResult), así que vive en su propio par de signals en la facade.
 */
@Component({
  selector: 'app-generar-clases-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Generar clases" icon="primary">
      <div class="field field-dense">
        <label for="generar-desde">Desde</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' (modal.component.ts) -->
        <input id="generar-desde" class="control" type="date" data-test="desde" autofocus
               [value]="from()" (input)="from.set(value($event))" />
      </div>
      <div class="field field-dense">
        <label for="generar-hasta">Hasta</label>
        <input id="generar-hasta" class="control" type="date" data-test="hasta"
               [value]="to()" (input)="to.set(value($event))" />
      </div>

      <!-- El "hasta" no es una comodidad de redacción: el contador de la página sólo puede
           replicar tres de los cinco filtros del service; validFrom/validTo dependen del
           rango elegido y no se conocen acá (§4, §8.4). -->
      <p class="notice hold">
        Se van a generar clases para hasta {{ generables() }} horarios. Las clases creadas no se pueden borrar.
      </p>

      <!-- El error va DENTRO del modal, en su propio .notice: el de la página queda detrás
           del ::backdrop, que tiene scrim + blur(4px) (styles/components.css:254). -->
      @if (error()) {
        <app-notice tone="bad">{{ error() }}</app-notice>
      }

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <!-- .btn-primary, NO .btn-danger: esto CREA, no destruye. El rojo del DS está
             reservado a ConfirmDeleteModalComponent (§8.4). El aviso de irreversibilidad ya
             lo carga el .notice.hold de arriba, que es ámbar: ámbar = cuidado, rojo = destruye. -->
        <button type="button" class="btn btn-primary" data-test="confirmar"
                [disabled]="generating()" (click)="onConfirm()">Generar clases</button>
      </div>
    </app-modal>
  `,
})
export class GenerarClasesModalComponent {
  /** Los que generateSessions REALMENTE va a procesar, hasta donde la página puede saberlo. */
  readonly generables = input.required<number>();
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  /** true mientras la request está en vuelo: regla 5 de §8.0, y acá el doble click DUPLICA
   *  de verdad (§3.11, findFirst+create sin transacción y sin @@unique). */
  readonly generating = input(false);
  readonly confirmed = output<SessionGenerationInput>();

  private readonly modal = viewChild.required(ModalComponent);

  protected readonly from = signal('');
  protected readonly to = signal('');

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  /**
   * Siembra el rango en CADA apertura, con aritmética UTC para que el huso no corra el día.
   * Cuatro semanas es el horizonte con el que trabaja un club (§4), y obliga a la persona a
   * ampliar a propósito si quiere más.
   */
  open(): void {
    const hoy = new Date();
    const from = hoy.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 28))
      .toISOString().slice(0, 10);
    this.from.set(from);
    this.to.set(to);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  /** Emite el rango crudo, sin validar: createSessionGenerationDraft es la única sede de las
   *  invariantes (rango invertido, fecha imposible, más de 60 días), y vive en la facade. */
  protected onConfirm(): void {
    this.confirmed.emit({ from: this.from(), to: this.to() });
  }
}
