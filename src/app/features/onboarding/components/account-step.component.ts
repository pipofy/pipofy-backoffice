import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldErrorComponent } from './field-error.component';
import { firstErrorMessage } from '../onboarding.validators';
import { strengthInfo } from '../password-strength';

@Component({
  selector: 'app-account-step',
  standalone: true,
  host: { class: 'step' },
  imports: [ReactiveFormsModule, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./onboarding-fields.css'],
  template: `
    <div class="step-head">
      <p class="eyebrow">Paso 2 de 3</p>
      <h2>Creá tu cuenta</h2>
      <p>Con estos datos vas a ingresar a SetPoint.</p>
    </div>

    <div class="fg" [formGroup]="group()">
      <div class="field" [class.err]="isErr('nombre')" [class.ok]="isOk('nombre')">
        <label for="nombre">Nombre <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="nombre" type="text" formControlName="nombre" autocomplete="name" autocapitalize="words" placeholder="Ej: Martín" [attr.aria-invalid]="isErr('nombre') || null" />
          <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        </div>
        <app-field-error [show]="isErr('nombre')" [message]="msg('nombre', NOMBRE_MSGS)" />
      </div>

      <div class="field" [class.err]="isErr('apellido')" [class.ok]="isOk('apellido')">
        <label for="apellido">Apellido <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="apellido" type="text" formControlName="apellido" autocomplete="family-name" autocapitalize="words" placeholder="Ej: Rivas" [attr.aria-invalid]="isErr('apellido') || null" />
          <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        </div>
        <app-field-error [show]="isErr('apellido')" [message]="msg('apellido', APELLIDO_MSGS)" />
      </div>

      <div class="field" [class.err]="isErr('email')" [class.ok]="isOk('email')">
        <label for="email">Email <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="email" type="email" inputmode="email" formControlName="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="martin@clubsolaris.com" [attr.aria-invalid]="isErr('email') || null" />
          <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        </div>
        <app-field-error [show]="isErr('email')" [message]="msg('email', EMAIL_MSGS)" />
      </div>

      <div class="field" [class.err]="isErr('phone')" [class.ok]="isOk('phone')">
        <label for="phone">Teléfono <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="phone" type="tel" inputmode="tel" formControlName="phone" autocomplete="tel" placeholder="Ej: +54 9 11 5555-1234" [attr.aria-invalid]="isErr('phone') || null" />
          <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        </div>
        <app-field-error [show]="isErr('phone')" [message]="msg('phone', PHONE_MSGS)" />
      </div>

      <div class="field" [class.err]="isErr('password')">
        <label for="password">Contraseña <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="password" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" (input)="onPw($any($event.target).value)" [attr.aria-invalid]="isErr('password') || null" />
          <button type="button" class="pw-toggle" [attr.aria-pressed]="showPw()" [attr.aria-label]="showPw() ? 'Ocultar contraseña' : 'Mostrar contraseña'" (click)="showPw.set(!showPw())">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" /></svg>
          </button>
        </div>
        @if (pwValue()) {
          <div [class]="'pw-meter ' + info().cls">
            <div class="pw-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <div class="pw-meta">
              <span class="pw-label">{{ info().label }}</span>
              <span class="pw-tip">{{ info().tip }}</span>
            </div>
            <span class="sr-only" aria-live="polite">Fuerza de la contraseña: {{ info().label }}.</span>
          </div>
        }
        <p class="hint">Usá 8+ caracteres. Sumá mayúsculas, números y símbolos para más fuerza.</p>
        <app-field-error [show]="isErr('password')" [message]="msg('password', PASSWORD_MSGS)" />
      </div>

      <div class="field" [class.err]="confirmErr()" [class.ok]="isOk('confirm') && !confirmErr()">
        <label for="confirm">Repetí la contraseña <span class="req" aria-hidden="true">*</span></label>
        <div class="control">
          <input id="confirm" type="password" formControlName="confirm" autocomplete="new-password" placeholder="Volvé a escribirla" [attr.aria-invalid]="confirmErr() || null" />
          <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        </div>
        <app-field-error [show]="confirmErr()" [message]="confirmMsg()" />
      </div>

      @if (role() === 'club') {
        <div class="field" [class.err]="isErr('nombreClub')" [class.ok]="isOk('nombreClub')">
          <label for="nombreClub">Nombre del club <span class="req" aria-hidden="true">*</span></label>
          <div class="control">
            <input id="nombreClub" type="text" formControlName="nombreClub" autocapitalize="words" placeholder="Ej: Club Solaris" [attr.aria-invalid]="isErr('nombreClub') || null" />
            <span class="ok-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <app-field-error [show]="isErr('nombreClub')" [message]="msg('nombreClub', CLUB_MSGS)" />
        </div>
      }
    </div>
  `,
})
export class AccountStepComponent {
  readonly group = input.required<FormGroup>();
  readonly role = input<'profesor' | 'club' | null>(null);
  protected readonly showPw = signal(false);
  protected readonly pwValue = signal('');
  protected readonly info = computed(() => strengthInfo(this.pwValue()));

  protected readonly NOMBRE_MSGS: Record<string, string> = { required: 'Ingresá tu nombre.', trimmedMinLength: 'El nombre es demasiado corto.' };
  protected readonly APELLIDO_MSGS: Record<string, string> = { required: 'Ingresá tu apellido.', trimmedMinLength: 'El apellido es demasiado corto.' };
  protected readonly CLUB_MSGS: Record<string, string> = { required: 'Ingresá el nombre del club.', trimmedMinLength: 'El nombre del club es demasiado corto.' };
  protected readonly EMAIL_MSGS: Record<string, string> = { required: 'Ingresá tu email.', pattern: 'Ese email no parece válido — revisá que tenga @ y un dominio (ej: nombre@club.com).' };
  protected readonly PHONE_MSGS: Record<string, string> = { required: 'Ingresá un teléfono de contacto.', pattern: 'Ese teléfono no parece válido — usá sólo números, espacios, + y guiones.' };
  protected readonly PASSWORD_MSGS: Record<string, string> = { required: 'Elegí una contraseña.', minlength: 'La contraseña necesita al menos 8 caracteres.' };

  protected onPw(value: string): void { this.pwValue.set(value); }

  protected isErr(name: string): boolean {
    const c = this.group().get(name);
    return !!c && c.invalid && c.touched;
  }
  protected isOk(name: string): boolean {
    const c = this.group().get(name);
    return !!c && c.valid && !!c.value;
  }
  // confirm falla por su propio required O por el error de grupo passwordsMatch.
  protected confirmErr(): boolean {
    const c = this.group().get('confirm');
    if (!c || !c.touched) return false;
    return c.invalid || this.group().hasError('passwordsMatch');
  }
  protected confirmMsg(): string {
    const c = this.group().get('confirm')!;
    if (c.hasError('required')) return 'Repetí la contraseña para confirmarla.';
    if (this.group().hasError('passwordsMatch')) return 'Las contraseñas no coinciden.';
    return '';
  }
  protected msg(name: string, dict: Record<string, string>): string {
    return firstErrorMessage(this.group().get(name)!, dict);
  }
}
