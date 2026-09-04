import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';
import { FieldErrorComponent } from '@shared/ui/field-error.component';
import { domainErrorMessage } from '@domain/errors';
import { EMAIL_RE } from '@shared/validators/email';
import { VerificationFacade } from '../verification.facade';

@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, BrandmarkComponent, NoticeComponent, PlaceholderComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="masthead"><app-brandmark link="/" /></header>

      <section class="card">
        @if (verifying()) {
          <app-placeholder tone="loading" title="Verificando tu email…" />
        } @else if (facade.verified()) {
          <div class="badge ok" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
          <h2>Tu email está verificado</h2>
          <p>Ya podés entrar a PipoFy.</p>
          <a class="btn btn-cta" routerLink="/login">Iniciar sesión</a>
        } @else {
          <div class="badge err" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 7v6M12 17v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" /></svg>
          </div>
          <h2>No pudimos verificar tu email</h2>
          <app-notice tone="bad">{{ errorMessage() }}</app-notice>

          <div class="field">
            <label for="email">Tu email</label>
            <input id="email" type="email" inputmode="email" [formControl]="emailCtrl"
                   autocapitalize="off" spellcheck="false" placeholder="martin@clubsolaris.com" />
            <app-field-error [show]="emailCtrl.invalid && emailCtrl.touched" message="Ingresá un email válido." />
          </div>

          @if (resending()) {
            <app-placeholder tone="loading" title="Reenviando el link…" />
          }
          <button type="button" class="btn btn-cta" [disabled]="facade.loading()" (click)="resend()">
            Reenviar el link
          </button>
        }
      </section>
    </main>
  `,
  styleUrl: './auth-page.css',
  styles: [`
    .card{text-align:center}
    .badge{width:56px;height:56px;margin:0 auto;border-radius:50%;display:grid;place-items:center}
    .badge.ok{background:var(--color-accent-soft);color:var(--color-accent-strong)}
    .badge.err{background:var(--color-destructive-soft);color:var(--color-destructive)}
    .badge svg{width:28px;height:28px}
    .card h2{font-size:var(--text-xl)}
    .card p{font-size:var(--text-sm);color:var(--color-fg-muted)}
    .field{text-align:left}
  `],
  providers: [VerificationFacade],
})
export class VerifyEmailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly facade = inject(VerificationFacade);

  private readonly sinToken = signal(false);

  // Nombra qué operación está en vuelo: loading() del facade es un solo booleano compartido
  // entre verify() y resend(), y sin esto la pantalla mostraba "Verificando tu email…"
  // mientras en realidad estaba reenviando el link.
  private readonly operation = signal<'verify' | 'resend' | null>(null);
  protected readonly verifying = computed(() => this.facade.loading() && this.operation() === 'verify');
  protected readonly resending = computed(() => this.facade.loading() && this.operation() === 'resend');

  protected readonly emailCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(EMAIL_RE)],
  });

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.operation.set('verify');
      void this.facade.verify(token);
    } else {
      this.sinToken.set(true);
    }
  }

  protected errorMessage(): string {
    if (this.sinToken()) return 'El link no tiene token. Pedí uno nuevo desde el botón de abajo.';
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : 'El link venció o ya fue usado.';
  }

  protected async resend(): Promise<void> {
    if (this.emailCtrl.invalid) {
      this.emailCtrl.markAsTouched();
      return;
    }
    const email = this.emailCtrl.value.trim();
    this.operation.set('resend');
    await this.facade.resend(email);
    if (this.facade.error()) return;
    // navigate() puede rechazar por motivos ajenos a que la ruta no exista todavía (falla al
    // cargar un chunk lazy, un guard que tira) — sin manejar el rechazo queda como unhandled
    // rejection y no cambia nada más para el usuario, que ya recibió su reenvío.
    await this.router.navigate(['/revisa-tu-mail'], { queryParams: { email } })
      .catch((e) => console.error('[auth] redirect a /revisa-tu-mail falló', e));
  }
}
