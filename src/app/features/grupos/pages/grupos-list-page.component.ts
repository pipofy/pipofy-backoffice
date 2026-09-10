import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Group } from '@domain/entities/group';
import { domainErrorMessage } from '@domain/errors';
import { weekdayLabel } from '@shared/weekday-label';
import { CupoCellComponent } from '../components/cupo-cell.component';
import { groupTitle, initials } from '../grupos-format';
import { GruposFacade } from '../grupos.facade';
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

  protected readonly query = signal('');
  protected readonly category = signal(TODAS);
  protected readonly todas = TODAS;

  constructor() {
    // Carga sólo si está vacío: la facade se provee en la ruta PADRE, así que volver del detalle
    // no recarga, y entrar por deep-link a /grupos/:id sí carga.
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
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
        (groupTitle(g).toLowerCase().includes(q) || g.teacher.toLowerCase().includes(q)),
    );
  });

  protected title(g: Group): string { return groupTitle(g); }
  protected ini(name: string): string { return initials(name); }
  protected dia(weekday: number | null): string { return weekdayLabel(weekday); }

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
