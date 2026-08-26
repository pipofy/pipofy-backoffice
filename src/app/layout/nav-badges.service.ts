import { Injectable, signal } from '@angular/core';
import type { BadgeKey } from './nav.model';

/**
 * En cero a propósito: no hay fuente. Los contadores anteriores (6 alertas, 3 pagos) eran
 * constantes inventadas, y un badge con un número invita a hacerle caso.
 *
 * ponytail: la estructura se queda para que el día que haya fuente vuelva el contador sin
 * rehacer el markup. Salida: un endpoint de alertas del dashboard y otro de pagos pendientes
 * (hoy no existe ningún controlador de pagos en el backend).
 */
@Injectable()
export class NavBadgesService {
  readonly counts = signal<Record<BadgeKey, number>>({ alerts: 0, payments: 0 });
}
