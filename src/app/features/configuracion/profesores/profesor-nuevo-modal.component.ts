import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NewUserInput } from '@domain/entities/new-user';
import { EMAIL_RE } from '@shared/validators/email';

/**
 * ALTA, no edición. Modal aparte de `ProfesorFormModalComponent` a propósito: los campos son
 * disjuntos —acá email/nombre/apellido, allá sólo `description`— y su `open(coach: Coach)`
 * está construido alrededor de un coach no-null. Un flag `mode` ramificaría template,
 * siembra, título y tipo emitido: más código que este archivo (§3.5).
 *
 * El guard de doble submit vive en `saving`, un signal INTERNO —no un input— igual que en
 * AttendanceModalComponent: en zoneless el input del padre no se propaga entre dos clicks
 * seguidos, así que `[disabled]` solo no alcanza. La página llama a `markFailed()` para
 * liberarlo cuando la escritura falla.
 */
@Component({
  selector: 'app-profesor-nuevo-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Nuevo profesor" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css). -->
      @if (error()) {
        <p class="notice hold form-error" role="alert">{{ error() }}</p>
      }

      <div class="field field-dense">
        <label for="profesor-email">Email</label>
        <!-- eslint-disable @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' -->
        <input
          id="profesor-email"
          class="control"
          type="email"
          autofocus
          [value]="email()"
          (input)="email.set(value($event))"
        />
        <!-- eslint-enable @angular-eslint/template/no-autofocus -->
        @if (emailInvalido()) {
          <p class="hint" role="alert">Ingresá un email válido.</p>
        }
      </div>

      <div class="field field-dense">
        <label for="profesor-nombre">Nombre</label>
        <input
          id="profesor-nombre"
          class="control"
          type="text"
          [value]="nombre()"
          (input)="nombre.set(value($event))"
        />
      </div>

      <div class="field field-dense">
        <label for="profesor-apellido">Apellido</label>
        <input
          id="profesor-apellido"
          class="control"
          type="text"
          [value]="apellido()"
          (input)="apellido.set(value($event))"
        />
      </div>

      <p class="hint">
        Se le crea una cuenta y se le manda un mail con una contraseña temporal, que va a tener que
        cambiar la primera vez que entre.
      </p>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="save"
          [disabled]="saving()"
          [class.loading]="saving()"
          (click)="onSave()"
        >
          Crear profesor
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .form-error {
        margin-bottom: var(--space-md);
      }
    `,
  ],
})
export class ProfesorNuevoModalComponent {
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<NewUserInput>();

  private readonly modal = viewChild.required(ModalComponent);

  protected readonly email = signal('');
  protected readonly nombre = signal('');
  protected readonly apellido = signal('');
  /** Guard de doble submit. Interno, no input: ver el docstring de la clase. */
  protected readonly saving = signal(false);
  /** El aviso de email inválido aparece recién después del primer intento, no al tipear. */
  protected readonly intentado = signal(false);

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected emailInvalido(): boolean {
    return this.intentado() && !EMAIL_RE.test(this.email().trim());
  }

  /** Siembra imperativa en CADA apertura: el <dialog> no se destruye entre aperturas. */
  open(): void {
    this.email.set('');
    this.nombre.set('');
    this.apellido.set('');
    this.saving.set(false);
    this.intentado.set(false);
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  /** La llama la página cuando la escritura falló, para poder reintentar. */
  markFailed(): void {
    this.saving.set(false);
  }

  protected onSave(): void {
    if (this.saving()) return;
    this.intentado.set(true);
    // El formato del email se valida acá, no en createNewUserDraft: domain no puede importar
    // de shared (boundaries). Mismo reparto que el wizard de onboarding.
    if (!EMAIL_RE.test(this.email().trim())) return;
    this.saving.set(true);
    this.saved.emit({
      email: this.email(),
      nombre: this.nombre(),
      apellido: this.apellido(),
    });
  }
}
