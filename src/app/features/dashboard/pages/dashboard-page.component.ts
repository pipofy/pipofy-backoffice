import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardFacade } from '../dashboard.facade';
import { KpiRowComponent } from '../components/kpi-row.component';
import { CourtGridComponent } from '../components/court-grid.component';
import { WaitlistCardComponent } from '../components/waitlist-card.component';
import { SessionStore } from '@data/auth/session-store';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [KpiRowComponent, CourtGridComponent, WaitlistCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  protected readonly facade = inject(DashboardFacade);
  private readonly session = inject(SessionStore);

  constructor() {
    // El club sale del access token, no de una constante: `SessionStore.clubId` lo deriva del JWT
    // y sobrevive un F5. Sin club no se pide nada — la página vive detrás de authGuard, así que
    // esto sólo pasa con un token corrupto, y pedir el snapshot de un club vacío haría fallar la
    // validación de RefreshDashboard con un error que no ayuda a nadie.
    const clubId = this.session.clubId();
    if (clubId) void this.facade.load(clubId);
  }
}
