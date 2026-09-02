import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ProfesoresFacade } from './profesores.facade';
import { ProfesorFormModalComponent } from './profesor-form-modal.component';
import { ProfesorNuevoModalComponent } from './profesor-nuevo-modal.component';
import { Coach, CoachInput } from '@domain/entities/coach';
import { NewUserInput } from '@domain/entities/new-user';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';

@Component({
  selector: 'app-profesores-page',
  standalone: true,
  imports: [ProfesorFormModalComponent, ProfesorNuevoModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profesores-page.component.html',
  styleUrl: './profesores-page.component.css',
})
export class ProfesoresPageComponent {
  protected readonly facade = inject(ProfesoresFacade);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(ProfesorFormModalComponent);
  private readonly nuevo = viewChild.required(ProfesorNuevoModalComponent);
  /** Sólo enruta el guardado: el modal recibe el profesor por parámetro en open(). */
  private readonly editing = signal<Coach | null>(null);

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre una tabla que está perfectamente bien.
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en el modal. */
  protected openEdit(coach: Coach): void {
    this.facade.clearError();
    this.editing.set(coach);
    this.form().open(coach);
  }

  protected async onSaved(input: CoachInput): Promise<void> {
    const coach = this.editing();
    if (!coach) return;
    await this.facade.save(coach.id, input);
    // El modal queda ABIERTO si falló: es donde el usuario puede corregir.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show(
      'ok',
      'Profesor actualizado',
      `Se guardó la descripción de ${coach.displayName}.`,
    );
  }

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en el modal. */
  protected openNuevo(): void {
    this.facade.clearError();
    this.nuevo().open();
  }

  protected async onNuevoGuardado(input: NewUserInput): Promise<void> {
    const creado = await this.facade.crear(input);
    if (!creado) {
      // El modal queda ABIERTO: es donde se corrige. markFailed() libera su guard de doble
      // submit, que si no dejaría el botón deshabilitado para siempre.
      this.nuevo().markFailed();
      return;
    }
    this.nuevo().close();
    if (this.facade.error()) return; // el banner ya lo cuenta; no toastear éxito encima
    this.toast.show(
      'ok',
      'Profesor creado',
      `Le mandamos a ${input.email} un mail con su contraseña temporal.`,
    );
  }
}
