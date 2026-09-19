import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { occupancyPercent } from '@domain/occupancy';
import { occupancyState } from '../grupos-format';

/**
 * Celda de cupo: barra mini + n/N. Origen: docs/maquetas/index-v2.html:1697-1704 (`cupoCell()`).
 *
 * Tiene archivo propio porque la maqueta la llama desde DOS lugares: la fila de la tabla de
 * grupos (1729) y el hero del detalle (1786).
 *
 * El estado 'ok' y el estado 'high' NO ponen clase: el color base del CSS ya es el correcto.
 */
@Component({
  selector: 'app-cupo-cell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './cupo-cell.component.css',
  template: `
    <div class="cupo-cell">
      <span class="mini-bar" aria-hidden="true">
        <i [class.isfull]="state() === 'full'" [class.low]="state() === 'low'" [style.width.%]="percent()"></i>
      </span>
      <span class="cupo-num mono" [class.isfull]="state() === 'full'">{{ enrolled() }}/{{ capacity() }}</span>
    </div>
  `,
})
export class CupoCellComponent {
  readonly enrolled = input.required<number>();
  readonly capacity = input.required<number>();

  protected readonly state = computed(() => occupancyState(this.enrolled(), this.capacity()));
  protected readonly percent = computed(() => occupancyPercent(this.enrolled(), this.capacity()));
}
