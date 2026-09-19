import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { PRODUCT_PROVIDERS } from './product';
import { tenantInterceptor } from './shared/http/tenant.interceptor';
import { errorLogInterceptor } from './shared/http/error-log.interceptor';
import { authInterceptor } from './core/data/http/auth.interceptor';
import { TokenRefresher } from './core/data/http/token-refresher';
import { SessionStore } from './core/data/auth/session-store';
import { SessionFacade } from '@features/auth/session.facade';
import { ClubRepository } from '@domain/contracts/club.repository';
import { AuthRepository } from '@domain/contracts/auth.repository';
import { HttpAuthRepository } from '@data/repositories/http-auth.repository';
import { HttpClubRepository } from '@data/repositories/http-club.repository';
import { CatalogsRepository } from '@domain/contracts/catalogs.repository';
import { HttpCatalogsRepository } from '@data/repositories/http-catalogs.repository';
import { UsersRepository } from '@domain/contracts/users.repository';
import { HttpUsersRepository } from '@data/repositories/http-users.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorLogInterceptor])),
    // Marca, locale, nav, iconos y red del producto. Es el ÚNICO lugar que importa product/.
    ...PRODUCT_PROVIDERS,
    // Auth va en ROOT y no en la ruta lazy de la feature (rompiendo la convención del resto
    // del proyecto a propósito): el interceptor puede necesitar refrescar en CUALQUIER
    // request y el guard corre antes de que exista ninguna ruta lazy.
    SessionStore,
    SessionFacade,
    TokenRefresher,
    { provide: AuthRepository, useClass: HttpAuthRepository },
    // En ROOT y no en una ruta lazy, igual que AuthRepository: lo necesitan DOS rutas lazy
    // distintas — el dashboard (vía RefreshDashboard) y Configuración → Club.
    { provide: ClubRepository, useClass: HttpClubRepository },
    // Mismo motivo que ClubRepository: lo necesitan DOS rutas lazy distintas — Configuración
    // y el dashboard. Bindeado en cada ruta, cada una recibía su propio cache.
    { provide: CatalogsRepository, useClass: HttpCatalogsRepository },
    // En ROOT porque su único consumidor es ShellComponent, que vive en `layout/` y no
    // cuelga de ninguna ruta lazy.
    { provide: UsersRepository, useClass: HttpUsersRepository },
  ],
};
