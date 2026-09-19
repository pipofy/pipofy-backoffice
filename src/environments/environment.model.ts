/**
 * Lo que set-env.mjs emite desde las NG_* del `.env.<ambiente>`. Una clave nueva se declara
 * acá (opcional salvo que la app no arranque sin ella) y en .env.example.
 */
export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  /** Sin consumidor todavía (SseRealtimeConnection). */
  realtimeBaseUrl?: string;
}
