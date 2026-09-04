import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <p class="err-msg" role="alert">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5M12 16.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" /></svg>
        <span>{{ message() }}</span>
      </p>
    }
  `,
  styles: [`
    .err-msg{font-size:var(--text-xs);color:var(--color-on-destructive-soft);margin-top:var(--space-xs);font-weight:600;display:flex;align-items:flex-start;gap:var(--space-xs)}
    .err-msg svg{width:14px;height:14px;flex:0 0 auto;margin-top:1px}
  `],
})
export class FieldErrorComponent {
  readonly show = input(false);
  readonly message = input('');
}
