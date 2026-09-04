import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GroupSession, SessionStatus } from '@domain/entities/group';
import { formatAttendance } from '../grupos-format';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/** Labels y clase CSS por estado. Origen: index-v2.html:1768. */
const LABEL: Record<SessionStatus, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};
const PILL: Record<SessionStatus, string> = {
  scheduled: 'prog',
  completed: 'done',
  cancelled: 'canc',
};

/**
 * Tabla de sesiones del detalle. Origen: el bloque `sesRows` y su <table> dentro de
 * `renderGrupoDetail()` (index-v2.html:1741-1837).
 *
 * El sub del head dice "Recientes y próximas" y NO "class_session · recientes y próximas" como
 * la maqueta (1826): no se muestran nombres de tablas de la base en la UI.
 *
 * SIN el botón "Nueva sesión" de la maqueta (D3): sólo tiraba un toast.
 */
@Component({
  selector: 'app-sessions-table',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sessions-table.component.css',
  template: `
    <div class="panel">
      <div class="panel-head">
        <h3>Sesiones del grupo</h3>
        <span class="sub">Recientes y próximas</span>
      </div>
      @if (sessions().length) {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Hora</th><th>Cancha</th><th>Estado</th>
                <th class="cell-center">Asist.</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sessions(); track s.id) {
                <tr>
                  <td class="mono">{{ s.date }}</td>
                  <td class="mono">{{ s.time }}</td>
                  <td class="ses-court">{{ s.courtName }}</td>
                  <td><span class="ss-pill {{ pill[s.status] }}">{{ label[s.status] }}</span></td>
                  <td class="mono cell-center ses-att">{{ attendance(s) }}</td>
                  <td class="cell-end">
                    @if (s.status === 'scheduled') {
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="!canTake()"
                              (click)="attendanceRequested.emit(s)">Tomar asistencia</button>
                    } @else if (s.status === 'completed') {
                      <button type="button" class="btn btn-ghost btn-sm"
                              (click)="attendanceRequested.emit(s)">Ver / editar</button>
                    } @else {
                      <span class="ses-none">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <app-placeholder title="Este grupo todavía no tiene sesiones" />
      }
    </div>
  `,
})
export class SessionsTableComponent {
  readonly sessions = input.required<readonly GroupSession[]>();
  /** false cuando el roster está vacío: no hay a quién tomarle asistencia. */
  readonly canTake = input.required<boolean>();
  readonly attendanceRequested = output<GroupSession>();

  protected readonly label = LABEL;
  protected readonly pill = PILL;
  protected attendance(s: GroupSession): string { return formatAttendance(s); }
}
