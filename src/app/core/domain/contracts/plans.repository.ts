import { Plan, PlanDraft } from '../entities/plan';

/** Ver CategoryGroupsRepository por qué es una clase abstracta y por qué no lleva clubId. */
export abstract class PlansRepository {
  abstract list(): Promise<Plan[]>;
  abstract create(draft: PlanDraft): Promise<void>;
  abstract update(id: string, draft: PlanDraft): Promise<void>;
  abstract remove(id: string): Promise<void>;

  /**
   * IDEMPOTENTES POR CONTRATO, igual que los items de `CategoryGroupsRepository`: `addCategory`
   * no falla si la categoría ya estaba y `removeCategory` no falla si no estaba. En los dos
   * casos el estado final es el que se pidió.
   *
   * No es cosmético. Ningún GET del backend devuelve las categorías de un plan
   * (`PlansService.list()` y `getOne()` son findMany/findUnique pelados), así que la pantalla no
   * puede leer la asignación y trabaja con una pista guardada en el navegador. Que "ya estaba" y
   * "no estaba" cuenten como éxito es lo que hace que esa pista se corrija sola con cada click
   * en vez de quedar mintiendo para siempre.
   *
   * Desde `bfe503c` esto NO es un lujo: `StudentPlansService.purchase()` rechaza con
   * 400 'El plan no tiene categorías asociadas' la venta de un plan sin ninguna, así que sin
   * esta pantalla no se puede vender nada.
   *
   * ponytail: el navegador es la única fuente de verdad de la asignación. Techo real: dos
   * encargados editando el mismo plan desde dos navegadores divergen sin que nadie se entere.
   * Salida: `include: { categories: true }` en el `list()`/`getOne()` de plans del backend.
   */
  abstract addCategory(planId: string, categoryId: string): Promise<void>;
  abstract removeCategory(planId: string, categoryId: string): Promise<void>;
}
