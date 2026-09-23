import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Group, RosterMember } from '@domain/entities/group';
import {
  SessionAttendanceMark,
  SessionAttendanceResult,
  createSessionAttendanceDraft,
} from '@domain/entities/session-attendance';
import { Category } from '@domain/entities/category';
import { TenantContext } from '@shared/tenant/tenant-context';
import { DomainError, asDomainError } from '@domain/errors';
import { toRoster } from '@domain/derive-groups';

@Injectable()
export class GruposFacade extends SignalStore<Group[], DomainError> {
  private readonly repo = inject(GroupsRepository);
  private readonly sessions = inject(ClassSessionsRepository);
  private readonly categoriesRepo = inject(CategoriesRepository);
  private readonly reservas = inject(ReservationsRepository);
  private readonly tenant = inject(TenantContext, { optional: true });

  /** Atajo para los templates: [] mientras no haya datos. */
  readonly groups = computed(() => this.data() ?? []);

  private readonly _roster = signal<readonly RosterMember[]>([]);
  private readonly _detalleCargando = signal(false);
  /**
   * El fallo del detalle, APARTE de error(): éste pinta dos paneles, aquél reemplaza la pantalla.
   * Existe porque un roster vacío y un roster que no se pudo traer se ven igual, y el segundo
   * deja el "Inscriptos 3" del hero peleado con el "Nadie inscripto" de la tabla.
   */
  private readonly _detalleError = signal<DomainError | null>(null);
  readonly roster = this._roster.asReadonly();
  readonly detalleCargando = this._detalleCargando.asReadonly();
  readonly detalleError = this._detalleError.asReadonly();

  /** Lookups de nombres. Se piden una vez por vida de la facade, que dura lo que dura /grupos. */
  private categories: readonly Category[] | null = null;

  constructor() {
    super();
    // Aislamiento de tenant: limpia el estado cuando el tenant CAMBIA. El flag saltea el valor
    // inicial — sin él, el primer run del effect pisaría el estado recién cargado.
    let seenFirst = false;
    effect(() => {
      this.tenant?.tenantId();
      if (!seenFirst) { seenFirst = true; return; }
      this.reset();
      this._roster.set([]);
      this._detalleError.set(null);
      this.categories = null;
    });
  }

  load(): Promise<void> {
    return this.run(this.repo.listGroups(), asDomainError);
  }

  /**
   * Roster y lista de espera de la próxima sesión del grupo.
   *
   * NO pasa por run(): su fallo no debe reemplazar la pantalla entera, que ya tiene el grupo
   * cargado y es lo más valioso que hay para mostrar. El detalle sigue mostrando el hero y las
   * sesiones, y los dos paneles que dependen de esta lectura pintan su propio error.
   *
   * Lo que el fallo NO puede hacer es pasar por vacío. "Nadie inscripto todavía" y "Ocupación
   * 0/4" debajo de un hero que dice "Inscriptos 3" es la misma contradicción que el §3.7 existe
   * para evitar —el número de arriba peleado con las filas de abajo—, y encima sin ninguna señal
   * de que algo falló. Por eso el error se EXPONE en `detalleError()` en vez de tragarse.
   */
  async loadDetalle(nextSessionId: string | null): Promise<void> {
    // Un grupo sin próxima sesión programada no tiene roster que pedir: es vacío de verdad,
    // no un fallo.
    if (nextSessionId === null) {
      this._roster.set([]);
      this._detalleError.set(null);
      return;
    }
    this._detalleCargando.set(true);
    this._detalleError.set(null);
    try {
      const [reservations, categories] = await Promise.all([
        this.sessions.reservations(nextSessionId),
        this.lookupCategories(),
      ]);
      this._roster.set(toRoster(reservations, categories, new Date()));
    } catch (err) {
      this._roster.set([]);
      this._detalleError.set(asDomainError(err));
    } finally {
      this._detalleCargando.set(false);
    }
  }

  /**
   * Saca a un alumno de UNA clase, no del grupo: cancela su reserva de la próxima sesión.
   *
   * La inscripción a un grupo no existe en la base (ver el ponytail de entities/group.ts), así
   * que esto es todo lo que se puede hacer hoy — y por eso el botón de la tabla lo dice con el
   * día y la hora, en vez de prometer que lo saca del grupo.
   *
   * Relee las DOS lecturas, no una: el roster sale de `reservations()` y el cupo del hero de
   * `listGroups()`. Releer sólo el roster deja "3/4" arriba con 2 filas abajo — justo la
   * desincronización que esto intenta evitar.
   *
   * El roster se relee EXPLÍCITAMENTE y no se confía en que el refresco de grupos lo dispare:
   * hoy la página del detalle tiene un effect sobre `group()` que lo hace, así que puede haber
   * una lectura de más, pero atar esta facade a un effect de una página la rompería en silencio
   * el día que esa página cambie. Una lectura de sobra después de un click es barata.
   *
   * El refresco de grupos va con `setData` y NO con `load()`: la página esconde todo detrás de
   * `@if (loading())`, así que un load() normal parpadearía la pantalla entera después de cada
   * quitada. Y si la RELECTURA falla, no se reporta como fallo del quitar —que sí anduvo—: sale
   * por `detalleError`, que es donde el usuario está mirando.
   */
  async quitarDeClase(reservationId: string, nextSessionId: string): Promise<void> {
    await this.reservas.cancel(reservationId);
    await this.loadDetalle(nextSessionId);
    try {
      this.setData(await this.repo.listGroups());
    } catch (err) {
      this._detalleError.set(asDomainError(err));
    }
  }

  /**
   * El roster de UNA sesión cualquiera, para el modal de asistencia. Se devuelve y no se guarda:
   * el modal es efímero y la sesión que se marca casi nunca es la próxima.
   */
  async rosterDeSesion(sessionId: string): Promise<readonly RosterMember[]> {
    const [reservations, categories] = await Promise.all([
      this.sessions.reservations(sessionId),
      this.lookupCategories(),
    ]);
    return toRoster(reservations, categories, new Date());
  }

  /**
   * LAS DOS TRAMPAS GEMELAS — este método NO toca loading() NI error(), a propósito, y DEJA
   * PROPAGAR el error. Es una copia deliberada de DashboardFacade.cancel(), por las mismas tres
   * razones:
   *
   *  1. El template del detalle es una cadena `@if (loading()) … @else if (error()) … @else if
   *     (data())` y el modal vive DENTRO de la rama data(): usar run() prendería loading() y el
   *     modal se desmontaría con el usuario adentro.
   *  2. setError() tiene el mismo efecto por la otra rama: reemplaza la pantalla entera por el
   *     estado de error aunque data() siga poblado, en vez de dejar el modal abierto.
   *  3. run() atrapa TODO en su try/catch y NUNCA rechaza (signal-store.base.ts:23-29), así que
   *     el catch de la página no correría y saldría el toast de ÉXITO tras un fallo.
   *
   * Un implementador que "arregle" esto usando run() reintroduce exactamente el bug.
   *
   * NO relee después de escribir, y es la excepción justificada a la convención del repo:
   * `markBulk` escribe la tabla `attendance` y no toca el cupo, ni los créditos, ni el estado de
   * la reserva, ni el de la clase. Nada de lo que la pantalla muestra cambia. El resultado POR
   * ÍTEM que devuelve es lo único que hay, porque ninguna relectura lo recupera.
   */
  // `async` y no un return pelado de la promesa: `createSessionAttendanceDraft` tira
  // SINCRÓNICAMENTE, y la página espera ese fallo en su `catch`, no como una excepción que le
  // explota antes del await.
  async saveAttendance(
    sessionId: string,
    marks: readonly SessionAttendanceMark[],
  ): Promise<SessionAttendanceResult[]> {
    return this.sessions.markAttendance(sessionId, createSessionAttendanceDraft(marks));
  }

  private async lookupCategories(): Promise<readonly Category[]> {
    this.categories ??= await this.categoriesRepo.list();
    return this.categories;
  }

}
