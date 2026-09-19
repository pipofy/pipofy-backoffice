import { LOCALE_ID, Provider } from '@angular/core';
import { API_CONFIG } from '@config/api-config';
import { APP_CONFIG } from '@config/app-config';
import { ICONS } from '@config/icons';
import { NAV_CONFIG } from '@config/nav';
import { environment } from '../../environments/environment';
import type { Environment } from '../../environments/environment.model';
import { PIPOFY_CONFIG } from './app-config';
import { PIPOFY_ICONS } from './icons';
import { PIPOFY_NAV } from './nav';

// El generado sólo trae las claves NG_* que estaban presentes (ver set-env.mjs), así que su
// tipo inferido por `satisfies` puede no tener `realtimeBaseUrl` aunque el modelo la declare
// opcional. La reafirmamos acá para leerla sin romper el build cuando falta (p. ej. producción).
const env: Environment = environment;

/** Lo único que app.config.ts sabe del producto. */
export const PRODUCT_PROVIDERS: Provider[] = [
  { provide: APP_CONFIG, useValue: PIPOFY_CONFIG },
  { provide: LOCALE_ID, useValue: PIPOFY_CONFIG.locale },
  {
    provide: API_CONFIG,
    useValue: { apiBaseUrl: env.apiBaseUrl, realtimeBaseUrl: env.realtimeBaseUrl },
  },
  { provide: NAV_CONFIG, useValue: PIPOFY_NAV },
  { provide: ICONS, useValue: PIPOFY_ICONS },
];
