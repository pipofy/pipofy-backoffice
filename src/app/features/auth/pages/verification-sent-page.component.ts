import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { FieldErrorComponent } from '@shared/ui/field-error.component';
import { domainErrorMessage } from '@domain/errors';
import { EMAIL_RE } from '@shared/validators/email';
import { VerificationFacade } from '../verification.facade';

const COOLDOWN_MS = 60_000;

@Component({
  selector: 'app-verification-sent-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, BrandmarkComponent, NoticeComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="masthead"><app-brandmark link="/" /></header>

      <section class="card">
        <div class="badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8" /></svg>
        </div>
        <h2>Revisá tu correo</h2>

        @if (email()) {
          <p>Te mandamos un link de verificación a <b>{{ email() }}</b>. Abrilo para activar tu cuenta.</p>
          <app-field-error [show]="prefilledInvalid()" message="Ingresá un email válido." />
        } @else {
          <p>Ingresá tu email y te reenviamos el link de verificación.</p>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" inputmode="email" [formControl]="emailCtrl"
                   autocapitalize="off" spellcheck="false" placeholder="martin@clubsolaris.com" />
            <app-field-error [show]="emailCtrl.invalid && emailCtrl.touched" message="Ingresá un email válido." />
          </div>
        }

        @if (facade.sent()) {
          <app-notice tone="ok">Si ese email está registrado, te reenviamos el link.</app-notice>
        }
        @if (facade.error(); as err) {
          <app-notice tone="bad">{{ domainErrorMessage(err) }}</app-notice>
        }

        <button type="button" class="btn btn-ghost" [disabled]="facade.loading() || cooldown()"
                (click)="resend()">
          {{ cooldown() ? 'Reenviar (esperá un momento)' : 'Reenviar mail' }}
        </button>

        <a class="btn btn-cta" routerLink="/login">Ir a iniciar sesión</a>
      </section>
    </main>
  `,
  styleUrl: './auth-page.css',
  styles: [`
    .card{text-align:center}
    .badge{width:56px;height:56px;margin:0 auto;border-radius:50%;display:grid;place-items:center;background:var(--color-primary-soft);color:var(--color-on-primary-soft)}
    .badge svg{width:28px;height:28px}
    .card h2{font-size:var(--text-xl)}
    .card p{font-size:var(--text-sm);color:var(--color-fg-muted)}
    .field{text-align:left}
  `],
  providers: [VerificationFacade],
})
export class VerificationSentPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly facade = inject(VerificationFacade);
  protected readonly domainErrorMessage = domainErrorMessage;

  protected readonly email = signal(this.route.snapshot.queryParamMap.get('email') ?? '');
  protected readonly emailCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(EMAIL_RE)],
  });
  protected readonly prefilledInvalid = signal(false);

  // ponytail: cooldown SOLO client-side, para que un click nervioso no genere 5 mails
  // idénticos. El rate limit de verdad le corresponde al backend.
  protected readonly cooldown = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected async resend(): Promise<void> {
    const prefilled = this.email();
    const target = prefilled || this.emailCtrl.value.trim();
    // El email prefilled viene de queryParamMap (query param editable a mano, ej.
    // /revisa-tu-mail?email=<lo que sea>), no de algo que la app garantice: se valida con el
    // mismo EMAIL_RE que el campo tipeado, no se asume que "vino del signup".
    if (!EMAIL_RE.test(target)) {
      this.emailCtrl.markAsTouched();
      this.prefilledInvalid.set(true);
      return;
    }
    this.prefilledInvalid.set(false);
    await this.facade.resend(target);
    if (this.facade.error()) return;
    this.cooldown.set(true);
    this.timer = setTimeout(() => this.cooldown.set(false), COOLDOWN_MS);
  }

  ngOnDestroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
  }
}
