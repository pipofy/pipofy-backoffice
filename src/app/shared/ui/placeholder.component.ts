import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Los cuatro estados que un bloque centrado puede representar. */
export type PlaceholderTone = 'empty' | 'error' | 'loading' | 'wip';

/**
 * Rol ARIA por tono. Es un Record COMPLETO, no un switch con rama por defecto:
 * agregar un tone rompe el build hasta que declare su rol, igual que
 * domainErrorMessage (core/domain/errors.ts) rompe el build al agregar un kind sin
 * copy. Ese mapeo es lo que hace que un estado de carga se anuncie solo.
 */
const ROLE: Record<PlaceholderTone, 'alert' | 'status' | null> = {
  empty: null,
  error: 'alert',
  loading: 'status',
  wip: null,
};

/**
 * El bloque centrado de vacío / error / carga / en-construcción.
 *
 * `size='inline'` (default) reproduce la métrica del viejo `.a-empty` y es lo que va
 * dentro de una tabla o un modal; `size='page'` es el bloque de pantalla completa.
 *
 * Ojo: shell.component.css redefine la escala --text-* en su :host, así que este
 * primitivo renderiza más denso dentro del shell que fuera. Verificá los dos.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph" [class.ph-page]="size() === 'page'" [attr.role]="role()">
      <span class="ph-art" aria-hidden="true">
        <!-- Sin @default: la exhaustividad la garantiza el Record ROLE, no el template. -->
        @switch (tone()) {
          @case ('empty') {
            <svg viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <circle cx="9.6" cy="7.4" r="1" fill="currentColor" opacity=".45" />
              <circle cx="12" cy="10.2" r="1" fill="currentColor" opacity=".45" />
              <circle cx="14.4" cy="7.4" r="1" fill="currentColor" opacity=".45" />
              <path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            </svg>
          }
          @case ('error') {
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M2 17h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5" />
              <circle cx="17" cy="9" r="4.6" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <path d="M13.4 6.2c1.6 1.6 1.6 4 0 5.6M20.6 6.2c-1.6 1.6-1.6 4 0 5.6" stroke="currentColor" stroke-width="1.1" opacity=".55" />
              <path d="M4 20.5c1.6-3 3.6-5.2 6.2-6.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 2.6" opacity=".55" />
            </svg>
          }
          @case ('loading') {
            <svg viewBox="0 0 24 24" fill="none">
              <g class="ph-roll">
                <circle cx="12" cy="11" r="5.4" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
                <path d="M7.7 7.7c1.9 1.9 1.9 4.7 0 6.6M16.3 7.7c-1.9 1.9-1.9 4.7 0 6.6" stroke="currentColor" stroke-width="1.1" opacity=".55" />
              </g>
              <path d="M4 19.5h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />
            </svg>
          }
          @case ('wip') {
            <svg viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" />
              <path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              <path d="M3.5 11.5h17" stroke="var(--color-warning-mark)" stroke-width="3" stroke-linecap="round" />
              <path d="M5 11.5h1.6M9 11.5h1.6M13 11.5h1.6M17 11.5h1.6" stroke="var(--color-surface)" stroke-width="3" />
            </svg>
          }
        }
      </span>
      <p class="ph-title">{{ title() }}</p>
      @if (body()) {
        <p class="ph-body">{{ body() }}</p>
      }
      <!-- Sin whitespace entre las tags: .ph-action:empty depende de que el div
           quede realmente vacío cuando no hay acción proyectada. -->
      <div class="ph-action"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .ph {
        padding: var(--space-lg);
        text-align: center;
        color: var(--color-fg-subtle);
        font-size: var(--text-2xs);
      }
      .ph-art svg {
        width: 26px;
        height: 26px;
        display: block;
        margin: 0 auto var(--space-sm);
        color: var(--color-primary);
        opacity: 0.75;
      }
      .ph-title {
        font-weight: 600;
        color: var(--color-fg-muted);
      }
      .ph-body {
        margin-top: var(--space-xs);
        max-width: 44ch;
        margin-inline: auto;
        line-height: var(--leading-snug);
      }
      .ph-action:empty {
        display: none;
      }
      .ph-action {
        margin-top: var(--space-md);
      }

      .ph.ph-page {
        max-width: 420px;
        margin: var(--space-3xl) auto;
        font-size: var(--text-sm);
      }
      .ph-page .ph-art svg {
        width: 72px;
        height: 72px;
        margin-bottom: var(--space-md);
      }
      .ph-page .ph-title {
        font-size: var(--text-lg);
        color: var(--color-fg);
      }

      /* El @media prefers-reduced-motion de tokens.css:108 anula esto sin código extra. */
      .ph-roll {
        transform-origin: 12px 11px;
        animation: ph-roll 900ms linear infinite;
      }
      @keyframes ph-roll {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PlaceholderComponent {
  readonly tone = input<PlaceholderTone>('empty');
  readonly size = input<'inline' | 'page'>('inline');
  readonly title = input.required<string>();
  readonly body = input('');

  protected readonly role = computed(() => ROLE[this.tone()]);
}
