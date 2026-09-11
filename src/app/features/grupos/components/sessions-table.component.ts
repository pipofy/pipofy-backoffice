import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GroupSession, puedeTomarAsistencia } from '@domain/entities/group';
import { fechaCorta, horaCorta } from '../grupos-format';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/** El `name` crudo del catálogo → copy y clase del pill. Un estado desconocido se muestra tal cual. */
const LABEL = new Map<string, string>([
  ['programada', 'Programada'],
  ['completada', 'Completada'],
  ['cancelada', 'Cancelada'],
]);
const PILL = new Map<string, string>([
  ['programada', 'prog'],
  ['completada', 'done'],
  ['cancelada', 'canc'],
]);

/**
 * Tabla de sesiones del detalle. Origen: el bloque `sesRows` y su <table> dentro de
 * `renderGrupoDetail()` (index-v2.html:1741-1837).
 *
 * El sub del head dice "Recientes y próximas" y NO "class_session · recientes y próximas" como
 * la maqueta (1826): no se muestran nombres de tablas de la base en la UI.
 *
 * SIN el botón "Nueva sesión" de la maqueta (D3): sólo tiraba un toast.
 *
 * UN SOLO BOTÓN, no dos modos. `AttendanceService.markBulk` NO pasa la clase a 'completada', así
 * que `status` nunca dice si ya se tomó asistencia: la distinción tomar/editar no se puede
 * sostener contra este backend. El modal abre pidiendo las reservas de la sesión y prellena con
 * lo que ya esté guardado, igual que hace /reservas.
 *
 * ponytail: desde esta tabla no se ve si una sesión ya tiene asistencia tomada sin abrirla. La
 * salida es que `markBulk` pase la clase a `completada`, o un contador en `GET /class-sessions`.
 *
 * La columna es Inscriptos y no Asistencia: el conteo de presentes no viene en `GET /class-sessions`
 * y sacarlo costaría una llamada por sesión.
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
                <th class="cell-center">Inscriptos</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sessions(); track s.id) {
                <tr>
                  <td class="mono">{{ fecha(s.startAt) }}</td>
                  <td class="mono">{{ hora(s.startAt) }}</td>
                  <td class="ses-court">{{ s.courtName }}</td>
                  <td><span class="ss-pill {{ pill(s.status) }}">{{ label(s.status) }}</span></td>
                  <td class="mono cell-center ses-att">{{ s.enrolled }}/{{ s.capacity }}</td>
                  <td class="cell-end">
                    @if (tomable(s)) {
                      <button type="button" class="btn btn-primary btn-sm"
                              (click)="attendanceRequested.emit(s)">Tomar asistencia</button>
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
  readonly attendanceRequested = output<GroupSession>();

  protected label(status: string): string { return LABEL.get(status) ?? status; }
  protected pill(status: string): string { return PILL.get(status) ?? 'prog'; }
  protected tomable(s: GroupSession): boolean { return puedeTomarAsistencia(s); }
  protected fecha(startAt: string | null): string { return fechaCorta(startAt); }
  protected hora(startAt: string | null): string { return horaCorta(startAt); }
}
