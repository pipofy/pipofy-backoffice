import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SessionReservation } from '@domain/entities/session-reservation';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  SessionAttendanceStatus,
} from '@domain/entities/session-attendance';

/** «Asistencia guardada: 5 presentes, 1 ausente.» Sólo nombra lo que hay. */
function resumenDe(results: readonly SessionAttendanceResult[]): string {
  const presentes = results.filter((r) => r.status === 'asistio').length;
  const ausentes = results.filter((r) => r.status === 'ausente').length;
  const partes = [
    ...(presentes ? [`${presentes} ${presentes === 1 ? 'presente' : 'presentes'}`] : []),
    ...(ausentes ? [`${ausentes} ${ausentes === 1 ? 'ausente' : 'ausentes'}`] : []),
  ];
  return partes.length ? `Asistencia guardada: ${partes.join(', ')}.` : 'Asistencia guardada.';
}

/**
 * La planilla de asistencia de UNA clase.
 *
 * COMPONENTE TONTO: no toca la facade, emite las marcas y espera que el padre le informe el
 * desenlace por `resultado()`. Mismo contrato que AttendanceModalComponent de features/grupos,
 * cuyo comentario dice literal que "el modal NO toca la facade: la página cablea y le informa
 * el desenlace".
 *
 * Vive afuera de SesionModalComponent por dos razones del repo: ese archivo ya tiene 424 líneas
 * con el template inline y es el más grande que hay, y su spec monta la facade REAL con dobles
 * de cinco repositorios, así que cualquier test nuevo adentro paga ese costo de entrada.
 *
 * Recibe el roster COMPLETO y filtra acá: es este componente el que sabe que sólo las reservas
 * `confirmed` se pueden marcar —`AttendanceService` rechaza cualquier otra— y el que tiene que
 * explicarlo con el hint.
 */
@Component({
  selector: 'app-asistencia-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './asistencia-seccion.component.css',
  template: `
    @if (confirmadas().length || errorGlobal() || fallosAgrupados().length) {
      <h4>Asistencia</h4>

      @if (hayPendientes()) {
        <p class="hint">
          Sólo se puede marcar la asistencia de las reservas confirmadas. Si falta alguien, confirmá
          su reserva primero.
        </p>
      }

      @if (errorGlobal()) {
        <p class="notice hold" role="alert">{{ errorGlobal() }}</p>
      }

      @for (f of fallosAgrupados(); track f.mensaje) {
        <p class="notice hold" role="alert">{{ f.nombres }}: {{ f.mensaje }}</p>
      }

      @if (confirmadas().length) {
        <div class="att-list">
          @for (r of confirmadas(); track r.id) {
            <div class="att-row">
              <div class="att-who">{{ nombre(r.studentId) }}</div>
              <div
                class="segpick"
                role="group"
                [attr.aria-label]="'Asistencia de ' + nombre(r.studentId)"
              >
                <button
                  type="button"
                  class="segp"
                  [class.on-p]="marcaDe(r.id) === 'asistio'"
                  [attr.aria-pressed]="marcaDe(r.id) === 'asistio'"
                  [disabled]="saving()"
                  (click)="marcar(r.id, 'asistio')"
                >
                  Presente
                </button>
                <button
                  type="button"
                  class="segp"
                  [class.on-a]="marcaDe(r.id) === 'ausente'"
                  [attr.aria-pressed]="marcaDe(r.id) === 'ausente'"
                  [disabled]="saving()"
                  (click)="marcar(r.id, 'ausente')"
                >
                  Ausente
                </button>
              </div>
            </div>
          }
        </div>

        <div class="att-actions">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-test="todos"
            [disabled]="saving()"
            (click)="vinieronTodos()"
          >
            Vinieron todos
          </button>
          <button
            type="button"
            class="btn btn-primary"
            data-test="guardar-asistencia"
            [disabled]="saving() || !hayMarcas()"
            (click)="onGuardar()"
          >
            Guardar asistencia
          </button>
        </div>
      }

      @if (resumen()) {
        <p class="hint" role="status">{{ resumen() }}</p>
      }
    }
  `,
})
export class AsistenciaSeccionComponent {
  /** El roster COMPLETO de la clase. El filtro por estado es responsabilidad de este componente. */
  readonly reservas = input.required<readonly SessionReservation[]>();
  /**
   * studentId → nombre. Un Map y no una función: el modal ya tiene ese `computed`
   * (`studentNames`) y pasarle un método perdería el `this`.
   */
  readonly nombres = input.required<ReadonlyMap<string, string>>();
  readonly saving = input(false);
  readonly guardar = output<readonly SessionAttendanceMark[]>();

  /**
   * Record y NO Map: con OnPush + zoneless un `map.set()` in-place no notifica y la fila no
   * repinta. Mismo patrón que attendance-modal.component.ts, que usa
   * `signal<Record<string, boolean>>({})` con `update()` y spread.
   */
  private readonly marcas = signal<Record<string, SessionAttendanceStatus>>({});
  private readonly fallos = signal<readonly SessionAttendanceResult[]>([]);
  protected readonly resumen = signal('');
  protected readonly errorGlobal = signal('');

  protected readonly confirmadas = computed(() =>
    this.reservas().filter((r) => r.status === 'confirmed'),
  );

  /**
   * Anotados puede mostrar seis filas y esta planilla cuatro: los `held` vigentes y los
   * `pending_review` —el anotado por WhatsApp sin plan, que el comentario de `anotados()`
   * describe como real y frecuente— aparecen allá y no acá. El hint explica la diferencia.
   *
   * Los `cancelled` y `expired` no cuentan: tampoco están en Anotados, así que su ausencia acá
   * no sorprende a nadie.
   */
  protected readonly hayPendientes = computed(() =>
    this.reservas().some((r) => r.status === 'held' || r.status === 'pending_review'),
  );

  /**
   * Agrupado por MENSAJE, no una línea por alumno: `markBulk` corre el mismo camino para las N
   * filas, así que un error sistémico —el `attendance_status` sin sembrar, por ejemplo— sale en
   * todas a la vez y sin agrupar sería un muro de texto idéntico.
   */
  protected readonly fallosAgrupados = computed(() => {
    const porMensaje = new Map<string, string[]>();
    const nombreDe = new Map(this.reservas().map((r) => [r.id, this.nombre(r.studentId)]));
    for (const f of this.fallos()) {
      const mensaje = f.error ?? 'No se pudo guardar.';
      const quien = nombreDe.get(f.reservationId) ?? `Reserva #${f.reservationId}`;
      porMensaje.set(mensaje, [...(porMensaje.get(mensaje) ?? []), quien]);
    }
    return [...porMensaje].map(([mensaje, nombres]) => ({ mensaje, nombres: nombres.join(', ') }));
  });

  protected readonly hayMarcas = computed(() =>
    this.confirmadas().some((r) => this.marcas()[r.id] !== undefined),
  );

  /** Lo llama `open()` del modal: la planilla no recuerda nada entre aperturas. */
  reset(): void {
    this.marcas.set({});
    this.fallos.set([]);
    this.resumen.set('');
    this.errorGlobal.set('');
  }

  /**
   * El padre informa el desenlace. Limpia SIEMPRE lo del guardado anterior antes de mostrar lo
   * nuevo: si no, el resultado viejo queda al lado del nuevo y los dos se leen como si fueran el
   * mismo guardado.
   */
  resultado(results: readonly SessionAttendanceResult[] | null, error: string): void {
    this.fallos.set([]);
    this.resumen.set('');
    this.errorGlobal.set('');
    if (results === null) {
      this.errorGlobal.set(error);
      return;
    }
    const fallidos = results.filter((r) => !r.ok);
    if (fallidos.length) {
      // La planilla NO se limpia: es donde se corrige y se reintenta.
      this.fallos.set(fallidos);
      return;
    }
    this.marcas.set({});
    this.resumen.set(resumenDe(results));
  }

  protected nombre(studentId: string): string {
    return this.nombres().get(studentId) ?? `Alumno #${studentId}`;
  }

  protected marcaDe(reservationId: string): SessionAttendanceStatus | undefined {
    return this.marcas()[reservationId];
  }

  protected marcar(reservationId: string, status: SessionAttendanceStatus): void {
    this.marcas.update((m) => ({ ...m, [reservationId]: status }));
  }

  protected vinieronTodos(): void {
    this.marcas.update((m) => ({
      ...m,
      ...Object.fromEntries(this.confirmadas().map((r) => [r.id, 'asistio' as const])),
    }));
  }

  /**
   * El body se arma desde `confirmadas()` y NO desde `marcas()`: entre marcar y guardar una
   * reserva puede dejar de estar `confirmed` —se confirmó un hold y el roster se releyó, o el
   * alumno canceló por WhatsApp— y esa marca huérfana viajaría igual, volvería como fallo
   * per-ítem, y como el parcial no limpia la planilla el reintento fallaría PARA SIEMPRE. Mismo
   * criterio que el `markList` de attendance-modal.component.ts.
   *
   * Sin guard de doble-submit acá: el freno vive en `conSesion()` del modal, que consulta
   * `facade.loading()` —estado propio del padre, seteado de forma síncrona antes del await— y no
   * un input, que en zoneless podría no haber propagado entre dos clicks seguidos. El
   * `[disabled]` del template es el segundo freno.
   */
  protected onGuardar(): void {
    const marks = this.confirmadas()
      .map((r) => ({ reservationId: r.id, status: this.marcas()[r.id] }))
      .filter((m): m is SessionAttendanceMark => m.status !== undefined);
    if (!marks.length) return;
    this.guardar.emit(marks);
  }
}
