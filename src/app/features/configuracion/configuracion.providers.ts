import { Provider } from '@angular/core';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { PlansRepository } from '@domain/contracts/plans.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { HttpCourtsRepository } from '@data/repositories/http-courts.repository';
import { HttpCategoriesRepository } from '@data/repositories/http-categories.repository';
import { HttpCategoryGroupsRepository } from '@data/repositories/http-category-groups.repository';
import { HttpPlansRepository } from '@data/repositories/http-plans.repository';
import { HttpCoachesRepository } from '@data/repositories/http-coaches.repository';
import { HttpSchedulesRepository } from '@data/repositories/http-schedules.repository';

export const CONFIGURACION_PROVIDERS: Provider[] = [
  { provide: CourtsRepository, useClass: HttpCourtsRepository },
  { provide: CategoriesRepository, useClass: HttpCategoriesRepository },
  { provide: CategoryGroupsRepository, useClass: HttpCategoryGroupsRepository },
  { provide: PlansRepository, useClass: HttpPlansRepository },
  { provide: CoachesRepository, useClass: HttpCoachesRepository },
  { provide: SchedulesRepository, useClass: HttpSchedulesRepository },
];
