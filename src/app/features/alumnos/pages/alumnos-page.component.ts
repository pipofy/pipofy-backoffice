import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { AlumnosFacade } from '../alumnos.facade';
import { AlumnoFormModalComponent } from '../alumno-form-modal.component';
import { AlumnoPlanesModalComponent } from '../alumno-planes-modal.component';
import { dominantHandLabel } from '../hand-label';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { Student, StudentInput, studentDisplayName } from '@domain/entities/student';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { catalogLabel } from '@data/catalog-labels';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-alumnos-page',
  standalone: true,
  imports: [
    AlumnoFormModalComponent,
    ConfirmDeleteModalComponent,
    AlumnoPlanesModalComponent,
    PlaceholderComponent,
    NoticeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alumnos-page.component.html',
  styleUrl: './alumnos-page.component.css',
})
export class AlumnosPageComponent {
  protected readonly facade = inject(AlumnosFacade);
  private readonly toast = inject(ToastService);

  private readonly form = viewChild.required(AlumnoFormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);
  private readonly planes = viewChild.required(AlumnoPlanesModalComponent);

  protected readonly query = signal('');
  /** Ya no viaja al modal por binding (open() lo recibe por parámetro): sólo enruta el guardado. */
  private readonly editing = signal<Student | null>(null);
  protected readonly deleting = signal<Student | null>(null);

  constructor() {
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
    if (this.facade.categories().length === 0) void this.facade.loadCategories();
    if (this.facade.statuses().length === 0) void this.facade.loadStatuses();
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    if (!q) return rows;
    // El teléfono entra en la búsqueda porque es el único dato que TODO alumno tiene: el
    // backend sólo exige phone, así que hay filas sin nombre ni apellido.
    return rows.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.phone.includes(q),
    );
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** El vacío de búsqueda y el vacío real dicen cosas distintas. */
  protected readonly emptyTitle = computed(() =>
    this.query()
      ? 'Ningún alumno coincide con la búsqueda'
      : 'Todavía no cargaste ningún alumno',
  );

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected displayName(student: Student): string { return studentDisplayName(student); }

  protected categoryName(id: string | null): string {
    if (id === null) return '—';
    const hit = this.facade.categories().find((c) => c.id === id);
    return hit ? hit.name || '(sin nombre)' : '—';
  }

  /**
   * El '—' cubre el catálogo que no cargó, no un alumno sin estado: la columna es NOT NULL.
   * Sin el catálogo la tabla mostraría el id crudo, que no le dice nada a nadie.
   */
  protected statusName(id: string): string {
    const hit = this.facade.statuses().find((s) => s.id === id);
    return hit ? catalogLabel(hit.name) : '—';
  }

  protected handName(hand: string | null): string {
    return dominantHandLabel(hand);
  }

  protected deletingName(): string {
    const student = this.deleting();
    return student ? studentDisplayName(student) : 'este alumno';
  }

  /** clearError() antes de abrir: sin esto un error viejo del load() aparecería en un alta. */
  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(student: Student): void {
    this.facade.clearError();
    this.editing.set(student);
    this.form().open(student);
  }

  /** El modal carga solo al abrirse: no toca el error ni el loading de la tabla. */
  protected openPlanes(student: Student): void {
    void this.planes().open(student);
  }

  protected askDelete(student: Student): void {
    this.deleting.set(student);
    this.confirm().open();
  }

  protected async onSaved(input: StudentInput): Promise<void> {
    const editing = this.editing();
    if (editing) {
      await this.facade.update(editing.id, input);
    } else {
      await this.facade.create(input);
    }

    // El modal queda ABIERTO si falló: es donde el usuario puede corregir. Con el 409 por
    // teléfono duplicado eso importa especialmente — el resto del formulario se conserva.
    if (this.facade.error()) return;
    this.form().close();
    this.toast.show('ok', 'Alumno guardado', editing ? 'Se actualizaron los datos.' : 'Se creó el alumno.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const student = this.deleting();
    if (!student) return;
    await this.facade.remove(student.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', 'Alumno eliminado', `Se eliminó ${studentDisplayName(student)}.`);
  }
}
