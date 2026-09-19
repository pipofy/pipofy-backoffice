import { LOCALE_ID, Provider } from '@angular/core';
import { API_CONFIG } from '@config/api-config';
import { APP_CONFIG } from '@config/app-config';
import { environment } from '../../environments/environment';
import { PIPOFY_CONFIG } from './app-config';

/** Lo único que app.config.ts sabe del producto. */
export const PRODUCT_PROVIDERS: Provider[] = [
  { provide: APP_CONFIG, useValue: PIPOFY_CONFIG },
  { provide: LOCALE_ID, useValue: PIPOFY_CONFIG.locale },
  {
    provide: API_CONFIG,
    useValue: { apiBaseUrl: environment.apiBaseUrl, realtimeBaseUrl: environment.realtimeBaseUrl },
  },
];
