import { Provider } from '@angular/core';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { HttpGroupsRepository } from '@data/repositories/http-groups.repository';
import { HttpSchedulesRepository } from '@data/repositories/http-schedules.repository';
import { HttpClassSessionsRepository } from '@data/repositories/http-class-sessions.repository';
import { HttpCategoriesRepository } from '@data/repositories/http-categories.repository';
import { HttpCourtsRepository } from '@data/repositories/http-courts.repository';
import { HttpCoachesRepository } from '@data/repositories/http-coaches.repository';
import { HttpCategoryGroupsRepository } from '@data/repositories/http-category-groups.repository';
import { HttpReservationsRepository } from '@data/repositories/http-reservations.repository';

/**
 * Bindeados en la ruta lazy de la feature, así quedan scoped a ella.
 *
 * Los OCHO van acá, incluidos los cinco que `/reservas` también bindea (`ClassSessionsRepository`,
 * `CourtsRepository`, `CoachesRepository`, `CategoryGroupsRepository` y `ReservationsRepository`): en
 * `app.config.ts` sólo están a root los que el interceptor o el shell necesitan antes de que
 * exista ruta. Mismo argumento que `reservas.providers.ts`: son contratos de DOMINIO, no de otra
 * feature, y dos instancias de un repo SIN ESTADO no cuestan nada.
 *
 * `HttpGroupsRepository` no pega HTTP por sí mismo: compone otros cinco (horarios, clases,
 * canchas, profes y grupos de categoría). Por eso todos tienen que estar resueltos cuando se
 * inyecta. Categorías las usa la facade para ponerles nombre a los ids del roster, y
 * `ReservationsRepository` es para el Quitar de esa misma tabla: sacar a alguien de una clase es
 * cancelar SU reserva.
 */
export const GRUPOS_PROVIDERS: Provider[] = [
  { provide: GroupsRepository, useClass: HttpGroupsRepository },
  { provide: SchedulesRepository, useClass: HttpSchedulesRepository },
  { provide: ClassSessionsRepository, useClass: HttpClassSessionsRepository },
  { provide: CategoriesRepository, useClass: HttpCategoriesRepository },
  { provide: CourtsRepository, useClass: HttpCourtsRepository },
  { provide: CoachesRepository, useClass: HttpCoachesRepository },
  { provide: CategoryGroupsRepository, useClass: HttpCategoryGroupsRepository },
  { provide: ReservationsRepository, useClass: HttpReservationsRepository },
];
