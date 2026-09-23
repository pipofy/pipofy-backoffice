import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/ui/icon.component';

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
 *
 * El arte sale del registro ICONS con los nombres `state-empty|error|loading|wip`.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph" [class.ph-page]="size() === 'page'" [attr.role]="role()">
      <app-icon class="ph-art" [name]="'state-' + tone()" />
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
      .ph-art {
        display: flex;
        width: 26px;
        height: 26px;
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
      .ph-page .ph-art {
        width: 72px;
        height: 72px;
        margin-bottom: var(--space-md);
      }
      .ph-page .ph-title {
        font-size: var(--text-lg);
        color: var(--color-fg);
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
