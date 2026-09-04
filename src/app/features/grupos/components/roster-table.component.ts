import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RosterMember } from '@domain/entities/group';
import { attendanceState, occupancyState } from '../grupos-format';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * Tabla de inscriptos del detalle. Origen: el bloque `rosterRows` y su <table> dentro de
 * `renderGrupoDetail()` (index-v2.html:1741-1837).
 *
 * SIN filas clickeables ni .row-open (D8): en la maqueta abren la ficha del alumno, que este
 * slice difiere. Una fila muerta o un toast que promete la ficha serían peores.
 */
@Component({
  selector: 'app-roster-table',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './roster-table.component.css',
  template: `
    <div class="panel">
      <div class="panel-head">
        <h3>Alumnos inscriptos</h3>
        <span class="sub">Inscriptos al grupo</span>
        <span class="roster-occ">Ocupación:
          <b class="mono" [class.isfull]="full()">{{ roster().length }}/{{ capacity() }}</b>
        </span>
      </div>
      @if (roster().length) {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Alumno</th><th>Categoría</th><th class="cell-right">Créditos</th><th>Asistencia</th>
              </tr>
            </thead>
            <tbody>
              @for (m of roster(); track m.id) {
                <tr>
                  <td>
                    <div class="roster-who">
                      <span class="avatar-sm" aria-hidden="true">{{ m.initials }}</span>
                      <div class="roster-name">{{ m.name }}</div>
                    </div>
                  </td>
                  <td><span class="cat-badge">{{ m.category }}</span></td>
                  <td class="amt mono">{{ m.credits }}</td>
                  <td>
                    <span class="att-bar">
                      <span class="track" aria-hidden="true">
                        <i [class.mid]="rate(m) === 'mid'" [class.lowp]="rate(m) === 'low'"
                           [style.width.%]="m.attendanceRate"></i>
                      </span>
                      <span class="att-pct">{{ m.attendanceRate }}%</span>
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <app-placeholder title="Nadie inscripto todavía" />
      }
    </div>
  `,
})
export class RosterTableComponent {
  readonly roster = input.required<readonly RosterMember[]>();
  readonly capacity = input.required<number>();

  protected readonly full = computed(() => occupancyState(this.roster().length, this.capacity()) === 'full');
  protected rate(m: RosterMember) { return attendanceState(m.attendanceRate); }
}
