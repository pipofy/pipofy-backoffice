import { Injectable, inject } from '@angular/core';
import { DashboardRepository } from '@domain/contracts/dashboard.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { DashboardSnapshot } from '@domain/entities/dashboard-snapshot';
import { localDateKey } from '@domain/local-date';
import { toDashboardSnapshot } from '../mappers/dashboard.mapper';
import { toDomainError } from '../http/to-domain-error';
import { CatalogsRepository } from './catalogs.repository';

/**
 * No hay endpoint agregador: este repositorio COMPONE el snapshot desde cinco llamadas en
 * paralelo, cuatro de ellas reusando repositorios que ya existen con su mapper y sus tests.
 *
 * Si cualquiera de las cinco falla, falla el snapshot entero: un dashboard con la grilla a
 * medias es peor que un mensaje de error.
 *
 * La lista de espera NO es una sexta llamada: `GET /class-sessions` ya trae `waitingCount`
 * por sesión (dos groupBy del lado del backend), así que viaja con la grilla.
 */
// `extends` y no `implements`, igual que el resto de los repos HTTP: así la clase satisface
// el token DI por sí sola y no depende de que el provider lo deletree con `useClass`.
@Injectable()
export class HttpDashboardRepository extends DashboardRepository {
  private readonly courts = inject(CourtsRepository);
  private readonly coaches = inject(CoachesRepository);
  private readonly categoryGroups = inject(CategoryGroupsRepository);
  private readonly catalogs = inject(CatalogsRepository);
  private readonly classSessions = inject(ClassSessionsRepository);

  async getSnapshot(clubId: string): Promise<DashboardSnapshot> {
    try {
      const todayKey = localDateKey(new Date());
      const [courts, coaches, categoryGroups, surfaceTypes, sessions] = await Promise.all([
        this.courts.list(),
        this.coaches.list(),
        this.categoryGroups.list(),
        this.catalogs.surfaceTypes(),
        this.classSessions.list(todayKey),
      ]);
      return toDashboardSnapshot({
        clubId,
        courts,
        coaches,
        categoryGroups,
        surfaceTypes,
        sessions,
      });
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
