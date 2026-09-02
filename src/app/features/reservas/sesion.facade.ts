import { Injectable, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { ReservationInput, createReservationDraft } from '@domain/entities/reservation';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { SessionReservation } from '@domain/entities/session-reservation';
import { ClassPaymentInput, createClassPaymentDraft } from '@domain/entities/payment';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  createSessionAttendanceDraft,
} from '@domain/entities/session-attendance';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { ReservasFacade } from './reservas.facade';

/**
 * Lo de UNA sesión: su lista de espera (la tríada de SignalStore) y el roster completo de sus
 * reservas — holds, confirmadas, canceladas, etc., no sólo las sin confirmar.
 *
 * Separada de ReservasFacade igual que AlumnoPlanesFacade de AlumnosFacade: con una sola
 * facade, abrir el modal prendería el spinner de la tabla y un error del modal taparía el de
 * la lista.
 *
 * ReservasFacade se INYECTA acá: las dos están provistas en la misma ruta, y "cancelar refresca
 * también las sesiones" es una regla del flujo, no de la pantalla. Dejarla en el componente la
 * volvía imposible de testear sin montar el modal.
 */
@Injectable()
export class SesionFacade extends SignalStore<WaitingListEntry[], DomainError> {
  private readonly sessions = inject(ClassSessionsRepository);
  private readonly reservations = inject(ReservationsRepository);
  private readonly reservas = inject(ReservasFacade);
  private readonly catalogs = inject(CatalogsRepository);

  private readonly _paymentMethods = signal<readonly CatalogItem[]>([]);
  readonly paymentMethods = this._paymentMethods.asReadonly();

  /**
   * Las reservas de la sesión abierta, tal como las devuelve la API. Reemplaza al Map en
   * memoria que vivía acá: aquél se perdía al salir de /reservas y un hold sin confirmar era
   * invisible después de un F5 aunque siguiera vivo en la base.
   *
   * Guarda el `sessionId` junto a las filas para que pedir OTRA clase devuelva vacío en vez de
   * el roster de la anterior mientras vuela el GET.
   */
  private readonly _reservations = signal<{
    readonly sessionId: string;
    readonly rows: readonly SessionReservation[];
  }>({ sessionId: '', rows: [] });

  reservationsOf(sessionId: string): readonly SessionReservation[] {
    const current = this._reservations();
    return current.sessionId === sessionId ? current.rows : [];
  }

  /**
   * Pendientes de confirmar: los `held`, **vencidos incluidos**. Ahí "Venció" es la información
   * útil. El recorte por vencimiento necesita un reloj y vive en el componente.
   */
  holdsOf(sessionId: string): readonly SessionReservation[] {
    return this.reservationsOf(sessionId).filter((r) => r.status === 'held');
  }

  private async loadReservations(sessionId: string): Promise<void> {
    this._reservations.set({ sessionId, rows: await this.sessions.reservations(sessionId) });
  }

  open(sessionId: string): Promise<void> {
    // Sale en paralelo y falla en silencio: sin medios de pago se puede confirmar con crédito
    // igual, que es el camino principal. Un error acá taparía el de la lista de espera.
    void this.loadPaymentMethods();
    // Las dos lecturas son independientes: encadenadas, el modal esperaría la suma de los dos
    // viajes en vez del más lento.
    return this.run(
      Promise.all([this.sessions.waitingList(sessionId), this.loadReservations(sessionId)]).then(
        ([waiting]) => waiting,
      ),
      toDomainError,
    );
  }

  /**
   * Falla en SILENCIO y el select queda vacío, que es lo que el aviso de abajo del select
   * explica. Un error acá taparía el de la lista de espera, que es el que importa.
   *
   * El guard evita repreguntar mientras viva la facade —una vez por visita a la pantalla, no
   * por cada apertura de modal—; `CatalogsRepository` ya memoiza el éxito y borra su entrada
   * al fallar, así que un endpoint que se recupera se detecta al volver a entrar.
   */
  private async loadPaymentMethods(): Promise<void> {
    if (this._paymentMethods().length > 0) return;
    try {
      this._paymentMethods.set(await this.catalogs.paymentMethods());
    } catch {
      this._paymentMethods.set([]);
    }
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * createReservationDraft tira de forma síncrona sin alumno o sin plan; va DENTRO de la
   * promesa para que run()/toDomainError normalicen la invariante igual que un fallo del repo.
   * Mismo patrón que CanchasFacade.create().
   *
   * Resuelve a `this.data()`: reservar no cambia la lista de espera, y releerla sería un GET
   * al pedo. run() necesita un valor para su tríada, así que se le devuelve el que ya tiene.
   */
  reservar(sessionId: string, input: ReservationInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.reservations.reserve(createReservationDraft(input)))
        .then(() => Promise.all([this.reservas.load(), this.loadReservations(sessionId)]))
        .then(() => this.data() ?? []),
      toDomainError,
    );
  }

  confirmar(sessionId: string, reservationId: string): Promise<void> {
    return this.run(
      this.reservations
        .confirm(reservationId)
        .then(() => Promise.all([this.reservas.load(), this.loadReservations(sessionId)]))
        .then(() => this.data() ?? []),
      toDomainError,
    );
  }

  /**
   * La OTRA salida del hold: cobrar en vez de gastar un crédito. Deja la reserva igual de
   * 'confirmed' que `confirmar()`, así que el roster se relee lo mismo.
   *
   * `createClassPaymentDraft` tira de forma síncrona con el monto vacío o sin medio de pago:
   * va DENTRO de la promesa, mismo patrón que `reservar()`.
   */
  cobrar(sessionId: string, reservationId: string, input: ClassPaymentInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.reservations.confirmPayment(reservationId, createClassPaymentDraft(input)))
        .then(() => Promise.all([this.reservas.load(), this.loadReservations(sessionId)]))
        .then(() => this.data() ?? []),
      toDomainError,
    );
  }

  /**
   * Marca la asistencia de la clase abierta. Devuelve el resultado POR ÍTEM, o `null` si falló
   * el POST entero.
   *
   * NO usa run(), y es a propósito: `run()` devuelve `Promise<void>` y publica en la tríada, así
   * que un valor de retorno tendría que salir por una variable de closure y el `[]` del catch
   * quedaría indistinguible de "salió todo bien". El patrón del repo para una escritura que
   * devuelve algo es setLoading/setError a mano con un centinela explícito —`signal-store.base.ts`
   * documenta `setLoading` justamente para "los flujos que NO caben en run()"— y el análogo
   * exacto es `HorariosFacade.generate()`: otra escritura cuyo resultado por ítem ninguna
   * relectura recupera.
   *
   * `createSessionAttendanceDraft` se llama DERECHO, sin el `Promise.resolve().then()` que usan
   * `reservar()` y `cobrar()`: ésos lo necesitan porque su try/catch vive dentro de run(), en
   * otro método; acá está en esta misma función, así que el throw síncrono ya cae donde tiene
   * que caer.
   *
   * NO RELEE cuando sale todo bien: `AttendanceService` escribe la tabla `attendance` y nada más
   * —la reserva sigue confirmed, el cupo no cambia, la lista de espera no cambia—, así que una
   * relectura devolvería exactamente lo que ya está en pantalla.
   */
  async tomarAsistencia(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<readonly SessionAttendanceResult[] | null> {
    this.setLoading(true);
    this.setError(null);
    try {
      const results = await this.sessions.markAttendance(
        sessionId,
        createSessionAttendanceDraft(marks),
      );
      if (results.some((r) => !r.ok)) {
        // El fallo más probable es que la reserva haya dejado de estar `confirmed` entre la
        // carga del roster y el Guardar: se confirmó un hold y el roster se releyó, o el alumno
        // canceló por WhatsApp. Esa fila no va a entrar por más que se reintente, y la
        // relectura la saca de la planilla dejando en pantalla exactamente lo reintentable.
        //
        // Su fallo se TRAGA: la planilla queda como está y el bloque de fallidos ya cuenta el
        // problema real. Un error acá lo taparía con uno de segundo orden.
        try {
          await this.loadReservations(sessionId);
        } catch {
          /* ver arriba */
        }
      }
      return results;
    } catch (err) {
      this.setError(toDomainError(err));
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Cancelar refresca TRES cosas. `cancel()` ya no promueve a nadie por sí solo: eso lo hace
   * `WaitingListOfferService.offerNext()`, que el controlador llama porque el repo manda
   * `offerToWaitingList` (ver el comentario de `cancel()` en http-reservations.repository.ts).
   * Y `offerNext()` no crea un hold nuevo, marca la anotación del primero de la lista como
   * 'notificado' con vencimiento a 15 minutos y le manda un WhatsApp; recién si el alumno
   * acepta por ahí toma el lugar. Por eso releer la lista de espera importa igual que releer
   * las sesiones y el roster: la anotación cambió de estado sin que el usuario haya tocado ese
   * bloque, aunque no vaya a aparecer un hold nuevo.
   *
   * Las tres lecturas son independientes entre sí —sólo dependen de que el cancel haya
   * entrado—, así que van en paralelo: encadenadas, el modal esperaba la suma de los tres
   * viajes en vez del más lento.
   */
  cancelar(sessionId: string, reservationId: string): Promise<void> {
    return this.run(
      this.reservations
        .cancel(reservationId)
        .then(() =>
          Promise.all([
            this.reservas.load(),
            this.loadReservations(sessionId),
            this.sessions.waitingList(sessionId),
          ]),
        )
        .then(([, , waiting]) => waiting),
      toDomainError,
    );
  }

  anotar(sessionId: string, studentId: string): Promise<void> {
    return this.run(
      this.sessions
        .joinWaitingList(sessionId, studentId)
        .then(() => this.sessions.waitingList(sessionId)),
      toDomainError,
    );
  }

  quitar(sessionId: string, entryId: string): Promise<void> {
    return this.run(
      this.sessions.leaveWaitingList(entryId).then(() => this.sessions.waitingList(sessionId)),
      toDomainError,
    );
  }
}
