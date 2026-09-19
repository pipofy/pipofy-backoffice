import { Provider } from '@angular/core';
import { __Entities__Repository } from '@domain/contracts/__entities__.repository';
import { Http__Entities__Repository } from '@data/repositories/http-__entities__.repository';

/** El ÚNICO archivo de la feature que importa @data: bindea contrato → implementación. */
export const __FEATURE___PROVIDERS: Provider[] = [
  { provide: __Entities__Repository, useClass: Http__Entities__Repository },
];
