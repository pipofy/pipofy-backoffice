import { Injectable, inject } from '@angular/core';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { SchedulesRepository } from '@domain/contracts/schedules.repository';
import { ClassSessionsRepository } from '@domain/contracts/class-sessions.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { Group } from '@domain/entities/group';
import { localDateKey, shiftDateKey } from '@domain/local-date';
import { toGroups } from '@domain/derive-groups';
import { toDomainError } from '../http/to-domain-error';

/**
 * ponytail: la ventana de sesiones es FIJA. `GET /class-sessions` exige from/to y no acepta
 * filtro por plantilla, así que se pide un rango y se agrupa en el cliente. Techo: un grupo en
 * receso de más de un mes se muestra sin sesiones. Salida: `?scheduleTemplateId=` del lado del
 * backend, y la ventana desaparece. Ver el spec §3.2.
 */
const VENTANA_DIAS = 28;

/**
 * No hay endpoint de grupos: este repositorio COMPONE la lista desde cinco llamadas en paralelo,
 * todas reusando repositorios que ya existen con su mapper y sus tests. Mismo patrón —y mismo
 * archivo de referencia— que `HttpDashboardRepository`.
 *
 * Si cualquiera de las cinco falla, falla la lista entera: media pantalla de grupos, con los
 * nombres de cancha en guión, es peor que un mensaje de error.
 *
 * Una sola llamada de sesiones cubre TODOS los grupos: se pide el rango una vez y el mapper lo
 * reparte por `scheduleTemplateId`. Por eso la lista son cinco requests y no cinco más una por
 * grupo.
 */
// `extends` y no `implements`, igual que el resto de los repos HTTP: así la clase satisface el
// token DI por sí sola.
@Injectable()
export class HttpGroupsRepository extends GroupsRepository {
  private readonly schedules = inject(SchedulesRepository);
  private readonly classSessions = inject(ClassSessionsRepository);
  private readonly courts = inject(CourtsRepository);
  private readonly coaches = inject(CoachesRepository);
  private readonly categoryGroups = inject(CategoryGroupsRepository);

  async listGroups(): Promise<Group[]> {
    try {
      // UN solo `now` para toda la derivación: la ventana, la próxima sesión y el `yaPaso` de
      // cada fila miran el mismo reloj.
      const now = new Date();
      const hoy = localDateKey(now);

      const [schedules, sessions, courts, coaches, categoryGroups] = await Promise.all([
        this.schedules.list(),
        this.classSessions.listRange(
          shiftDateKey(hoy, -VENTANA_DIAS),
          shiftDateKey(hoy, VENTANA_DIAS),
        ),
        this.courts.list(),
        this.coaches.list(),
        this.categoryGroups.list(),
      ]);

      return toGroups({ schedules, sessions, courts, coaches, categoryGroups }, now);
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
