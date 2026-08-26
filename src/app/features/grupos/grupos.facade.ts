import { Injectable, computed, effect, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { GroupsSnapshot, SaveAttendanceRequest } from '@domain/entities/group';
import { TenantContext } from '@shared/tenant/tenant-context';
import { DomainError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';

@Injectable()
export class GruposFacade extends SignalStore<GroupsSnapshot, DomainError> {
  private readonly repo = inject(GroupsRepository);
  private readonly tenant = inject(TenantContext, { optional: true });

  /** Atajo para los templates: [] mientras no haya snapshot. */
  readonly groups = computed(() => this.data()?.groups ?? []);

  constructor() {
    super();
    // Aislamiento de tenant: limpia el estado cuando el tenant CAMBIA. El flag saltea el valor
    // inicial — sin él, el primer run del effect pisaría el estado recién cargado.
    let seenFirst = false;
    effect(() => {
      this.tenant?.tenantId();
      if (!seenFirst) { seenFirst = true; return; }
      this.reset();
    });
  }

  load(clubId: string): Promise<void> {
    return this.run(this.repo.getGroups(clubId), toDomainError);
  }

  /**
   * LAS DOS TRAMPAS GEMELAS — este método NO toca loading() NI error(), a propósito, y DEJA
   * PROPAGAR el error. Es una copia deliberada de DashboardFacade.cancel()
   * (dashboard.facade.ts:37-57), por las mismas tres razones:
   *
   *  1. El template del detalle es una cadena `@if (loading()) … @else if (error()) … @else if
   *     (data())` y el modal vive DENTRO de la rama data(): usar run() prendería loading() y el
   *     modal se desmontaría con el usuario adentro.
   *  2. setError() tiene el mismo efecto por la otra rama: reemplaza la pantalla entera por el
   *     estado de error aunque data() siga poblado, en vez de dejar el modal abierto.
   *  3. run() atrapa TODO en su try/catch y NUNCA rechaza (signal-store.base.ts:23-29), así que
   *     el catch de la página no correría y saldría el toast de ÉXITO tras un fallo.
   *
   * Un implementador que "arregle" esto usando run() reintroduce exactamente el bug.
   */
  async saveAttendance(clubId: string, req: SaveAttendanceRequest): Promise<void> {
    this.setData(await this.repo.saveAttendance(clubId, req));
  }
}
