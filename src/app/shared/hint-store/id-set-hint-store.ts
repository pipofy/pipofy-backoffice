type Snapshot = Record<string, string[]>;

/**
 * Qué ids tiene asignados cada dueño, SEGÚN ESTE NAVEGADOR.
 *
 * No es un cache de la API: es una pista. Hay endpoints que ESCRIBEN una asignación y ningún
 * GET que la devuelva —los items de un grupo de categoría, las categorías de un plan—, así que
 * sin esto los modales no tendrían nada que mostrar. Puede estar desactualizada (otro
 * navegador, otro usuario, una carga por SQL) y los modales lo dicen al pie; los repositorios
 * la corrigen solos tratando el 409 y el 404 como éxito.
 *
 * `localStorage` y no `sessionStorage`: la asignación se carga una vez y tiene que seguir ahí
 * la semana que viene.
 *
 * Todo va envuelto en try/catch porque el storage puede estar lleno, bloqueado por el navegador
 * o sucio de una versión anterior, y ninguna de las tres justifica tumbar la pantalla.
 *
 * NO es @Injectable: la clase concreta de cada feature lo es. Sin `@angular/core` acá, esto
 * sigue siendo `shared` puro y no arrastra nada a las features que lo extienden.
 */
export abstract class IdSetHintStore {
  /** Clave de localStorage. Versionada: un cambio de formato estrena clave en vez de migrar. */
  protected abstract readonly key: string;

  read(ownerId: string): string[] {
    return this.all()[ownerId] ?? [];
  }

  write(ownerId: string, ids: readonly string[]): void {
    this.persist({ ...this.all(), [ownerId]: [...ids] });
  }

  forget(ownerId: string): void {
    const next = this.all();
    delete next[ownerId];
    this.persist(next);
  }

  private all(): Snapshot {
    try {
      const raw = localStorage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? (parsed as Snapshot) : {};
    } catch {
      return {};
    }
  }

  private persist(snapshot: Snapshot): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(snapshot));
    } catch {
      /* storage lleno o bloqueado: la pista se pierde, el modal sigue funcionando */
    }
  }
}
