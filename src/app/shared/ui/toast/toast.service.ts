import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

export type ToastType = 'ok' | 'info';

export interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly title: string;
  readonly desc: string;
  /** true → el host aplica `.out` y corre @keyframes slideout. Ver el cierre en 2 fases. */
  readonly leaving: boolean;
}

/** Fuente: docs/maquetas/index-v2.html:1435 — `.out` a los 3600ms, remoción 300ms después. */
const VISIBLE_MS = 3600;
const LEAVING_MS = 300;

/**
 * ponytail: sólo dos variantes ('ok' | 'info'), que son las que define el CSS. Los
 * errores de dominio usan 'info' + domainErrorMessage(). Si algún día hace falta
 * rojo, se agrega al CSS Y a la unión — el compilador obliga a las dos cosas.
 *
 * providedIn:'root' = mismo patrón que TenantContext (infra de UI compartida).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts: Signal<readonly Toast[]> = this._toasts.asReadonly();

  private nextId = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const t of this.timers) clearTimeout(t);
      this.timers.clear();
    });
  }

  show(type: ToastType, title: string, desc: string): void {
    const id = this.nextId++;
    this._toasts.update((ts) => [...ts, { id, type, title, desc, leaving: false }]);
    this.later(() => this.dismiss(id), VISIBLE_MS);
  }

  /**
   * CIERRE EN DOS FASES, y no es un capricho: si esto hiciera un splice directo del
   * signal, el @for retiraría el nodo al instante y `.toast.out` / @keyframes slideout
   * quedarían como CSS muerto — los toasts desaparecerían de golpe.
   *   1. marca leaving → el host aplica `.out` → corre slideout (130ms)
   *   2. 300ms después → se remueve del array
   */
  dismiss(id: number): void {
    const t = this._toasts().find((x) => x.id === id);
    if (!t || t.leaving) return;   // idempotente: no re-encola una segunda remoción
    this._toasts.update((ts) => ts.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    this.later(() => this._toasts.update((ts) => ts.filter((x) => x.id !== id)), LEAVING_MS);
  }

  /** setTimeout con limpieza en DestroyRef (mismo patrón que el reloj del shell). */
  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }
}
