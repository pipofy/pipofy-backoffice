import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RosterMember } from '@domain/entities/group';
import { initials, occupancyState } from '../grupos-format';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * Tabla de inscriptos del detalle. Origen: el bloque `rosterRows` y su <table> dentro de
 * `renderGrupoDetail()` (index-v2.html:1741-1837).
 *
 * SIN filas clickeables ni .row-open (D8): en la maqueta abren la ficha del alumno, que este
 * slice difiere. Una fila muerta o un toast que promete la ficha serían peores.
 *
 * ponytail: SIN las columnas Créditos y % de asistencia: los dos son datos POR INSCRIPCIÓN y la
 * inscripción no existe en la base (ver el ponytail de entities/group.ts). Una columna de guiones
 * ocupa ancho e invita a preguntar por qué está vacía. Salida: vuelven cuando exista `enrollment`.
 *
 * La fila 'held' se marca pero no se esconde: ocupa cupo para el backend, así que esconderla haría
 * que el 4/4 del hero no cuadre con las filas de esta tabla.
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
                <th>Alumno</th><th>Categoría</th>
              </tr>
            </thead>
            <tbody>
              @for (m of roster(); track m.id) {
                <tr>
                  <td>
                    <div class="roster-who">
                      <span class="avatar-sm" aria-hidden="true">{{ ini(m.name) }}</span>
                      <div class="roster-name">{{ m.name }}</div>
                    </div>
                  </td>
                  <td>
                    <span class="cat-badge">{{ m.category }}</span>
                    @if (m.status === 'held') {
                      <span class="cat-badge hold">Sin confirmar</span>
                    }
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
  protected ini(name: string): string { return initials(name); }
}
