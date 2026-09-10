import { Group } from '../entities/group';

/**
 * Los grupos del club. UN solo método, y no es minimalismo: es lo único que no existe ya.
 *
 * El roster, la lista de espera y la escritura de asistencia salen de `ClassSessionsRepository`,
 * que ya tiene `reservations()`, `waitingList()` y `markAttendance()` con su DTO, su mapper y sus
 * tests. Envolverlos acá sería una capa que sólo reenvía.
 *
 * Sin `clubId`: lo pone `tenantInterceptor` con X-Tenant-Id. Lo recibía sólo porque el
 * repositorio en memoria tenía que elegir qué semilla devolver.
 *
 * Clase abstracta a propósito: hace de token DI sin arrastrar @angular/core al dominio.
 */
export abstract class GroupsRepository {
  abstract listGroups(): Promise<Group[]>;
}
