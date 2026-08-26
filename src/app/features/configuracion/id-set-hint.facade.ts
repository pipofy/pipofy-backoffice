import { signal } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { IdSetHintStore } from '@shared/hint-store/id-set-hint-store';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';

/**
 * Asignar y desasignar ids a un dueño, cuando el backend acepta la escritura pero ningún GET
 * devuelve el resultado: los items de un grupo de categoría y las categorías de un plan.
 *
 * `data` es la selección visible. NO viene de la API — sale de la pista del navegador
 * (`IdSetHintStore`) y se corrige con cada escritura.
 *
 * Vive en `features/configuracion/` y no en `shared/` porque `toggle()` necesita
 * `toDomainError`, que es de `data`, y `shared` sólo puede importar `shared`. Las dos
 * pantallas que la extienden son tabs de la MISMA feature (`boundaries` captura
 * `src/app/features/*`, un solo nivel), así que el import entre hermanas es interno y legal.
 *
 * Cada facade concreta se separa de la de su tabla a propósito: `SignalStore` tiene una sola
 * tríada data/loading/error, y con una sola facade tildar una checkbox prendería el spinner de
 * la tabla de atrás.
 */
export abstract class IdSetHintFacade extends SignalStore<string[], DomainError> {
  /** La pista de ESTE slice. La subclase la inyecta; la clave la fija el store. */
  protected abstract readonly store: IdSetHintStore;

  /** IDEMPOTENTES POR CONTRATO: no fallan si ya estaba / si no estaba. De eso depende que la
   *  pista se corrija sola en vez de quedar mintiendo para siempre. */
  protected abstract add(ownerId: string, id: string): Promise<void>;
  protected abstract remove(ownerId: string, id: string): Promise<void>;

  private readonly _ownerId = signal<string | null>(null);

  selected(): readonly string[] {
    return this.data() ?? [];
  }

  open(ownerId: string): void {
    this._ownerId.set(ownerId);
    this.setError(null);
    this.setData(this.store.read(ownerId));
  }

  clearError(): void {
    this.setError(null);
  }

  /**
   * Optimista con rollback: la checkbox se pinta antes de salir a la red y vuelve atrás si la
   * API rechaza. Un 409 o un 404 —la pista estaba desactualizada— llegan acá como éxito
   * (ver `ignoringStatus`) y la vista termina en la verdad.
   *
   * No usa run(): run() reemplaza `data` con lo que resuelve la promesa, y acá el valor nuevo
   * se conoce ANTES de la escritura. Lo que sí se replica es su contrato: nunca rechaza, el
   * fallo queda en error().
   */
  async toggle(id: string, next: boolean): Promise<void> {
    const ownerId = this._ownerId();
    if (ownerId === null) return;

    const before = this.selected();
    const after = next ? [...before, id] : before.filter((x) => x !== id);

    this.setError(null);
    this.setData([...after]);
    try {
      await (next ? this.add(ownerId, id) : this.remove(ownerId, id));
      this.store.write(ownerId, after);
    } catch (err) {
      this.setData([...before]);
      this.setError(toDomainError(err));
    }
  }
}
