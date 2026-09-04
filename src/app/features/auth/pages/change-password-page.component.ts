import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { formMessage } from '../form-message';
import { PasswordFacade } from '../password.facade';

/**
 * Cambio obligatorio de contraseña. Cuelga FUERA del shell (app.routes.ts) porque authGuard
 * manda acá cuando `mustChangePassword`: adentro sería un loop de redirects.
 *
 * ponytail: sin medidor de fuerza. `passwordStrength()` vive en features/onboarding y
 * features/* no puede importar de otra feature (boundaries), así que reusarlo pide moverlo a
 * shared/. El mínimo real lo pone la API (MinLength(8)) y eso es lo que se valida. Si el
 * medidor se pide también acá, ahí sí: mover password-strength.ts a shared/validators/.
 */
@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, BrandmarkComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="masthead"><app-brandmark link="/" /></header>

      <form class="card" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="step-head">
          <h2>Cambiá tu contraseña</h2>
          <p>Tu cuenta se creó con una contraseña provisoria. Elegí una propia para seguir.</p>
        </div>

        <div class="field">
          <label for="current">Contraseña actual</label>
          <input id="current" type="password" formControlName="currentPassword"
                 autocomplete="current-password" placeholder="La que te dieron" />
        </div>

        <div class="field">
          <label for="nueva">Contraseña nueva</label>
          <input id="nueva" type="password" formControlName="newPassword"
                 autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
        </div>

        <div class="field">
          <label for="repetir">Repetí la contraseña nueva</label>
          <input id="repetir" type="password" formControlName="repeatPassword"
                 autocomplete="new-password" placeholder="Otra vez" />
        </div>

        @if (message(); as msg) {
          <app-notice tone="bad">{{ msg }}</app-notice>
        }

        <button type="submit" class="btn btn-cta" [disabled]="facade.loading()">
          {{ facade.loading() ? 'Guardando…' : 'Guardar y entrar' }}
        </button>
      </form>
    </main>
  `,
  styleUrl: './auth-page.css',
  styles: [`
    .step-head h2{font-size:var(--text-xl)}
    .step-head p{font-size:var(--text-sm);color:var(--color-fg-muted);margin-top:var(--space-xs)}
    .field input:focus-visible{outline:2.5px solid var(--color-ring);outline-offset:2px}
  `],
  providers: [PasswordFacade],
})
export class ChangePasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly facade = inject(PasswordFacade);

  protected readonly form = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
    newPassword: this.fb.control('', [Validators.required, Validators.minLength(8)]),
    repeatPassword: this.fb.control('', [Validators.required]),
  });

  private readonly localError = signal('');

  protected readonly message = computed(() => formMessage(this.localError(), this.facade.error()));

  protected async onSubmit(): Promise<void> {
    this.localError.set('');
    const { currentPassword, newPassword, repeatPassword } = this.form.getRawValue();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.localError.set('Completá los tres campos; la nueva necesita 8 caracteres o más.');
      return;
    }
    // Antes de llamar a la API: con un typo acá el usuario se queda afuera de su cuenta
    // con una contraseña que nunca vio.
    if (newPassword !== repeatPassword) {
      this.localError.set('Las contraseñas nuevas no coinciden.');
      return;
    }

    await this.facade.change(currentPassword ?? '', newPassword ?? '');
    if (!this.facade.done()) return;
    await this.router.navigateByUrl('/dashboard')
      .catch((e) => console.error('[auth] redirect post-cambio de clave falló', e));
  }
}
