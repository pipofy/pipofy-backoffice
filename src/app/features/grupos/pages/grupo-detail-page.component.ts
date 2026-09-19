import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Group, GroupSession } from '@domain/entities/group';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';
import { domainErrorMessage, asDomainError } from '@domain/errors';
import { weekdayLabel } from '@shared/weekday-label';
import { ToastService } from '@shared/ui/toast/toast.service';
import { CupoCellComponent } from '../components/cupo-cell.component';
import { RosterTableComponent } from '../components/roster-table.component';
import { SessionsTableComponent } from '../components/sessions-table.component';
import { AttendanceModalComponent, AttendanceTarget } from '../components/attendance-modal.component';
import { fechaCorta, groupTitle, initials } from '../grupos-format';
import { GruposFacade } from '../grupos.facade';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * Detalle de un grupo. Origen: index-v2.html:933-941 + renderGrupoDetail() 1741-1837.
 *
 * La lista de espera va INLINE acá (D10): sin lógica, sin output y con un solo consumidor, no se
 * gana un componente propio. Se extrae cuando llegue "Ofrecer cupo".
 *
 * SIN los botones "Avisar al grupo", "Editar" y "Nueva sesión" de la maqueta (D3).
 */
@Component({
  selector: 'app-grupo-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CupoCellComponent,
    RosterTableComponent,
    SessionsTableComponent,
    AttendanceModalComponent,
    PlaceholderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grupo-detail-page.component.html',
  styleUrl: './grupo-detail-page.component.css',
})
export class GrupoDetailPageComponent {
  protected readonly facade = inject(GruposFacade);
  private readonly toasts = inject(ToastService);
  private readonly groupId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly attendanceTarget = signal<AttendanceTarget | null>(null);
  protected readonly abriendo = signal(false);
  private readonly modal = viewChild(AttendanceModalComponent);

  constructor() {
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Cuando el grupo aparece (o cambia), traer roster y lista de espera de su próxima sesión.
    // Es un effect y no una llamada encadenada al load() porque se entra a esta página también
    // por deep-link, con el snapshot ya cargado por la lista.
    effect(() => {
      const g = this.group();
      if (g) void this.facade.loadDetalle(g.nextSessionId);
    });

    // El modal vive detrás de un @if, así que no existe cuando se elige la sesión: hay que
    // abrirlo cuando Angular ya lo creó. Mismo patrón que el modal de cancelar del dashboard.
    effect(() => {
      if (this.attendanceTarget()) this.modal()?.open();
    });
  }

  protected readonly group = computed(() => this.facade.groups().find((g) => g.id === this.groupId));
  // Busca por `nextSessionId` y no repite la regla 'programada' && !yaPaso: esa regla ya la
  // aplicó el mapper para poblar ese campo, y copiarla acá las deja atadas sólo mientras nadie
  // las edite por separado.
  protected readonly proxima = computed(() => {
    const g = this.group();
    if (!g) return fechaCorta(null);
    const s = g.sessions.find((x) => x.id === g.nextSessionId);
    return fechaCorta(s?.startAt ?? null);
  });

  protected title(g: Group): string { return groupTitle(g); }
  protected ini(name: string): string { return initials(name); }
  protected dia(weekday: number | null): string { return weekdayLabel(weekday); }
  protected fecha(v: string | null): string { return fechaCorta(v); }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** El del roster y la lista de espera, que fallan aparte y no reemplazan la pantalla. */
  protected detalleErrorText(): string {
    const err = this.facade.detalleError();
    return err ? domainErrorMessage(err) : '';
  }

  protected async openAttendance(session: GroupSession): Promise<void> {
    const group = this.group();
    if (!group || this.abriendo()) return;
    this.abriendo.set(true);
    try {
      // El modal SÓLO ofrece las confirmed: AttendanceService.mark() tira 400 sobre cualquier
      // otro estado, así que una fila 'held' en la planilla sería un fallo garantizado.
      const roster = (await this.facade.rosterDeSesion(session.id)).filter(
        (m) => m.status === 'confirmed',
      );
      if (roster.length === 0) {
        this.toasts.show('info', 'Nadie confirmado',
          'Esa clase no tiene reservas confirmadas: no hay a quién tomarle asistencia.');
        return;
      }
      // Sólo set(): el effect que abre el modal se re-dispara siempre, porque este literal nunca
      // es Object.is-igual al target anterior. Un open() manual acá correría ANTES de la
      // detección de cambios y sembraría el modal con el target VIEJO.
      this.attendanceTarget.set({ group, session, roster });
    } catch (err) {
      this.toasts.show('info', 'No se pudo abrir la planilla', domainErrorMessage(asDomainError(err)));
    } finally {
      this.abriendo.set(false);
    }
  }

  protected async onConfirmed(marks: readonly SessionAttendanceMark[]): Promise<void> {
    const target = this.attendanceTarget();
    if (!target) return;

    try {
      const results = await this.facade.saveAttendance(target.session.id, marks);
      const ok = results.filter((r) => r.ok).length;
      const fallaron = results.length - ok;
      this.modal()?.markDone();
      this.attendanceTarget.set(null);

      // markBulk NO es atómico: itera con un try por ítem, así que el éxito parcial es un
      // resultado de primera clase y no un borde. Reintentar es seguro: el upsert es idempotente.
      if (fallaron === 0) {
        const presentes = marks.filter((m) => m.status === 'asistio').length;
        this.toasts.show('ok', 'Asistencia registrada',
          `${presentes} presente(s) · ${marks.length - presentes} ausente(s).`);
      } else {
        this.toasts.show('info', 'Asistencia guardada a medias',
          `${ok} de ${results.length} se guardaron. Volvé a intentar: reintentar no duplica nada.`);
      }
    } catch (err) {
      // saveAttendance NO usa run(), así que el error llega crudo hasta acá. asDomainError lo
      // normaliza y domainErrorMessage le pone copy en español: nunca el kind pelado.
      this.modal()?.markFailed();
      this.toasts.show('info', 'No se pudo guardar', domainErrorMessage(asDomainError(err)));
    }
  }
}
