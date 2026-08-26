import { signal } from '@angular/core';

// ponytail: base class = coupling by inheritance. Known ceiling — if this grows
// special-cases (if (this.isPaginated)...), split to composition. Keep it to what
// is identical in EVERY feature: the data/loading/error triad + run + reset.
// Error type is a generic (E) so shared/ stays domain-agnostic per the layer boundary:
// feature facades specialize E to their domain error type (e.g. DomainError).
export abstract class SignalStore<T, E = unknown> {
  private readonly _data = signal<T | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<E | null>(null);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  protected setData(v: T | null) { this._data.set(v); }
  protected setError(e: E | null) { this._error.set(e); }
  // Para los flujos que NO caben en run(): una escritura cuyo fallo posterior no debe
  // reportarse como fallo de la escritura (ver AlumnoPlanesFacade.comprar).
  protected setLoading(v: boolean) { this._loading.set(v); }

  protected async run(promise: Promise<T>, mapError: (e: unknown) => E = (e) => e as E): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      this._data.set(await promise);
    } catch (e) {
      this._error.set(mapError(e));
    } finally {
      this._loading.set(false);
    }
  }

  reset(): void {
    this._data.set(null);
    this._loading.set(false);
    this._error.set(null);
  }
}
