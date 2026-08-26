import { HttpErrorResponse } from '@angular/common/http';
import { toDomainError } from './to-domain-error';

/**
 * Traga UN código HTTP y normaliza el resto. Es el mecanismo de las escrituras IDEMPOTENTES
 * POR CONTRATO: los items de un grupo de categoría y las categorías de un plan.
 *
 * En los dos casos el backend responde 409 al agregar algo que ya estaba y 404 al quitar algo
 * que no estaba, y en los dos el estado final es el que se pidió — así que es éxito, no error.
 * Que "ya estaba" y "no estaba" cuenten como éxito es lo que hace que la pista guardada en el
 * navegador se corrija sola con cada click, en vez de quedar mintiendo para siempre (ver
 * `IdSetHintStore`).
 *
 * Vive acá y no en cada repositorio porque la regla estaba escrita CUATRO veces en dos
 * archivos: si el backend cambiara el código de uno de los dos endpoints, se arreglaba donde se
 * notó y el hermano quedaba roto en silencio.
 *
 * Recibe la promesa ya armada en vez de la URL: quien llama necesita `HttpClient` directo —
 * `ApiClient` normaliza en su `catchError` y ahí un 409 y un 400 llegan indistinguibles— y
 * ese detalle es del repositorio, no de este helper.
 */
export async function ignoringStatus(status: number, work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (err) {
    if (err instanceof HttpErrorResponse && err.status === status) return;
    throw toDomainError(err);
  }
}
