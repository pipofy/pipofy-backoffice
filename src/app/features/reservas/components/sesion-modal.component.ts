import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal, viewChild,
} from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { ClassSession } from '@domain/entities/class-session';
import { Student, studentDisplayName } from '@domain/entities/student';
import { StudentPlan, studentPlanIsUsable } from '@domain/entities/student-plan';
import { Plan } from '@domain/entities/plan';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { domainErrorMessage } from '@domain/errors';
import { catalogLabel } from '@data/catalog-labels';
import { localDateKey } from '@domain/local-date';
import { reservationStatusLabel } from '@domain/entities/session-reservation';
import { SessionAttendanceMark } from '@domain/entities/session-attendance';
import { SesionFacade } from '../sesion.facade';
import { minutosRestantes } from '../hold-countdown';
import { AsistenciaSeccionComponent } from './asistencia-seccion.component';

@Component({
  selector: 'app-sesion-modal',
  standalone: true,
  imports: [ModalComponent, AsistenciaSeccionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Clase" [subtitle]="subtitle()" icon="primary">
      @if (errorText()) { <p class="notice hold form-error" role="alert">{{ errorText() }}</p> }

      <h4>Inscribir</h4>
      <p class="hint">Sólo aparecen los alumnos con categoría cargada. Si la API rechaza la
         inscripción por categoría, revisá las categorías del grupo en Configuración.</p>
      <div class="field field-dense">
        <label for="res-alumno">Alumno</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus' -->
        <select id="res-alumno" class="control" autofocus
                [value]="studentId()" (change)="onStudent($event)">
          <option value="">Elegí un alumno…</option>
          @for (s of elegibles(); track s.id) {
            <option [value]="s.id">{{ name(s) }}</option>
          }
        </select>
      </div>

      <div class="field field-dense">
        <label for="res-plan">Plan</label>
        <select id="res-plan" class="control" [value]="planId()" (change)="onPlan($event)">
          <option value="">Elegí un plan…</option>
          @for (p of planesUsables(); track p.id) {
            <option [value]="p.id">{{ planName(p.planId) }} · {{ p.creditsRemaining }} créditos</option>
          }
        </select>
        @if (studentId() && !planesUsables().length) {
          <p class="hint">
            Este alumno no tiene planes con créditos vigentes. Sin plan la reserva no se puede
            confirmar, así que hay que venderle uno antes.
          </p>
        }
      </div>
      <button type="button" class="btn btn-primary" [disabled]="!puedeReservar() || facade.loading()"
              (click)="onReservar()">Reservar</button>

      <h4>Anotados</h4>
      @for (r of anotados(); track r.id) {
        <div class="arow">
          <div class="a-main">
            <div class="a-title">{{ nameOf(r.studentId) }}</div>
            <div class="a-meta">{{ estado(r.status) }}</div>
          </div>
        </div>
      } @empty {
        <p class="a-empty">Todavía no se anotó nadie.</p>
      }

      <app-asistencia-seccion
        [reservas]="rosterActual()"
        [nombres]="studentNames()"
        [saving]="facade.loading()"
        (guardar)="onAsistencia($event)"
      />

      <h4>Pendientes de confirmar</h4>
      @for (h of holds(); track h.id) {
        <div class="arow">
          <div class="a-main">
            <div class="a-title">{{ nameOf(h.studentId) }}</div>
            <div class="a-meta">
              @if (vencido(h.holdExpiresAt)) {
                Venció
              } @else {
                {{ minutos(h.holdExpiresAt) }} min para que venza
              }
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm"
                  [disabled]="facade.loading() || vencido(h.holdExpiresAt)"
                  (click)="onConfirmar(h.id)">Confirmar</button>
          <!-- La OTRA salida del hold, no un fallback: Confirmar gasta un crédito del plan,
               Cobrar cobra plata y no toca los créditos. Cuál corresponde lo decide el
               mostrador. Sólo es el único camino cuando la reserva no tiene plan con
               créditos: ahí Confirmar devuelve 409 'Requiere pago manual'. -->
          <button type="button" class="btn btn-ghost btn-sm" data-test="cobrar"
                  [disabled]="facade.loading() || vencido(h.holdExpiresAt)"
                  [attr.aria-expanded]="cobrando() === h.id"
                  (click)="onCobrarToggle(h.id)">Cobrar</button>
          <button type="button" class="btn btn-danger btn-sm" [disabled]="facade.loading()"
                  (click)="onCancelar(h.id)">Cancelar</button>
        </div>

        <!-- Fila que se despliega y NO un modal anidado: un <dialog> adentro de otro es
             justo lo que el polyfill de jsdom de test-setup.ts no cubre. -->
        @if (cobrando() === h.id) {
          <div class="cobro" data-test="cobro-form">
            <div class="field field-dense">
              <label [attr.for]="'cobro-monto-' + h.id">Monto cobrado</label>
              <!-- inputmode y no type="number": el monto viaja como string hasta un Decimal
                   de Prisma, y un input numérico lo redondearía antes de salir de acá. -->
              <input class="control" inputmode="decimal" placeholder="0"
                     [attr.id]="'cobro-monto-' + h.id"
                     [value]="monto()" (input)="onMonto($event)" />
            </div>
            <div class="field field-dense">
              <label [attr.for]="'cobro-medio-' + h.id">Medio de pago</label>
              <select class="control" [attr.id]="'cobro-medio-' + h.id"
                      [value]="medio()" (change)="onMedio($event)">
                <option value="">Elegí un medio…</option>
                @for (m of facade.paymentMethods(); track m.id) {
                  <option [value]="m.id">{{ label(m.name) }}</option>
                }
              </select>
              @if (facade.paymentMethods().length === 0) {
                <p class="hint">No se pudieron cargar los medios de pago. Cerrá y reabrí la clase.</p>
              }
            </div>
            <!-- Mismo guard que Confirmar y que Cobrar: sobre un hold vencido el backend
                 responde 409 'El hold expiró', así que el botón no tiene que dejar intentarlo. -->
            <button type="button" class="btn btn-primary btn-sm" data-test="cobro-confirmar"
                    [disabled]="facade.loading() || vencido(h.holdExpiresAt)"
                    (click)="onCobrar(h.id)">Cobrar y confirmar</button>
          </div>
        }
      } @empty {
        <p class="a-empty">Ninguna reserva pendiente.</p>
      }

      <h4>Lista de espera</h4>
      @for (e of facade.data() ?? []; track e.id) {
        <div class="arow">
          <div class="a-main"><div class="a-title">{{ nameOf(e.studentId) }}</div></div>
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="facade.loading()"
                  (click)="onQuitar(e.id)">Quitar</button>
        </div>
      } @empty {
        <p class="a-empty">Sin lista de espera.</p>
      }
      <button type="button" class="btn btn-ghost" [disabled]="!studentId() || facade.loading()"
              (click)="onAnotar()">Anotar al alumno elegido</button>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cerrar</button>
      </div>
    </app-modal>
  `,
  styles: [`
    .form-error{margin-bottom:var(--space-md)}
    h4{margin:var(--space-md) 0 var(--space-sm)}
    .cobro{padding:var(--space-sm) var(--space-md);border-left:2px solid var(--color-primary)}
  `],
})
export class SesionModalComponent {
  readonly students = input.required<readonly Student[]>();
  /** id de cancha/profesor/grupo → nombre, ya resuelto por la página. */
  readonly labels = input.required<(session: ClassSession) => string>();

  protected readonly facade = inject(SesionFacade);
  private readonly repo = inject(StudentsRepository);
  private readonly plansRepo = inject(PlansRepository);
  private readonly modal = viewChild.required(ModalComponent);
  private readonly asistencia = viewChild.required(AsistenciaSeccionComponent);

  protected readonly session = signal<ClassSession | null>(null);
  protected readonly studentId = signal('');
  protected readonly planId = signal('');

  /** id de la reserva cuya fila de cobro está desplegada, o null. Uno a la vez: dos formularios
   *  abiertos comparten `monto` y `medio` y no hay forma de saber cuál se está editando. */
  protected readonly cobrando = signal<string | null>(null);
  protected readonly monto = signal('');
  protected readonly medio = signal('');
  private readonly plans = signal<readonly StudentPlan[]>([]);
  /** Catálogo de planes, sólo para ponerles nombre a las opciones del select. */
  private readonly planCatalog = signal<readonly Plan[]>([]);

  /** Avanza cada 30 s. El hold dura 30 minutos: el segundero no aporta nada. */
  private readonly now = signal(new Date());

  constructor() {
    // Sólo tickea si hay alguna reserva en `held` — vencidas incluidas, porque holdsOf() filtra
    // por estado y no por vencimiento, y la fila vencida sigue mostrando "Venció" en Pendientes.
    // El modal vive montado toda la visita a
    // /reservas —el <dialog> se cierra, el componente no se destruye—, así que sin esta
    // guarda era un set() y su ciclo de detección de cambios cada 30 s para siempre.
    const timer = setInterval(() => {
      if (this.holds().length) this.now.set(new Date());
    }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Falla en SILENCIO, mismo patrón que AlumnoPlanesFacade.loadPlanNames(): sin nombres el
    // select sigue sirviendo, sólo pierde el rótulo y muestra "Plan #id".
    void this.plansRepo.list().then((p) => this.planCatalog.set(p)).catch(() => this.planCatalog.set([]));
  }

  /**
   * Se excluyen los alumnos SIN categoría: de esos el front sabe con certeza que la API los
   * rechaza. Del resto no puede saber nada — ningún GET devuelve los items del grupo —, así
   * que se muestran todos y el 400 del backend es el feedback. Filtrar con la pista guardada
   * escondería alumnos válidos, y equivocarse escondiendo es peor que equivocarse mostrando.
   *
   * ponytail: el select no filtra por la categoría REAL del grupo, sólo excluye "sin
   * categoría". Techo: un alumno de otra categoría igual aparece acá y el 400 recién avisa al
   * confirmar. Salida: el mismo include del `list()`/`getOne()` de category-groups del backend
   * (ver CategoryGroupsRepository).
   */
  protected readonly elegibles = computed(() =>
    this.students().filter((s) => s.categoryId !== null),
  );

  protected readonly planesUsables = computed(() => {
    const hoy = localDateKey(this.now());
    return this.plans().filter((p) => studentPlanIsUsable(p, hoy));
  });

  /** planId → nombre. Mismo patrón que AlumnoPlanesFacade._names. */
  private readonly planNames = computed(
    () => new Map(this.planCatalog().map((p) => [p.id, p.name] as const)),
  );

  /** studentId → nombre. Igual que planNames: el template lo llama una vez POR FILA, en dos
   *  listas, y sin el mapa cada fila barría el padrón entero en cada ciclo de detección. */
  protected readonly studentNames = computed(
    () => new Map(this.students().map((s) => [s.id, studentDisplayName(s)] as const)),
  );

  /** El roster de la clase abierta. Lo mismo que leen anotados() y holds(). */
  protected readonly rosterActual = computed(() =>
    this.facade.reservationsOf(this.session()?.id ?? ''),
  );

  /**
   * Tres estados van acá: confirmadas, holds VIGENTES y `pending_review`. Las dos primeras son
   * las que cuenta `countOccupiedSpots` en el backend — un hold vencido queda afuera porque
   * mostrarlo acá diría que el lugar está tomado. Sigue apareciendo en "Pendientes", que es
   * donde "Venció" es la información útil.
   *
   * `pending_review` es la excepción consciente: el backend NO la cuenta para el cupo, pero es
   * un alumno real anotado por WhatsApp sin plan, esperando revisión manual (ver
   * `conversation.service.ts`) — dejarla fuera de las dos secciones la haría invisible en el
   * panel, que es peor que no contarla en el cupo. No va a "Pendientes" porque ahí el
   * `holdExpiresAt` maneja la cuenta regresiva y `pending_review` lo trae en `null` a
   * propósito (no expira por el mecanismo de hold normal) — mostrarla ahí diría "Venció" para
   * siempre, que es mentira.
   *
   * Depende de `now()` a través de `vencido()`: el tick de 30 s lo saca solo de esta lista.
   */
  protected readonly anotados = computed(() =>
    this.facade
      .reservationsOf(this.session()?.id ?? '')
      .filter(
        (r) =>
          r.status === 'confirmed' ||
          r.status === 'pending_review' ||
          (r.status === 'held' && !this.vencido(r.holdExpiresAt)),
      ),
  );

  protected estado(name: string): string { return reservationStatusLabel(name); }

  protected readonly holds = computed(() => this.facade.holdsOf(this.session()?.id ?? ''));

  protected puedeReservar(): boolean {
    return this.studentId() !== '' && this.planId() !== '';
  }

  /**
   * Sin fracción de ocupación: `session()` es el `ClassSession` capturado en `open()` y nunca
   * se refresca, mientras que "Anotados" sí relee la API en vivo — mostrar "3/6" arriba de una
   * lista de cinco alumnos era el resultado. Ni con datos frescos coincidirían del todo:
   * `pending_review` cuenta para "Anotados" pero no para el `countOccupiedSpots` del backend.
   * La lista de abajo ya dice exactamente quién está anotado, que es más información que una
   * fracción, y calcular el cupo acá duplicaría la lógica de cupo del backend.
   */
  protected subtitle(): string {
    const s = this.session();
    return s ? `${this.labels()(s)} · ${s.capacity} lugares` : '';
  }

  protected name(s: Student): string { return studentDisplayName(s); }

  protected nameOf(studentId: string): string {
    return this.studentNames().get(studentId) ?? `Alumno #${studentId}`;
  }

  protected minutos(holdExpiresAt: string | null): number {
    return minutosRestantes(holdExpiresAt, this.now());
  }

  /** Un hold vencido (0 min) sólo puede devolver 409 'El hold expiró' al confirmar. */
  protected vencido(holdExpiresAt: string | null): boolean {
    return this.minutos(holdExpiresAt) <= 0;
  }

  protected planName(planId: string): string {
    return this.planNames().get(planId) || `Plan #${planId}`;
  }

  protected label(name: string): string { return catalogLabel(name); }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  open(session: ClassSession): void {
    this.session.set(session);
    this.studentId.set('');
    this.planId.set('');
    this.plans.set([]);
    this.cerrarCobro();
    this.asistencia().reset();
    this.facade.clearError();
    void this.facade.open(session.id);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onStudent(e: Event): void {
    this.studentId.set((e.target as HTMLSelectElement).value);
    this.planId.set('');
    this.plans.set([]);
    const id = this.studentId();
    if (!id) return;
    // Falla en silencio: sin planes el select queda vacío y el cartel explica por qué. Un
    // error acá no debería tapar el de la reserva, que es el que importa.
    void this.repo.plans(id).then((p) => this.plans.set(p)).catch(() => this.plans.set([]));
  }

  protected onPlan(e: Event): void {
    this.planId.set((e.target as HTMLSelectElement).value);
  }

  /**
   * GUARD DE DOBLE-SUBMIT EN CÓDIGO, mismo patrón que AttendanceModalComponent.confirm():
   * `.btn` no bloquea la activación por teclado, así que un Enter repetido sobre el botón
   * enfocado sigue disparando click. El `[disabled]` del template es el segundo freno; éste
   * es el primero.
   *
   * En onReservar() el freno es CRITICAL y no cosmético: `class-sessions.service.ts` valida
   * club, alumno, categoría, plan y cupo, pero NUNCA chequea si el alumno ya tiene una reserva
   * en esta sesión, y `schema.prisma` no tiene índice único sobre (classSessionId, studentId).
   * Dos `reservar()` en vuelo son dos holds del mismo alumno —dos lugares consumidos de un
   * cupo de 4— y si los dos se confirman, dos créditos descontados. Nada en ninguna otra capa
   * lo impide. En los otros cuatro es prolijidad: ahí el backend responde 409 y el usuario
   * sólo se come un error rojo por hacer doble click.
   *
   * Los CINCO handlers pasan por acá y ninguno llama a la facade derecho: escrito cinco veces,
   * el freno que importa se arregla en cuatro lugares y se olvida en el quinto.
   */
  private conSesion(fn: (sessionId: string) => Promise<void>): void {
    if (this.facade.loading()) return;
    const s = this.session();
    if (s) void fn(s.id);
  }

  protected onReservar(): void {
    this.conSesion((sessionId) =>
      this.facade
        .reservar(sessionId, {
          sessionId,
          studentId: this.studentId(),
          studentPlanId: this.planId(),
        })
        .then(() => {
          // Sólo si salió bien: limpiar tras un error dejaría al usuario reescribiendo el
          // alumno y el plan que ya había elegido. Es el otro borde del mismo agujero de
          // doble-submit — sin esto el botón queda armado apuntando al mismo alumno.
          if (this.facade.error()) return;
          this.studentId.set('');
          this.planId.set('');
          this.plans.set([]);
        }),
    );
  }

  protected onConfirmar(reservationId: string): void {
    this.conSesion((sessionId) => this.facade.confirmar(sessionId, reservationId));
  }

  /** Abre la fila de cobro de esta reserva, o la cierra si ya era la abierta. */
  protected onCobrarToggle(reservationId: string): void {
    if (this.cobrando() === reservationId) {
      this.cerrarCobro();
      return;
    }
    this.facade.clearError();
    this.cobrando.set(reservationId);
    this.monto.set('');
    this.medio.set('');
  }

  protected onMonto(e: Event): void { this.monto.set((e.target as HTMLInputElement).value); }
  protected onMedio(e: Event): void { this.medio.set((e.target as HTMLSelectElement).value); }

  /** Pasa por conSesion como los otros cinco handlers: ver el comentario de doble-submit. */
  protected onCobrar(reservationId: string): void {
    this.conSesion((sessionId) =>
      this.facade
        .cobrar(sessionId, reservationId, { paymentMethodId: this.medio(), amount: this.monto() })
        .then(() => {
          // Sólo si salió bien: cerrar tras un error se lleva puesto el monto ya tipeado.
          if (this.facade.error()) return;
          this.cerrarCobro();
        }),
    );
  }

  private cerrarCobro(): void {
    this.cobrando.set(null);
    this.monto.set('');
    this.medio.set('');
  }

  protected onCancelar(reservationId: string): void {
    this.conSesion((sessionId) => this.facade.cancelar(sessionId, reservationId));
  }

  protected onAnotar(): void {
    this.conSesion((sessionId) => this.facade.anotar(sessionId, this.studentId()));
  }

  protected onQuitar(entryId: string): void {
    this.conSesion((sessionId) => this.facade.quitar(sessionId, entryId));
  }

  /**
   * Pasa por conSesion() como los otros cinco: su docstring dice que el freno "se arregla en
   * cuatro lugares y se olvida en el quinto", y éste es el sexto. Acá el doble submit es
   * inofensivo —el endpoint es un upsert— pero el segundo run() limpiaría el error y los
   * fallidos del primero.
   *
   * El error del POST entero se le pasa a la sección para que lo pinte al lado del botón: el
   * errorText() de arriba del modal queda fuera de la vista con cinco secciones por encima y
   * un .modal-body que scrollea.
   */
  protected onAsistencia(marks: readonly SessionAttendanceMark[]): void {
    this.conSesion(async (sessionId) => {
      const results = await this.facade.tomarAsistencia(sessionId, marks);
      this.asistencia().resultado(results, this.errorText());
    });
  }
}
