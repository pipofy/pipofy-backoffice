import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RosterMember } from '@domain/entities/group';
import { initials, occupancyState } from '../grupos-format';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * Tabla de inscriptos del detalle. Origen: el bloque `rosterRows` y su <table> dentro de
 * `renderGrupoDetail()` (docs/maquetas/index-v2.html:1741-1837).
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
                <th>Alumno</th><th>Categoría</th><th class="col-accion">Acciones</th>
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
                  <td class="col-accion">
                    <!-- SIEMPRE disponible, y el texto dice "de la clase" y no "del grupo": esto
                         cancela la reserva de UNA sesión. La inscripción a un grupo no existe en
                         la base, así que prometer lo otro sería mentir. -->
                    <button type="button" class="btn btn-ghost btn-sm" data-test="quitar"
                            [disabled]="quitando() === m.id"
                            [attr.aria-label]="'Quitar a ' + nombreEnFrase(m) + ' de ' + claseLabel()"
                            (click)="quitar.emit(m)">
                      {{ quitando() === m.id ? 'Quitando…' : quitarLabel() }}
                    </button>
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
  /** 'la clase del lunes 18:00': lo arma la página, que es la que tiene el grupo. */
  readonly claseLabel = input<string>('esta clase');
  /** El id de la reserva que se está cancelando, para deshabilitar SÓLO ese botón. */
  readonly quitando = input<string | null>(null);
  readonly quitar = output<RosterMember>();

  /**
   * El texto VISIBLE del botón, no sólo el aria-label: el panel de arriba dice "Inscriptos al
   * grupo", así que un "Quitar" pelado se lee como "sacar del grupo" — que es justo lo que NO
   * hace. Con el día y la hora entra; sin ellos cae a "de esta clase".
   */
  protected readonly quitarLabel = computed(() => `Quitar de ${this.claseLabel()}`);

  /**
   * `first_name`/`last_name` son nullables, así que toRoster cae a un guión largo. Dentro de
   * una frase ("Quitar a — de la clase del Lunes") eso no se lee: ahí va "este alumno".
   */
  protected nombreEnFrase(m: RosterMember): string {
    return m.name === '—' || m.name.trim() === '' ? 'este alumno' : m.name;
  }

  protected readonly full = computed(() => occupancyState(this.roster().length, this.capacity()) === 'full');
  protected ini(name: string): string { return initials(name); }
}
