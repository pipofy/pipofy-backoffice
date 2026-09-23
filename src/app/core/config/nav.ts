import { InjectionToken } from '@angular/core';

export type BadgeKey = 'alerts' | 'payments';

/** Sub-destino de la sidebar. Sin icono ni badge: es una lista de texto indentada. */
export interface NavChild {
  readonly label: string;
  readonly path: string; // ruta absoluta
}

export interface NavItem {
  readonly label: string; // etiqueta en la sidebar
  readonly short: string; // etiqueta en la tab-bar móvil
  readonly path: string; // ruta absoluta
  readonly group: string; // uno de NavConfig.groups
  readonly icon: string; // clave del registro ICONS
  readonly badge?: BadgeKey;
  /** Con hijos, el item NO navega: despliega. La tab-bar móvil los ignora y linkea a `path`. */
  readonly children?: readonly NavChild[];
}

export interface NavConfig {
  readonly groups: readonly string[];
  readonly items: readonly NavItem[];
}

export const NAV_CONFIG = new InjectionToken<NavConfig>('NAV_CONFIG', {
  providedIn: 'root',
  factory: () => ({ groups: [], items: [] }),
});
