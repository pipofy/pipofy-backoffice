import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Role } from '@domain/entities/registration';

@Component({
  selector: 'app-role-step',
  standalone: true,
  host: { class: 'step' },
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-head">
      <p class="eyebrow">Paso 1 de 3</p>
      <h2>¿Cómo vas a usar PipoFy?</h2>
      <p>Elegí tu rol para adaptar el registro. Podés cambiarlo más adelante desde tu cuenta.</p>
    </div>
    <div class="role-grid" role="radiogroup" aria-label="Elegí tu rol">
      <label class="role-card">
        <input type="radio" name="role" value="profesor" [formControl]="control()" />
        <span class="r-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <span class="r-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg></span>
        <h3>Soy profesor</h3>
        <p>Doy clases y quiero gestionar mis grupos, asistencia y cobros.</p>
      </label>
      <label class="role-card">
        <input type="radio" name="role" value="club" [formControl]="control()" />
        <span class="r-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <span class="r-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /><path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
        <h3>Soy dueño de club</h3>
        <p>Administro un club con canchas, profes y varios grupos.</p>
      </label>
    </div>
  `,
  styles: [`
    /* Portado de onboarding.html líneas 73-102 (step-head + role) + breakpoint 240. */
    .step-head{margin-bottom:var(--space-lg)}
    .step-head .eyebrow{font-size:var(--text-2xs);font-weight:700;letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--color-on-primary-soft);margin-bottom:var(--space-xs)}
    .step-head h2{font-size:var(--text-xl)}
    .step-head p{font-size:var(--text-sm);color:var(--color-fg-muted);margin-top:var(--space-xs)}
    .role-grid{display:grid;grid-template-columns:1fr;gap:var(--space-md)}
    .role-card{position:relative;display:flex;flex-direction:column;gap:var(--space-sm);padding:var(--space-lg);border:2px solid var(--color-border-strong);border-radius:var(--radius-md);background:var(--color-surface);cursor:pointer;transition:border-color var(--duration) var(--ease),box-shadow var(--duration) var(--ease),transform var(--duration) var(--ease)}
    .role-card:hover{border-color:var(--color-primary);box-shadow:var(--shadow-md);transform:translateY(-2px)}
    .role-card input{position:absolute;opacity:0;width:1px;height:1px}
    .role-card:has(input:focus-visible){outline:2.5px solid var(--color-ring);outline-offset:2px}
    .role-card:has(input:checked){border-color:var(--color-primary);background:var(--color-primary-soft);box-shadow:var(--shadow-md)}
    .role-card .r-ic{width:48px;height:48px;border-radius:var(--radius-md);background:var(--color-primary-soft);color:var(--color-on-primary-soft);display:grid;place-items:center;transition:background var(--duration) var(--ease),color var(--duration) var(--ease)}
    .role-card:has(input:checked) .r-ic{background:var(--color-primary);color:#fff}
    .role-card .r-ic svg{width:26px;height:26px}
    .role-card h3{font-size:var(--text-md)}
    .role-card p{font-size:var(--text-sm);color:var(--color-fg-muted)}
    .role-card .r-check{position:absolute;top:var(--space-md);right:var(--space-md);width:24px;height:24px;border-radius:50%;border:2px solid var(--color-border-strong);display:grid;place-items:center;color:#fff;transition:background var(--duration) var(--ease),border-color var(--duration) var(--ease)}
    .role-card .r-check svg{width:14px;height:14px;opacity:0;transition:opacity var(--duration) var(--ease)}
    .role-card:has(input:checked) .r-check{background:var(--color-primary);border-color:var(--color-primary)}
    .role-card:has(input:checked) .r-check svg{opacity:1}
    @media(min-width:560px){ .role-grid{grid-template-columns:1fr 1fr} }
  `],
})
export class RoleStepComponent {
  readonly control = input.required<FormControl<Role | null>>();
}
