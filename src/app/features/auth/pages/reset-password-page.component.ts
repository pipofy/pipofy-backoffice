import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { formMessage } from '../form-message';
import { EMAIL_RE } from '@shared/validators/email';
import { PasswordFacade } from '../password.facade';

/**
 * Los DOS pasos del reset en una sola pantalla, discriminados por `?token=`: sin token pide
 * el link, con token elige la contraseña nueva.
 *
 * Un solo componente y no dos porque el link del mail lo fija la API
 * (`${FRONTEND_URL}/reset-password?token=...`, auth.service.ts:239): la ruta del segundo paso
 * NO es negociable, y el primero necesita una ruta igual. Mismo patrón de token-en-query que
 * VerifyEmailPageComponent.
 */
@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, BrandmarkComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="masthead"><app-brandmark link="/" /></header>

      @if (facade.done()) {
        <section class="card">
          @if (token()) {
            <h2>Listo</h2>
            <p>Tu contraseña quedó cambiada. Entrá con la nueva.</p>
          } @else {
            <h2>Revisá tu correo</h2>
            <p>Si ese email tiene cuenta, te mandamos un link para elegir una contraseña nueva. Vence en una hora.</p>
          }
          <a class="btn btn-cta" routerLink="/login">Ir a iniciar sesión</a>
        </section>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          @if (token()) {
            <div class="step-head">
              <h2>Elegí una contraseña nueva</h2>
              <p>Vas a tener que volver a iniciar sesión en todos tus dispositivos.</p>
            </div>

            <div class="field">
              <label for="nueva">Contraseña nueva</label>
              <input id="nueva" type="password" formControlName="newPassword"
                     autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
            </div>

            <div class="field">
              <label for="repetir">Repetí la contraseña</label>
              <input id="repetir" type="password" formControlName="repeatPassword"
                     autocomplete="new-password" placeholder="Otra vez" />
            </div>
          } @else {
            <div class="step-head">
              <h2>¿Olvidaste tu contraseña?</h2>
              <p>Poné tu email y te mandamos un link para elegir una nueva.</p>
            </div>

            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" inputmode="email" formControlName="email"
                     autocomplete="email" autocapitalize="off" spellcheck="false"
                     placeholder="martin@clubsolaris.com" />
            </div>
          }

          @if (message(); as msg) {
            <app-notice tone="bad">{{ msg }}</app-notice>
          }

          <button type="submit" class="btn btn-cta" [disabled]="facade.loading()">
            {{ facade.loading() ? 'Enviando…' : (token() ? 'Cambiar contraseña' : 'Enviarme el link') }}
          </button>

          <p class="legal"><a routerLink="/login">Volver a iniciar sesión</a></p>
        </form>
      }
    </main>
  `,
  styleUrl: './auth-page.css',
  styles: [`
    .step-head h2{font-size:var(--text-xl)}
    .step-head p{font-size:var(--text-sm);color:var(--color-fg-muted);margin-top:var(--space-xs)}
    .card>h2{font-size:var(--text-xl)}
    .card>p{font-size:var(--text-sm);color:var(--color-fg-muted)}
    .field input:focus-visible{outline:2.5px solid var(--color-ring);outline-offset:2px}
    .legal{font-size:var(--text-sm);color:var(--color-fg-muted);text-align:center}
    .legal a{color:var(--color-primary);font-weight:600}
  `],
  providers: [PasswordFacade],
})
export class ResetPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly facade = inject(PasswordFacade);

  protected readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');

  // Un solo form con los tres controles: cuál se valida lo decide onSubmit() según el paso.
  // Dos FormGroups para tres inputs que nunca conviven en pantalla no compran nada.
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.pattern(EMAIL_RE)]),
    newPassword: this.fb.control('', [Validators.minLength(8)]),
    repeatPassword: this.fb.control(''),
  });

  private readonly localError = signal('');

  protected readonly message = computed(() => formMessage(this.localError(), this.facade.error()));

  protected async onSubmit(): Promise<void> {
    this.localError.set('');
    const { email, newPassword, repeatPassword } = this.form.getRawValue();

    if (!this.token()) {
      if (!email || this.form.controls.email.invalid) {
        this.localError.set('Ingresá un email válido.');
        return;
      }
      await this.facade.requestReset(email);
      return;
    }

    if (!newPassword || this.form.controls.newPassword.invalid) {
      this.localError.set('La contraseña nueva necesita 8 caracteres o más.');
      return;
    }
    if (newPassword !== repeatPassword) {
      this.localError.set('Las contraseñas no coinciden.');
      return;
    }
    await this.facade.confirmReset(this.token(), newPassword);
  }
}
