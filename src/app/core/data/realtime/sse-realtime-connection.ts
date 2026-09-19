import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RealtimeConnection } from './realtime-connection';
import { API_CONFIG } from '@config/api-config';

@Injectable()
export class SseRealtimeConnection extends RealtimeConnection {
  private readonly realtimeBaseUrl = inject(API_CONFIG).realtimeBaseUrl ?? '';

  topic<T>(name: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      let consecutiveFailures = 0;
      // ponytail: EventSource can't send auth headers and bypasses HttpClient, so the
      // tenant interceptor does NOT apply here. Multitenant auth must ride the URL
      // (query-param token/tenant) or a same-site cookie. Decide when the streaming
      // backend exists; for now only the base URL is configurable.
      const source = new EventSource(`${this.realtimeBaseUrl}?topic=${encodeURIComponent(name)}`);
      source.onmessage = (e) => {
        consecutiveFailures = 0;
        subscriber.next(JSON.parse(e.data) as T);
      };
      source.onerror = () => {
        // ponytail: flat give-up threshold. Upgrade path: exponential backoff + jitter,
        // and emit a typed {kind:'network'} once RealtimeConnection may depend on domain errors.
        if (++consecutiveFailures >= 5) {
          source.close();
          subscriber.error(new Error(`realtime connection lost for topic ${name}`));
        }
      };
      return () => source.close();
    });
  }
}
