import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { filter } from 'rxjs';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { SiteFooterComponent } from '@shared/ui/site-footer.component';
import { ToastHostComponent } from '@shared/ui/toast/toast-host.component';
import { SessionFacade } from '@features/auth/session.facade';
import { SessionStore } from '@data/auth/session-store';
import { UsersRepository } from '@data/repositories/users.repository';
import { currentUserName } from '@data/dto/users.dto';
import { NavBadgesService } from './nav-badges.service';
import { NAV_GROUPS, NAV_ITEMS, type NavGroup, type NavItem } from './nav.model';

/**
 * Los cuatro roles que siembra el backend en el signup. El fallback devuelve el nombre crudo:
 * un rol nuevo del seed se ve raro pero honesto, que es mejor que esconderlo.
 */
const ROLE_LABELS = new Map<string, string>([
  ['admin', 'Administrador'],
  ['encargado', 'Encargado'],
  ['profesor', 'Profesor'],
  ['superprofesor', 'Superprofesor'],
]);

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, BrandmarkComponent, SiteFooterComponent, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NavBadgesService],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionFacade);
  private readonly store = inject(SessionStore);
  private readonly usersRepo = inject(UsersRepository);
  protected readonly badges = inject(NavBadgesService);

  protected readonly groups = NAV_GROUPS;
  protected readonly items = NAV_ITEMS;

  protected readonly sideOpen = signal(false);
  protected readonly title = signal('PipoFy');
  protected readonly crumb = signal('');

  /** '' mientras carga y si la request falla — ver loadUser(). */
  protected readonly userName = signal('');

  // Reloj: new Date() en runtime está OK (la prohibición es sólo de scripts de workflow).
  protected readonly clock = signal(this.formatClock());

  constructor() {
    // Título/crumb desde el data de la ruta activa (merge de toda la cadena, la hoja gana).
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.syncRouteMeta());
    this.syncRouteMeta();

    const id = setInterval(() => this.clock.set(this.formatClock()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));

    void this.loadUser();
  }

  /**
   * Falla en SILENCIO, misma política que los catálogos: el nombre es decoración del
   * sidebar, no algo por lo que valga la pena mostrarle un error a alguien que ya está
   * adentro. Si no llega, queda el rol solo — exactamente como antes de esta conexión.
   *
   * Se pide una vez por construcción del shell y no se cachea en el repositorio: ver ahí
   * por qué (un logout+login en la misma pestaña mostraría el nombre anterior).
   */
  private async loadUser(): Promise<void> {
    try {
      this.userName.set(currentUserName(await this.usersRepo.me()));
    } catch {
      this.userName.set('');
    }
  }

  protected toggleSide(): void {
    this.sideOpen.update((v) => !v);
  }

  protected closeSide(): void {
    this.sideOpen.set(false);
  }

  protected async logout(): Promise<void> {
    // logout() ya limpia la sesión local aunque la API falle (SessionFacade.logout()): el redirect
    // no puede depender de que esa llamada resuelva. navigate() se maneja aparte porque un guard o
    // un chunk lazy todavía puede rechazarla (mismo motivo que en token-refresher.ts).
    await this.session.logout().catch(() => undefined);
    await this.router.navigate(['/login']).catch((e) => console.error('[shell] redirect a /login falló', e));
  }

  protected itemsIn(group: NavGroup): readonly NavItem[] {
    return this.items.filter((i) => i.group === group);
  }

  /**
   * El rol sigue saliendo del JWT y NO de `GET /users/me`, que también lo devuelve: el token
   * ya lo tiene sin pagar una request, así que se pinta en el primer frame y sobrevive a que
   * la request falle. El nombre sí viene del endpoint porque no está en el token.
   *
   * Que sean dos fuentes es a propósito: la barata e instantánea para lo que el token sabe,
   * la request sólo para lo que no.
   */
  protected readonly rol = computed(() => {
    const roles = this.store.roles();
    if (!roles.length) return 'Sin rol';
    return roles.map((r) => ROLE_LABELS.get(r) ?? r).join(' · ');
  });

  /** 0 = no se dibuja. Se calcula en la clase y no en el template para no pelear con el
   *  narrowing de `item.badge`, que es opcional. */
  protected badgeCount(item: NavItem): number {
    return item.badge ? this.badges.counts()[item.badge] : 0;
  }

  private syncRouteMeta(): void {
    const data = this.mergedData();
    this.title.set((data['title'] as string | undefined) ?? 'PipoFy');
    this.crumb.set((data['crumb'] as string | undefined) ?? '');
  }

  private mergedData(): Data {
    let r: ActivatedRoute | null = this.route.root;
    let data: Data = {};
    // ponytail: r.snapshot puede no estar seteado todavía en el primer render
    // (el router activa el componente propio antes de avanzar el snapshot de
    // sus hijos), así que cortamos ahí; la suscripción a NavigationEnd hace
    // el merge completo una vez que toda la cadena está activada.
    while (r?.snapshot) {
      data = { ...data, ...r.snapshot.data };
      r = r.firstChild;
    }
    return data;
  }

  private formatClock(): { t: string; d: string } {
    const now = new Date();
    return {
      t: new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
      d: new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(now),
    };
  }
}
