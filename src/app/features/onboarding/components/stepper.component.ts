import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress" aria-hidden="true"><i [style.width.%]="progressPct()"></i></div>
    <ol class="stepper" aria-label="Progreso del registro">
      @for (node of nodes(); track node.idx) {
        <li [attr.data-state]="stateFor(node.idx)" [attr.aria-current]="node.idx === activeNode() ? 'step' : null">
          <span class="dot">
            @if (node.idx < activeNode()) {
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
            } @else {
              {{ node.idx + 1 }}
            }
          </span>
          <span class="lbl">{{ node.label }}</span>
        </li>
      }
    </ol>
  `,
  styles: [`
    /* Portado de docs/maquetas/onboarding.html líneas 54-71 + breakpoint 243. */
    .progress{height:6px;border-radius:var(--radius-full);background:var(--color-border-strong);overflow:hidden;margin-bottom:var(--space-md)}
    .progress i{display:block;height:100%;width:0;border-radius:var(--radius-full);background:var(--color-primary);transition:width var(--duration-page) var(--ease-inout)}
    .stepper{list-style:none;display:flex;justify-content:space-between;gap:var(--space-xs)}
    .stepper li{flex:1;display:flex;flex-direction:column;align-items:center;gap:var(--space-xs);text-align:center;min-width:0}
    .stepper .dot{width:30px;height:30px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-family:var(--font-mono);font-weight:700;font-size:var(--text-sm);background:var(--color-surface);border:2px solid var(--color-border-strong);color:var(--color-fg-subtle);transition:background var(--duration) var(--ease),border-color var(--duration) var(--ease),color var(--duration) var(--ease)}
    .stepper .lbl{font-size:var(--text-2xs);font-weight:600;color:var(--color-fg-subtle);line-height:1.25;overflow:hidden;text-overflow:ellipsis}
    .stepper li[data-state="current"] .dot{background:var(--color-primary);border-color:var(--color-primary);color:var(--color-on-primary)}
    .stepper li[data-state="current"] .lbl{color:var(--color-on-primary-soft)}
    .stepper li[data-state="done"] .dot{background:var(--color-accent-strong);border-color:var(--color-accent-strong);color:#fff}
    .stepper li[data-state="done"] .lbl{color:var(--color-fg-muted)}
    .stepper .dot svg{width:15px;height:15px}
    @media(min-width:560px){ .stepper .lbl{font-size:var(--text-xs)} }
  `],
})
export class StepperComponent {
  readonly activeNode = input.required<number>();
  readonly labels = input.required<string[]>();

  protected readonly nodes = computed(() =>
    this.labels().map((label, idx) => ({ idx, label })),
  );

  /** El progreso se reparte entre los nodos que HAY, no entre 4 fijos. */
  protected readonly progressPct = computed(() => {
    const total = this.labels().length;
    return total <= 1 ? 100 : (this.activeNode() / (total - 1)) * 100;
  });

  protected stateFor(idx: number): 'done' | 'current' | 'todo' {
    const active = this.activeNode();
    return idx < active ? 'done' : idx === active ? 'current' : 'todo';
  }
}
