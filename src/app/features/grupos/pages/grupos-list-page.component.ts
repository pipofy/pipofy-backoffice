import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Group } from '@domain/entities/group';
import { domainErrorMessage } from '@domain/errors';
import { CupoCellComponent } from '../components/cupo-cell.component';
import { GruposFacade } from '../grupos.facade';
import { SessionStore } from '@data/auth/session-store';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

const TODAS = 'Todas';

/**
 * Lista de grupos. Origen: index-v2.html:906-931 + renderGrpFilter() 1688-1693 +
 * renderGruposList() 1705-1734.
 *
 * SIN el botón "Nuevo grupo" de la maqueta (D3): sólo tiraba un toast.
 *
 * Búsqueda y categoría son signals DE ESTE COMPONENTE, así que se pierden al navegar al detalle
 * y volver (la ruta hija lo destruye). La maqueta los preserva porque usa estado de módulo.
 * Desvío deliberado: moverlos a la facade sería meter estado de UI en la capa de datos.
 */
@Component({
  selector: 'app-grupos-list-page',
  standalone: true,
  imports: [CupoCellComponent, PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grupos-list-page.component.html',
  styleUrl: './grupos-list-page.component.css',
})
export class GruposListPageComponent {
  protected readonly facade = inject(GruposFacade);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly query = signal('');
  protected readonly category = signal(TODAS);
  protected readonly todas = TODAS;

  constructor() {
    // Carga sólo si el snapshot está vacío: la facade se provee en la ruta PADRE, así que volver
    // del detalle no recarga, y entrar por deep-link a /grupos/:id sí carga.
    const clubId = this.session.clubId();
    if (clubId && !this.facade.data() && !this.facade.loading()) void this.facade.load(clubId);
  }

  /** 'Todas' + las categorías presentes en los datos, sin repetir. Origen: 1688-1690. */
  protected readonly categories = computed(() => [
    TODAS,
    ...Array.from(new Set(this.facade.groups().map((g) => g.category))),
  ]);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.facade.groups().filter(
      (g) =>
        (cat === TODAS || g.category === cat) &&
        (g.name.toLowerCase().includes(q) || g.teacher.toLowerCase().includes(q)),
    );
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected open(g: Group): void {
    void this.router.navigate(['/grupos', g.id]);
  }
}
