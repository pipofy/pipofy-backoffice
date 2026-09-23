import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { __Feature__Facade } from '../__feature__.facade';
import { __Feature__FormModalComponent } from '../__feature__-form-modal.component';
import { ConfirmDeleteModalComponent } from '@shared/ui/confirm-delete-modal/confirm-delete-modal.component';
import { __Entity__, __Entity__Input } from '@domain/entities/__entity__';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-__feature__-page',
  standalone: true,
  imports: [__Feature__FormModalComponent, ConfirmDeleteModalComponent, PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './__feature__-page.component.html',
  styleUrl: './__feature__-page.component.css',
})
export class __Feature__PageComponent {
  protected readonly facade = inject(__Feature__Facade);
  private readonly toast = inject(ToastService);
  private readonly form = viewChild.required(__Feature__FormModalComponent);
  private readonly confirm = viewChild.required(ConfirmDeleteModalComponent);

  protected readonly query = signal('');
  private readonly editing = signal<__Entity__ | null>(null);
  protected readonly deleting = signal<__Entity__ | null>(null);

  constructor() {
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.facade.sorted();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  });

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected readonly emptyTitle = computed(() =>
    this.query() ? 'Nada coincide con la búsqueda' : 'Todavía no cargaste ninguna __label__',
  );

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected openNew(): void {
    this.facade.clearError();
    this.editing.set(null);
    this.form().open(null);
  }

  protected openEdit(item: __Entity__): void {
    this.facade.clearError();
    this.editing.set(item);
    this.form().open(item);
  }

  protected askDelete(item: __Entity__): void {
    this.deleting.set(item);
    this.confirm().open();
  }

  protected async onSaved(input: __Entity__Input): Promise<void> {
    const editing = this.editing();
    if (editing) await this.facade.update(editing.id, input);
    else await this.facade.create(input);
    if (this.facade.error()) return; // el modal queda abierto: es donde se corrige
    this.form().close();
    this.toast.show('ok', '__Label__ guardada', editing ? 'Se actualizaron los datos.' : 'Se creó la __label__.');
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const item = this.deleting();
    if (!item) return;
    await this.facade.remove(item.id);
    this.deleting.set(null);
    if (this.facade.error()) return;
    this.toast.show('ok', '__Label__ eliminada', `Se eliminó ${item.name}.`);
  }
}
