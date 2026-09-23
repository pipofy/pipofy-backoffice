import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { Group, GroupSession, RosterMember } from '@domain/entities/group';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';
import { fechaCorta, groupTitle, horaCorta, initials } from '../grupos-format';

export interface AttendanceTarget {
  readonly group: Group;
  readonly session: GroupSession;
  /** El roster DE ESA SESIÓN, ya filtrado a las confirmadas por la página. */
  readonly roster: readonly RosterMember[];
}

/**
 * Modal de toma de asistencia. Origen: docs/maquetas/index-v2.html:1352-1371 + openAttendance() 2107-2176.
 *
 * UN SOLO MODO. La versión de la maqueta tenía dos —tomar, que descontaba créditos, y editar, que
 * no— derivados de `session.status`. Contra este backend eso no se sostiene: `markBulk` no cambia
 * el estado de la clase, así que `status` nunca dice si ya se tomó asistencia, y los créditos los
 * descuenta `reserve()`, no la asistencia. El modal prellena desde `attendanceStatus` y guarda.
 *
 * SIN flow-steps: el modal de cancelar del dashboard los tiene porque la maqueta se los dibujó;
 * éste no.
 */
@Component({
  selector: 'app-attendance-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './attendance-modal.component.css',
  template: `
    <app-modal #modal icon="primary" [title]="title" [subtitle]="subtitle()">
      <svg modal-icon width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/>
        <path d="M3.5 9h17" stroke="currentColor" stroke-width="1.7"/>
      </svg>

      <div class="att-list">
        @for (m of target().roster; track m.id) {
          <div class="att-row">
            <div class="att-who">
              <span class="avatar-sm" aria-hidden="true">{{ ini(m.name) }}</span>
              <div>{{ m.name }}<div class="sub">{{ m.category }}</div></div>
            </div>
            <div class="segpick" role="group" [attr.aria-label]="'Asistencia de ' + m.name">
              <button type="button" class="segp" [class.on-p]="isPresent(m.id)"
                      [attr.aria-pressed]="isPresent(m.id)" (click)="mark(m.id, true)">Presente</button>
              <button type="button" class="segp" [class.on-a]="!isPresent(m.id)"
                      [attr.aria-pressed]="!isPresent(m.id)" (click)="mark(m.id, false)">Ausente</button>
            </div>
          </div>
        }
      </div>

      <div class="att-summary" aria-live="polite">
        <span class="sp">Presentes <b>{{ present() }}</b></span>
        <span class="sa">Ausentes <b>{{ absent() }}</b></span>
      </div>

      <div class="modal-foot" modal-foot>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega a ningún control (modal.component.ts). Va en Cancelar y no en el primer control porque un Enter reflejo sobre el foco inicial tiene que ser inocuo, nunca la escritura. -->
        <button type="button" class="btn btn-ghost" autofocus (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-testid="confirm"
                [disabled]="saving()" [class.loading]="saving()" (click)="confirm()">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Guardar asistencia
        </button>
      </div>
    </app-modal>
  `,
})
export class AttendanceModalComponent {
  readonly target = input.required<AttendanceTarget>();
  /** El modal NO toca la facade: la página cablea y le informa el desenlace. */
  readonly confirmed = output<readonly SessionAttendanceMark[]>();

  protected readonly marks = signal<Record<string, boolean>>({});
  protected readonly saving = signal(false);

  private readonly modal = viewChild.required(ModalComponent);

  protected readonly title = 'Tomar asistencia';
  protected readonly subtitle = computed(() => {
    const { group, session } = this.target();
    return `${groupTitle(group)} · ${fechaCorta(session.startAt)} ${horaCorta(session.startAt)} · ${session.courtName}`;
  });

  protected readonly markList = computed<SessionAttendanceMark[]>(() =>
    this.target().roster.map((m) => ({
      reservationId: m.id,
      status: this.isPresent(m.id) ? ('asistio' as const) : ('ausente' as const),
    })),
  );
  protected readonly present = computed(() => this.markList().filter((m) => m.status === 'asistio').length);
  protected readonly absent = computed(() => this.markList().length - this.present());

  /**
   * Siembra IMPERATIVA, nunca con un effect/computed sobre el input.
   *
   * Abre en limpio y prellena con `attendanceStatus`, que es lo que el panel guardó la última
   * vez: es la única forma de EDITAR una asistencia ya tomada, porque el estado de la clase no
   * cambia al marcarla. El que no tiene marca guardada arranca PRESENTE — es el caso normal en
   * una clase a la que fue todo el mundo.
   */
  open(): void {
    this.marks.set(
      Object.fromEntries(
        this.target().roster.map((m) => [m.id, m.attendanceStatus !== 'ausente']),
      ),
    );
    this.saving.set(false);
    this.modal().open();
  }

  close(): void { this.modal().close(); }
  markDone(): void { this.close(); }
  /** La página avisa que falló: el modal QUEDA ABIERTO y el botón vuelve a estar disponible. */
  markFailed(): void { this.saving.set(false); }

  protected ini(name: string): string { return initials(name); }
  protected isPresent(reservationId: string): boolean { return this.marks()[reservationId] ?? true; }
  protected mark(reservationId: string, present: boolean): void {
    this.marks.update((m) => ({ ...m, [reservationId]: present }));
  }

  protected confirm(): void {
    // GUARD DE DOBLE-SUBMIT EN CÓDIGO. `.btn.loading` es sólo pointer-events:none
    // (styles/components.css:55) y NO impide la activación por teclado: un botón enfocado sigue
    // disparando click con Enter. Sin este guard, dos Enter seguidos son dos POST en vuelo. El
    // [disabled] del template es el segundo freno; éste es el primero.
    if (this.saving()) return;
    this.saving.set(true);
    this.confirmed.emit(this.markList());
  }
}
