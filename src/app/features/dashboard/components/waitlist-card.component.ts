import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WaitlistEntry } from '@domain/entities/dashboard-snapshot';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-waitlist-card',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="acard">
      <div class="a-head">
        <span class="ic wa" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 8c4 2 12 2 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="14" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="14" r="2" stroke="currentColor" stroke-width="1.8"/></svg>
        </span>
        <h3>Lista de espera activa</h3>
        <span class="cnt wa">{{ entries().length }}</span>
      </div>
      <div class="a-body">
        @for (e of entries(); track e.id) {
          <div class="arow">
            <div class="a-main"><div class="a-title">{{ e.title }}</div><div class="a-meta">{{ e.meta }}</div></div>
          </div>
        } @empty {
          <app-placeholder title="Sin lista de espera" />
        }
      </div>
    </div>
  `,
})
export class WaitlistCardComponent {
  readonly entries = input.required<WaitlistEntry[]>();
}
