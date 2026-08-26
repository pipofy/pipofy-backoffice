import { Student, StudentDraft } from '../entities/student';
import { StudentPlan } from '../entities/student-plan';
import { PlanPurchaseDraft } from '../entities/payment';

/** Ver CategoryGroupsRepository por qué es una clase abstracta y por qué no lleva clubId. */
export abstract class StudentsRepository {
  abstract list(): Promise<Student[]>;
  abstract create(draft: StudentDraft): Promise<void>;
  abstract update(id: string, draft: StudentDraft): Promise<void>;
  abstract remove(id: string): Promise<void>;

  /**
   * Los planes comprados por UN alumno. Vive acá y no en un StudentPlansRepository propio
   * porque el endpoint es `/students/:id/plans` y un contrato nuevo sólo agregaría un
   * binding más a alumnos.providers.ts.
   */
  abstract plans(studentId: string): Promise<StudentPlan[]>;

  /**
   * Vender un plan: `POST /students/:id/plans`. Del otro lado es UNA transacción que crea el
   * `student_plan` con sus créditos Y el `payment` ya confirmado, así que no hay estado
   * intermedio que reconciliar si falla a mitad.
   *
   * Devuelve void como todas las escrituras: la facade re-lee `plans(studentId)`.
   *
   * El `paymentMethodId` sale de `CatalogsRepository.paymentMethods()`, que pega a
   * `GET /catalogs/payment-methods`. Si ese endpoint falla, el select queda vacío y la venta no
   * se puede armar — a propósito: vender con un id inventado es peor que no vender.
   */
  abstract purchasePlan(studentId: string, draft: PlanPurchaseDraft): Promise<void>;
}
