import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CourtGrid, CourtSession, SessionState } from '@domain/entities/dashboard-snapshot';
import { occupancyPercent } from '@domain/occupancy';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/** Estado de la sesión en palabras, para el texto accesible de la celda (ver label()). */
const STATE_LABEL: Record<SessionState, string> = {
  full: 'completa',
  open: 'con cupo libre',
  wait: 'con lista de espera',
};

@Component({
  selector: 'app-court-grid',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './court-grid.component.css',
  template: `
    <!-- Los dos estados vacíos son reales contra la API: la semilla vieja garantizaba 4
         canchas y una grilla poblada. Sin canchas, además, repeat(0, ...) es un valor
         inválido y el navegador descarta grid-template-columns entero. -->
    @if (grid().courts.length === 0) {
      <app-placeholder
        title="Todavía no hay canchas cargadas"
        body="Se agregan desde Configuración → Canchas."
      />
    } @else if (grid().hours.length === 0) {
      <app-placeholder title="No hay clases programadas para hoy" />
    } @else {
    <div class="grid-wrap">
      <div class="grid-scroll">
        <div class="court-grid" [style.--n]="grid().courts.length">
          <div class="ch corner"></div>
          <!-- track $index: c.name puede venir vacío (court.mapper.ts normaliza el nombre
               ausente a '') o repetido entre canchas reales, así que no es una clave estable
               para el @for. -->
          @for (c of grid().courts; track $index) {
            <div class="ch">
              <div class="cn">{{ c.name }}</div>
              <div class="cmeta">{{ c.meta }}</div>
            </div>
          }
          @for (hr of grid().hours; track hr; let hi = $index) {
            <div class="hourcell">{{ hr }}</div>
            @for (c of grid().courts; track $index; let ci = $index) {
              @let s = grid().sessions[hi][ci];
              @if (s) {
                <div class="slot">
                  <!-- Contexto consolidado para lector de pantalla: la grilla es un CSS grid de
                       divs sin semántica de tabla, así que sin esto se lee el texto visible
                       flotando, sin cancha ni hora. -->
                  <span class="sr-only">
                    {{ s.category }} con {{ s.professor || 'profesor sin asignar' }}, cancha
                    {{ c.name }}, {{ hr }}, {{ s.occupied }} de {{ s.capacity }},
                    {{ label(s.state) }}.
                  </span>
                  <div class="sess {{ s.state }}" aria-hidden="true">
                    <div class="s-top">
                      <span class="s-cat">{{ s.category }}</span>
                      <span class="s-occ">{{ s.occupied }}/{{ s.capacity }}</span>
                    </div>
                    <div class="s-prof"><span class="pdot" aria-hidden="true">{{ initials(s) }}</span>{{ s.professor }}</div>
                    @if (s.state === 'open') { <span class="s-flag wa">Cupo libre</span> }
                    @if (s.state === 'wait') { <span class="s-flag wait">En espera</span> }
                    <div class="occ-bar" aria-hidden="true"><i [style.width.%]="pct(s)"></i></div>
                  </div>
                </div>
              } @else {
                <div class="slot empty"></div>
              }
            }
          }
        </div>
      </div>
    </div>
    }
  `,
})
export class CourtGridComponent {
  readonly grid = input.required<CourtGrid>();

  /**
   * `capacity` puede ser 0: `ClassSession.capacity` es nullable en el backend y el mapper lo
   * normaliza a 0 (spec §3.3). La guarda contra esa división vive en `occupancyPercent`.
   */
  protected pct(s: CourtSession): number {
    return occupancyPercent(s.occupied, s.capacity);
  }

  /**
   * Inicial del profesor para el círculo de la celda. Se deriva acá y no en el mapper: es un
   * recurso visual sin significado de dominio, igual que `pct()` y `label()`. El texto
   * accesible usa el nombre completo, no esto.
   */
  protected initials(s: CourtSession): string {
    return s.professor.charAt(0).toUpperCase() || '?';
  }

  /** Estado en palabras para el texto accesible de la celda. */
  protected label(state: SessionState): string {
    return STATE_LABEL[state];
  }
}
