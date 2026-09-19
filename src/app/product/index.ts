import { Provider } from '@angular/core';
import { API_CONFIG } from '@config/api-config';
import { APP_CONFIG } from '@config/app-config';
import { ICONS } from '@config/icons';
import { NAV_CONFIG } from '@config/nav';
import { environment } from '../../environments/environment';
import { PIPOFY_CONFIG } from './app-config';
import { PIPOFY_ICONS } from './icons';
import { PIPOFY_NAV } from './nav';

/** Lo único que app.config.ts sabe del producto. */
export const PRODUCT_PROVIDERS: Provider[] = [
  { provide: APP_CONFIG, useValue: PIPOFY_CONFIG },
  {
    provide: API_CONFIG,
    useValue: { apiBaseUrl: environment.apiBaseUrl, realtimeBaseUrl: environment.realtimeBaseUrl },
  },
  { provide: NAV_CONFIG, useValue: PIPOFY_NAV },
  { provide: ICONS, useValue: PIPOFY_ICONS },
];
