import { Routes } from '@angular/router';
import { __Feature__Facade } from './__feature__.facade';
import { __FEATURE___PROVIDERS } from './__feature__.providers';

export const __FEATURE___ROUTES: Routes = [
  {
    path: '',
    providers: [__Feature__Facade, ...__FEATURE___PROVIDERS],
    loadComponent: () =>
      import('./pages/__feature__-page.component').then((m) => m.__Feature__PageComponent),
  },
];
