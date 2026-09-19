import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import {
  Schedule,
  ScheduleInput,
  createScheduleDraft,
  createScheduleDrafts,
  sessionRangeForSchedule,
  SessionGenerationInput,
  SessionGenerationResult,
  createSessionGenerationDraft,
} from '@domain/entities/schedule';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { localDateKey } from '@domain/local-date';

/**
 * Lo que deja un alta: cuántos horarios ENTRARON —puede ser menos que los días marcados, ver
 * create()— y cómo salió la generación de clases que viene pegada. `generacion: null` puede
 * ser tres cosas distintas: no había nada que generar, la generación falló, o el alta falló
 * antes de llegar. Las separan `generateError()` y `error()`.
 */
export interface CreateScheduleOutcome {
  readonly creados: number;
  readonly generacion: SessionGenerationResult | null;
}

/**
 * ponytail: create/update/remove reusan `loading`, así que la tabla muestra su spinner
 * mientras se guarda. Es aceptable porque el modal la tapa.
 */
@Injectable()
export class HorariosFacade extends SignalStore<Schedule[], DomainError> {
  private readonly repo = inject(SchedulesRepository);
  private readonly courtsRepo = inject(CourtsRepository);
  private readonly coachesRepo = inject(CoachesRepository);
  private readonly categoryGroupsRepo = inject(CategoryGroupsRepository);
  private readonly catalogs = inject(CatalogsRepository);

  private readonly _courts = signal<readonly Court[]>([]);
  private readonly _coaches = signal<readonly Coach[]>([]);
  private readonly _categoryGroups = signal<readonly CategoryGroup[]>([]);
  private readonly _sessionTypes = signal<readonly CatalogItem[]>([]);
  /** Lookup para el select de canchas y para la columna Cancha. Vacío si su carga falló. */
  readonly courts = this._courts.asReadonly();
  /** Lookup para el select de profesores y para la columna Profesor. Vacío si su carga falló. */
  readonly coaches = this._coaches.asReadonly();
  /** Lookup para el select de grupos y para la columna Grupo. Vacío si su carga falló. */
  readonly categoryGroups = this._categoryGroups.asReadonly();
  /** Lookup para el select de tipo de clase. Vacío si falló. */
  readonly sessionTypes = this._sessionTypes.asReadonly();

  private readonly _generating = signal(false);
  private readonly _generateError = signal<DomainError | null>(null);
  readonly generating = this._generating.asReadonly();
  readonly generateError = this._generateError.asReadonly();

  /**
   * El backend no ordena. Y el orden NO es el numérico de `weekday`: 0 es domingo (§3.4) y
   * en Argentina la semana arranca el lunes, así que (weekday + 6) % 7 lo manda al final.
   * Las filas sin día van después de todo: son plantillas viejas que generateSessions saltea.
   */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => {
      const wa = a.weekday === null ? 99 : (a.weekday + 6) % 7;
      const wb = b.weekday === null ? 99 : (b.weekday + 6) % 7;
      if (wa !== wb) return wa - wb;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  });

  load(): Promise<void> {
    return this.run(this.repo.list(), toDomainError);
  }

  /**
   * Los lookups fallan en SILENCIO, misma política que en Canchas y Planes: sin canchas el
   * select queda vacío, pero la tabla sigue siendo usable y el error que importa —el de la
   * lista de horarios— es el que se muestra. Meterlos en error() taparía el otro.
   *
   * No usa run() justamente por eso: run() escribe en data(), loading() y error().
   *
   * El helper existe porque acá hay CUATRO copias del mismo try/catch. Con una o dos, el
   * try/catch a la vista es más claro que la indirección — por eso las otras facades no lo
   * tienen y no hay que "unificarlas".
   */
  private async loadLookup<T>(
    fetch: () => Promise<readonly T[]>,
    target: WritableSignal<readonly T[]>,
  ): Promise<void> {
    try {
      target.set(await fetch());
    } catch {
      target.set([]);
    }
  }

  /** La página lo llama junto con load(): las cuatro cargas van en paralelo, cada una con
   *  su propio try/catch silencioso vía loadLookup. */
  async loadLookups(): Promise<void> {
    await Promise.all([
      this.loadLookup(() => this.courtsRepo.list(), this._courts),
      this.loadLookup(() => this.coachesRepo.list(), this._coaches),
      this.loadLookup(() => this.categoryGroupsRepo.list(), this._categoryGroups),
      this.loadLookup(() => this.catalogs.sessionTypes(), this._sessionTypes),
    ]);
  }

  /** Ver GruposCategoriaFacade.clearError(): mismo motivo, y por qué no vive en SignalStore. */
  clearError(): void {
    this.setError(null);
  }

  /**
   * SignalStore.reset() sólo limpia data/loading/error: no sabe de los cuatro lookups ni de
   * generating/generateError, seis piezas de estado propias de esta facade. Mismo override
   * que PlanesFacade (planes.facade.ts:60).
   */
  override reset(): void {
    super.reset();
    this._courts.set([]);
    this._coaches.set([]);
    this._categoryGroups.set([]);
    this._sessionTypes.set([]);
    this._generating.set(false);
    this._generateError.set(null);
  }

  /**
   * El alta: crea UN horario por día marcado y, con los horarios ya en la base, genera sus
   * clases. Devuelve cuántos horarios ENTRARON —no cuántos se pidieron— y cómo salió la
   * generación.
   *
   * NO usa run(), y son tres motivos distintos, cada uno con su bug si se "simplifica":
   *
   *  1. ÉXITO PARCIAL. Son N POST y el backend no tiene @@unique (§3.11): que entren tres de
   *     cinco es un resultado posible. run() publica el fallo SIN tocar data(), así que la
   *     tabla no mostraría los tres que sí entraron y el reintento los duplicaría. Acá se
   *     relee siempre que haya entrado alguno, y el conteo real viaja al llamador para que
   *     pueda decir "3 de 5" en vez de "no se guardó nada".
   *  2. EL BOTÓN GUARDAR. run() apaga loading() al terminar los POST, pero el modal sigue
   *     abierto durante toda la generación que viene después: un segundo click en esa ventana
   *     crea el juego de horarios otra vez. loading() se apaga recién en el finally de abajo,
   *     cuando ya no queda nada en vuelo.
   *  3. LA GENERACIÓN NO ES EL GUARDADO. Los horarios ya existen: si falla el generate, decir
   *     "no se pudo guardar" es mentira y el reintento duplica. Su error va a generateError(),
   *     el mismo signal que usa el botón "Generar clases".
   *
   * Los N POST salen en paralelo con allSettled y no con all: `all` rechaza en el primero y
   * deja a los otros en vuelo sin saber cómo terminaron, que es justo lo que hay que contar.
   * La relectura y la generación también van en paralelo: ver abajo.
   */
  async create(input: ScheduleInput): Promise<CreateScheduleOutcome> {
    this.setLoading(true);
    this.setError(null);
    try {
      // createScheduleDrafts tira SÍNCRONO ante cualquier invariante (FK vacío, ningún día,
      // horas inválidas). Adentro del try para que salga normalizado igual que un fallo de red.
      const drafts = createScheduleDrafts(input);
      const results = await Promise.allSettled(drafts.map((d) => this.repo.create(d)));
      const creados = results.filter((r) => r.status === 'fulfilled').length;
      const fallo = results.find((r) => r.status === 'rejected');

      // La generación ARRANCA ACÁ, antes de esperar la relectura: `GET /schedules` y
      // `POST /schedules/generate-sessions` no dependen entre sí —a la generación le alcanza
      // con que los POST hayan aterrizado— y la generación es la lenta (recorre todas las
      // plantillas del club). Encadenarlas le sumaba un round-trip entero a cada alta, con el
      // modal bloqueado. El rango sale de la VIGENCIA del horario recién creado, acotado por
      // el dominio; null = la vigencia ya terminó y no hay un solo día que generar.
      const rango = fallo
        ? null
        : sessionRangeForSchedule(
            { validFrom: input.validFrom || null, validTo: input.validTo || null },
            localDateKey(new Date()),
          );
      const generacion = rango === null ? Promise.resolve(null) : this.generate(rango);

      // La relectura va ANTES de publicar el error: si entraron tres de cinco, la tabla tiene
      // que mostrarlos. Su propio fallo se traga — la lista vieja es mejor que ninguna, y el
      // error que importa es el del guardado.
      if (creados > 0) {
        try {
          this.setData(await this.repo.list());
        } catch {
          /* la tabla se queda como estaba */
        }
      }

      if (fallo) {
        this.setError(toDomainError(fallo.reason));
        return { creados, generacion: null };
      }
      return { creados, generacion: await generacion };
    } catch (e) {
      this.setError(toDomainError(e));
      return { creados: 0, generacion: null };
    } finally {
      this.setLoading(false);
    }
  }

  update(id: string, input: ScheduleInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createScheduleDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  remove(id: string): Promise<void> {
    return this.run(
      this.repo.remove(id).then(() => this.repo.list()),
      toDomainError,
    );
  }

  /** Se llama al ABRIR el modal: regla 4 de §8.0, un error viejo no puede aparecer en una
   *  apertura nueva. */
  clearGenerateError(): void { this._generateError.set(null); }

  /**
   * Estado propio y no el triple: un fallo al generar no puede borrar ni tapar la lista de
   * horarios, que es lo que haría run() al escribir data() y error().
   *
   * createSessionGenerationDraft tira de forma SÍNCRONA (rango invertido, más de 60 días,
   * fecha inválida). A diferencia de create()/update()/remove() —que delegan a run(), cuyo
   * try/catch vive en OTRO método, y por eso necesitan Promise.resolve().then() para que el
   * throw síncrono llegue convertido en rechazo— acá el try/catch está en la MISMA función
   * que construye el draft, así que una llamada directa ya cae en el catch de abajo sin
   * indirección: no hace falta, y agregarla retrasa un microtask la llamada real al repo,
   * lo que rompe el spec "generating() está en true mientras la request está en vuelo" (el
   * mock reasigna su resolve() de forma síncrona; con la indirección, ese resolve() todavía
   * no existe cuando el test lo invoca, y la promesa queda colgada para siempre). §8.4 lo
   * mostraba con Promise.resolve().then() por copiar el molde de run(); acá no aplica.
   */
  // OJO CON EL ALCANCE: `POST /schedules/generate-sessions` toma sólo {from,to} y recorre
  // TODAS las plantillas activas del club (schedules.service.ts:169). No existe filtro por
  // plantilla. Por eso las cifras que devuelve son DEL CLUB y no del horario recién creado: el
  // copy que las muestre no puede atribuírselas a una fila.
  async generate(input: SessionGenerationInput): Promise<SessionGenerationResult | null> {
    this._generating.set(true);
    this._generateError.set(null);
    try {
      const result = await this.repo.generateSessions(createSessionGenerationDraft(input));
      return result;
    } catch (e) {
      this._generateError.set(toDomainError(e));
      return null;
    } finally {
      this._generating.set(false);
    }
  }
}
