import { Routes } from '@angular/router';
import { CONFIGURACION_PROVIDERS } from './configuracion.providers';
import { ClubFacade } from './club/club.facade';
import { clubCanDeactivate } from './club/club-can-deactivate.guard';
import { CanchasFacade } from './canchas/canchas.facade';
import { CategoriasFacade } from './categorias/categorias.facade';
import { GruposCategoriaFacade } from './grupos-categoria/grupos-categoria.facade';
import { GrupoItemsFacade } from './grupos-categoria/grupo-items.facade';
import { GrupoItemsStore } from './grupos-categoria/grupo-items-store';
import { PlanesFacade } from './planes/planes.facade';
import { PlanCategoriasFacade } from './planes/plan-categorias.facade';
import { PlanCategoriasStore } from './planes/plan-categorias-store';
import { ProfesoresFacade } from './profesores/profesores.facade';
import { HorariosFacade } from './horarios/horarios.facade';

/**
 * Las facades van en la ruta PADRE para que las listas sobrevivan al cambio de tab: ir a
 * Categorías y volver a Canchas no vuelve a pedir nada. `CatalogsRepository` NO está acá —
 * vive en root (app.config.ts) porque también lo usa el dashboard, y una instancia por ruta
 * significaba un cache por ruta.
 */
export const CONFIGURACION_ROUTES: Routes = [
  {
    path: '',
    providers: [
      ClubFacade,
      CanchasFacade,
      CategoriasFacade,
      GruposCategoriaFacade,
      GrupoItemsFacade,
      GrupoItemsStore,
      PlanesFacade,
      PlanCategoriasFacade,
      PlanCategoriasStore,
      ProfesoresFacade,
      HorariosFacade,
      ...CONFIGURACION_PROVIDERS,
    ],
    loadComponent: () =>
      import('./pages/configuracion-page.component').then((m) => m.ConfiguracionPageComponent),
    children: [
      {
        path: 'club',
        canDeactivate: [clubCanDeactivate],
        loadComponent: () =>
          import('./club/club-page.component').then((m) => m.ClubPageComponent),
      },
      {
        path: 'canchas',
        loadComponent: () =>
          import('./canchas/canchas-page.component').then((m) => m.CanchasPageComponent),
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./categorias/categorias-page.component').then((m) => m.CategoriasPageComponent),
      },
      {
        path: 'grupos-categoria',
        loadComponent: () =>
          import('./grupos-categoria/grupos-categoria-page.component')
            .then((m) => m.GruposCategoriaPageComponent),
      },
      {
        path: 'planes',
        loadComponent: () =>
          import('./planes/planes-page.component').then((m) => m.PlanesPageComponent),
      },
      {
        path: 'profesores',
        loadComponent: () =>
          import('./profesores/profesores-page.component').then((m) => m.ProfesoresPageComponent),
      },
      {
        path: 'horarios',
        loadComponent: () =>
          import('./horarios/horarios-page.component').then((m) => m.HorariosPageComponent),
      },
      { path: '', redirectTo: 'club', pathMatch: 'full' },
    ],
  },
];
