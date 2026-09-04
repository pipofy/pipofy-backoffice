import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FieldErrorComponent } from '@shared/ui/field-error.component';
import { OnboardingFormValue } from '../onboarding-persistence.service';

interface SummaryRow { k: string; v: string }
interface SummaryBlock { title: string; edit: 'account'; rows: SummaryRow[] }

@Component({
  selector: 'app-confirm-step',
  standalone: true,
  host: { class: 'step' },
  imports: [ReactiveFormsModule, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-head">
      <p class="eyebrow">Paso 3 de 3</p>
      <h2>Revisá y confirmá</h2>
      <p>Comprobá que esté todo bien. Podés editar cualquier sección.</p>
    </div>

    <div class="summary">
      @for (block of blocks(); track block.title) {
        <div class="sum-block">
          <div class="sum-head">
            <h3>{{ block.title }}</h3>
            <button type="button" class="sum-edit" (click)="editStep.emit(block.edit)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L18 10l-4-4L4 16v4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /><path d="M13 7l4 4" stroke="currentColor" stroke-width="1.7" /></svg>
              Editar
            </button>
          </div>
          <div class="sum-rows">
            @for (row of block.rows; track row.k) {
              <div class="sum-row">
                <span class="k">{{ row.k }}</span>
                <span class="v" [class.empty]="!row.v">{{ row.v || 'Sin completar' }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <label class="terms" [class.err]="termsErr()" [formGroup]="form()">
      <input type="checkbox" formControlName="acceptedTerms" />
      <span class="t-txt">Acepto los <a href="#" (click)="$event.preventDefault()">Términos del servicio</a> y la <a href="#" (click)="$event.preventDefault()">Política de privacidad</a> de PipoFy.</span>
    </label>
    <app-field-error [show]="termsErr()" message="Tenés que aceptar los términos para crear la cuenta." />
  `,
  styles: [`
    /* Portado de onboarding.html líneas 174-201 (summary + terms). */
    .summary{display:flex;flex-direction:column;gap:var(--space-md);margin-bottom:var(--space-lg)}
    .sum-block{border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden}
    .sum-head{display:flex;align-items:center;gap:var(--space-sm);padding:12px var(--space-md);background:var(--color-surface-2);border-bottom:1px solid var(--color-border)}
    .sum-head h3{font-size:var(--text-sm);flex:1}
    .sum-edit{font-size:var(--text-xs);font-weight:600;color:var(--color-primary);padding:6px 10px;border-radius:var(--radius-sm);display:inline-flex;align-items:center;gap:var(--space-xs);transition:background var(--duration) var(--ease)}
    .sum-edit:hover{background:var(--color-primary-soft)}
    .sum-edit svg{width:13px;height:13px}
    .sum-rows{padding:var(--space-xs) var(--space-md)}
    .sum-row{display:flex;justify-content:space-between;gap:var(--space-md);padding:10px 0;font-size:var(--text-sm)}
    .sum-row+.sum-row{border-top:1px solid var(--color-border)}
    .sum-row .k{color:var(--color-fg-muted);flex:0 0 auto}
    .sum-row .v{font-weight:600;text-align:right;word-break:break-word}
    .sum-row .v.empty{color:var(--color-fg-subtle);font-weight:400;font-style:italic}
    .terms{display:flex;align-items:flex-start;gap:var(--space-sm);padding:var(--space-md);border:1px solid var(--color-border-strong);border-radius:var(--radius-md);cursor:pointer;transition:border-color var(--duration) var(--ease)}
    .terms:has(input:checked){border-color:var(--color-primary);background:var(--color-primary-soft)}
    .terms.err{border-color:var(--color-destructive);background:var(--color-destructive-soft)}
    .terms input{width:20px;height:20px;accent-color:var(--color-primary);flex:0 0 auto;margin-top:1px;cursor:pointer}
    .terms .t-txt{font-size:var(--text-sm);color:var(--color-fg-muted)}
    .terms a{color:var(--color-primary);font-weight:600;text-decoration:underline}
  `],
})
export class ConfirmStepComponent {
  readonly form = input.required<FormGroup>();
  readonly editStep = output<'role' | 'account'>();

  protected readonly blocks = computed<SummaryBlock[]>(() => {
    const v = this.form().getRawValue() as OnboardingFormValue;
    const rows: SummaryRow[] = [
      { k: 'Rol', v: v.role === 'club' ? 'Dueño de club' : 'Profesor' },
      { k: 'Nombre', v: `${v.account.nombre} ${v.account.apellido}`.trim() },
      { k: 'Email', v: v.account.email },
      { k: 'Teléfono', v: v.account.phone },
      { k: 'Contraseña', v: '•'.repeat(Math.max((v.account.password ?? '').length, 8)) },
    ];
    if (v.role === 'club') {
      rows.push({ k: 'Club', v: v.account.nombreClub });
    }
    return [{ title: 'Cuenta', edit: 'account', rows }];
  });

  protected termsErr(): boolean {
    const c = this.form().get('acceptedTerms');
    return !!c && c.invalid && c.touched;
  }
}
