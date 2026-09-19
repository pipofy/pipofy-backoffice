import { InjectionToken } from '@angular/core';

export interface AppBrand {
  /** Nombre comercial: título por defecto, alt del logo, copy ("Ya podés entrar a X"). */
  readonly name: string;
  /** Una línea de descripción, la usa el pie. '' = no se muestra. */
  readonly tagline: string;
  /** Ruta pública del lockup horizontal, relativa a `public/` (p. ej. 'brand/logo-horizontal.svg'). */
  readonly logoHorizontal: string;
  /** Links del pie. `href: null` = todavía no existe la página; se renderiza sin destino. */
  readonly footerLinks: readonly { readonly label: string; readonly href: string | null }[];
}

export interface AppConfig {
  readonly brand: AppBrand;
  /** BCP 47. Se provee además como LOCALE_ID de Angular. */
  readonly locale: string;
  /** Prefijo de TODA clave de storage: `${storagePrefix}:<nombre>:v<N>` (ver storageKey). */
  readonly storagePrefix: string;
  /** Rol crudo del JWT → etiqueta. Un rol que no está acá se muestra crudo. */
  readonly roleLabels: Readonly<Record<string, string>>;
}

/**
 * Valores neutros del kernel. El producto los reemplaza en PRODUCT_PROVIDERS (product/index.ts);
 * los specs no proveen nada y corren con estos. `locale` es es-AR porque el copy del kernel
 * (errores, placeholders) ya está en ese español: el kernel no es agnóstico de idioma.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  brand: { name: 'App', tagline: '', logoHorizontal: '', footerLinks: [] },
  locale: 'es-AR',
  storagePrefix: 'app',
  roleLabels: {},
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_CONFIG,
});

/** Clave de storage versionada. Un cambio de formato estrena versión en vez de migrar. */
export function storageKey(config: AppConfig, name: string, version: number): string {
  return `${config.storagePrefix}:${name}:v${version}`;
}
