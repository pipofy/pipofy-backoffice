import { Injectable, computed, inject, signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { StudentPlan, studentPlanIsExpired, usableCredits } from '@domain/entities/student-plan';
import { Plan } from '@domain/entities/plan';
import { PlanPurchaseInput, createPlanPurchaseDraft } from '@domain/entities/payment';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { CatalogsRepository } from '@data/repositories/catalogs.repository';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { localDateKey } from '@domain/local-date';

/**
 * Los planes de UN alumno, los del modal. Separada de AlumnosFacade a propósito: SignalStore
 * tiene un solo triad data/loading/error, y meter esto adentro haría que el spinner de la
 * tabla se encienda al abrir el modal, y que un error del modal tape el de la tabla.
 */
@Injectable()
export class AlumnoPlanesFacade extends SignalStore<StudentPlan[], DomainError> {
  private readonly repo = inject(StudentsRepository);
  private readonly plansRepo = inject(PlansRepository);
  private readonly catalogs = inject(CatalogsRepository);

  /** Congelado en cada load(): un computed que llamara new Date() no sería determinista. */
  private readonly _today = signal(localDateKey(new Date()));
  private readonly _plans = signal<readonly Plan[]>([]);

  /** Créditos que el alumno puede usar HOY. Los de planes vencidos NO cuentan. */
  readonly credits = computed(() => usableCredits(this.data() ?? [], this._today()));

  /** planId → nombre. Se rearma sólo cuando cambia el catálogo, no por cada fila y ciclo. */
  private readonly _names = computed(
    () => new Map(this._plans().map((p) => [p.id, p.name] as const)),
  );

  /** El catálogo entero, para el select de "Vender plan". Sólo los planes activos: vender
   *  uno inactivo es un 400 del backend ('planId inválido: ... o está inactivo'). */
  readonly planCatalog = computed(() => this._plans().filter((p) => p.active));

  private readonly _paymentMethods = signal<readonly CatalogItem[]>([]);
  readonly paymentMethods = this._paymentMethods.asReadonly();

  async load(studentId: string): Promise<void> {
    this._today.set(localDateKey(new Date()));
    // Los tres pedidos salen juntos: ni el catálogo de planes ni el de medios de pago deben
    // agregarle su latencia a la tabla, que es lo que se vino a ver.
    void this.loadPlanNames();
    void this.loadPaymentMethods();
    await this.run(this.repo.plans(studentId), toDomainError);
  }

  /**
   * Vender un plan. Devuelve si la VENTA entró — no si todo salió bien.
   *
   * NO usa run() con las dos llamadas encadenadas, a diferencia del resto de las facades, y es
   * a propósito: encadenadas, un fallo de la RELECTURA se publicaba como fallo de la venta. El
   * banner decía "No pudimos conectar" con el formulario todavía cargado, y el segundo click
   * creaba un segundo `student_plan` y un segundo `payment` por una venta que ya había
   * entrado. En una pantalla de plata, "reintentá" tiene que significar que no se cobró.
   *
   * `createPlanPurchaseDraft` tira de forma síncrona con el monto vacío o el plan sin elegir;
   * queda adentro del primer try para que su invariante se normalice igual que un fallo de red.
   *
   * Re-lee `plans()` en vez de parchear la lista: la compra crea el student_plan del lado del
   * backend con sus créditos y su vencimiento calculados, y ninguno se puede adivinar acá.
   */
  async comprar(studentId: string, input: PlanPurchaseInput): Promise<boolean> {
    this.setLoading(true);
    this.setError(null);
    try {
      await this.repo.purchasePlan(studentId, createPlanPurchaseDraft(input));
    } catch (err) {
      this.setError(toDomainError(err));
      this.setLoading(false);
      return false;
    }

    // Acá la venta YA está hecha. Nada de lo que siga puede devolver false: el llamador tiene
    // que limpiar el formulario aunque la relectura falle, o el próximo click cobra de nuevo.
    try {
      this.setData(await this.repo.plans(studentId));
    } catch (err) {
      this.setError(toDomainError(err));
    }
    this.setLoading(false);
    return true;
  }

  clearError(): void {
    this.setError(null);
  }

  /** El precio de lista del plan, para pre-cargar el monto. '' cuando el plan no tiene precio. */
  precioDe(planId: string): string {
    return this._plans().find((p) => p.id === planId)?.price ?? '';
  }

  /**
   * Falla en SILENCIO y el select queda vacío, que es lo que el aviso de abajo del select
   * explica. Un error acá taparía el de la tabla, que es el que importa.
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

  /**
   * `GET /students/:id/plans` devuelve planId, no el nombre. Falla en SILENCIO, misma
   * política que AlumnosFacade.loadCategories(): sin nombres la tabla sigue mostrando
   * créditos y vencimientos, que es lo que se vino a ver.
   *
   * Se pide UNA vez por instancia: la facade es scoped a la ruta de alumnos, así que abrir el
   * modal para diez alumnos seguidos pedía diez veces la misma lista, que no cambia mientras
   * dure la pantalla.
   */
  private async loadPlanNames(): Promise<void> {
    if (this._plans().length > 0) return;
    try {
      this._plans.set(await this.plansRepo.list());
    } catch {
      this._plans.set([]);
    }
  }

  planName(planId: string): string {
    return this._names().get(planId) || `Plan #${planId}`;
  }

  /** Delegado al dominio: la copia local de esta regla no miraba los créditos y lo contradecía. */
  isExpired(plan: StudentPlan): boolean {
    return studentPlanIsExpired(plan, this._today());
  }
}
