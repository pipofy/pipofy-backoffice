import { Injectable, effect, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { DashboardSnapshot } from '@domain/entities/dashboard-snapshot';
import { DashboardRepository } from '@domain/contracts/dashboard.repository';
import { ClubRepository } from '@domain/contracts/club.repository';
import { RefreshDashboard } from '@domain/use-cases/refresh-dashboard.use-case';
import { TenantContext } from '@shared/tenant/tenant-context';
import { DomainError, asDomainError } from '@domain/errors';

@Injectable()
export class DashboardFacade extends SignalStore<DashboardSnapshot, DomainError> {
  private readonly dashboards = inject(DashboardRepository);
  private readonly refresh = new RefreshDashboard(this.dashboards, inject(ClubRepository));
  private readonly tenant = inject(TenantContext, { optional: true });

  constructor() {
    super();
    // Aislamiento de tenant: limpia el estado cuando el tenant CAMBIA (salta el valor inicial,
    // si no el primer run del effect pisaría el estado recién cargado).
    let seenFirst = false;
    effect(() => {
      this.tenant?.tenantId();
      if (!seenFirst) { seenFirst = true; return; }
      this.reset();
    });
  }

  // El use case gana su lugar (compone + valida), así que lo llamamos — no al repo directo.
  // asDomainError normaliza cualquier error lanzado (incl. ClubInactiveError) a DomainError.
  load(clubId: string): Promise<void> {
    return this.run(this.refresh.execute(clubId), asDomainError);
  }
}
