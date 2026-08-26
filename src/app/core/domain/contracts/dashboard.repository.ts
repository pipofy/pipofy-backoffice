import { DashboardSnapshot } from '../entities/dashboard-snapshot';

// abstract class = token DI + tipo + contrato, en TS puro.
export abstract class DashboardRepository {
  /**
   * `clubId` NO viaja a la API: todos los endpoints lo resuelven del JWT. La firma lo conserva
   * porque lo fija `RefreshDashboard.execute()`, que primero valida el club llamando a
   * `ClubRepository.isActive(clubId)` y recién después pide el snapshot — pero esa validación
   * tampoco usa el argumento: `HttpClubRepository.isActive(_clubId)` lo ignora a propósito y
   * pega a `GET /clubs/me` (ver su propio docblock). El valor SÍ llega hasta acá y hasta
   * `dashboard.mapper.ts`, que lo escribe en `snapshot.clubId` — pero ningún template ni
   * use-case lee ese campo. En síntesis: el parámetro se hila de punta a punta, pero hoy no lo
   * consume nadie. Misma divergencia que documenta CourtsRepository.
   */
  abstract getSnapshot(clubId: string): Promise<DashboardSnapshot>;
}
