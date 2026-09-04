import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GroupSession } from '@domain/entities/group';
import { domainErrorMessage } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { ToastService } from '@shared/ui/toast/toast.service';
import { CupoCellComponent } from '../components/cupo-cell.component';
import { RosterTableComponent } from '../components/roster-table.component';
import { SessionsTableComponent } from '../components/sessions-table.component';
import { AttendanceModalComponent, AttendanceResult, AttendanceTarget } from '../components/attendance-modal.component';
import { creditsToDiscount } from '@domain/use-cases/apply-attendance.use-case';
import { nextSessionDate } from '../grupos-format';
import { GruposFacade } from '../grupos.facade';
import { SessionStore } from '@data/auth/session-store';
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
  private readonly session = inject(SessionStore);
  private readonly groupId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly attendanceTarget = signal<AttendanceTarget | null>(null);
  private readonly modal = viewChild(AttendanceModalComponent);

  constructor() {
    const clubId = this.session.clubId();
    if (clubId && !this.facade.data() && !this.facade.loading()) void this.facade.load(clubId);

    // El modal vive detrás de un @if, así que no existe cuando se elige la sesión: hay que
    // abrirlo cuando Angular ya lo creó. Mismo patrón que el modal de cancelar del dashboard.
    effect(() => {
      if (this.attendanceTarget()) this.modal()?.open();
    });
  }

  protected readonly group = computed(() => this.facade.groups().find((g) => g.id === this.groupId));
  protected readonly nextDate = computed(() => nextSessionDate(this.group()?.sessions ?? []));

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected openAttendance(session: GroupSession): void {
    const group = this.group();
    if (!group) return;
    // Sólo set(): el effect que abre el modal se re-dispara siempre, porque este literal nunca es
    // Object.is-igual al target anterior. Un open() manual acá correría ANTES de la detección de
    // cambios y sembraría el modal con el target VIEJO (alcanzable: abrir sesión A → Cancelar →
    // abrir sesión B). Mismo patrón que dashboard-page.component.ts:79-89.
    this.attendanceTarget.set({ group, session });
  }

  protected async onConfirmed(result: AttendanceResult): Promise<void> {
    const target = this.attendanceTarget();
    const clubId = this.session.clubId();
    if (!target || !clubId) return;
    const taking = target.session.status === 'scheduled';
    const present = result.marks.filter((m) => m.present).length;
    const absent = result.marks.length - present;

    try {
      await this.facade.saveAttendance(clubId, {
        groupId: target.group.id,
        sessionId: target.session.id,
        marks: result.marks,
        discountAbsences: result.discountAbsences,
      });
      this.modal()?.markDone();
      this.attendanceTarget.set(null);

      if (taking) {
        // Misma función que el contador en vivo del modal: si el toast reimplementara la regla,
        // los dos números podrían divergir.
        const computadas = creditsToDiscount(result.marks, result.discountAbsences);
        this.toasts.show('ok', 'Asistencia registrada',
          `${present} presente(s) · ${absent} ausente(s) · ${computadas} clase(s) computada(s).`);
      } else {
        this.toasts.show('ok', 'Asistencia actualizada',
          `Quedó ${present}/${result.marks.length} presentes (sin cambios de crédito).`);
      }
    } catch (err) {
      // saveAttendance NO usa run(), así que el error llega crudo hasta acá. toDomainError lo
      // normaliza y domainErrorMessage le pone copy en español: nunca el kind pelado.
      this.modal()?.markFailed();
      this.toasts.show('info', 'No se pudo guardar', domainErrorMessage(toDomainError(err)));
    }
  }
}
