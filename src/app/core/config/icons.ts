import { InjectionToken } from '@angular/core';

/**
 * nombre → markup `<svg …>…</svg>` completo. Es una constante del repo (product/icons.ts),
 * nunca entrada de usuario: por eso IconComponent puede inyectarlo con bypassSecurityTrustHtml.
 */
export type IconRegistry = Readonly<Record<string, string>>;

export const ICONS = new InjectionToken<IconRegistry>('ICONS', {
  providedIn: 'root',
  factory: () => ({}),
});
