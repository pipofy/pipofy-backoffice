import { InjectionToken } from '@angular/core';

/** Red por ambiente. Sale de `environment.*.ts` (generado por set-env.mjs) vía product/index.ts. */
export interface ApiConfig {
  readonly apiBaseUrl: string;
  /** Opcional: SseRealtimeConnection no tiene consumidor todavía. */
  readonly realtimeBaseUrl?: string;
}

/** Sin default: una app sin URL de API no puede hacer nada útil, mejor que falle al inyectar. */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
