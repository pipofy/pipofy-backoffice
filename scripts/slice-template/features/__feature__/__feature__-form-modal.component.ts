import { ChangeDetectionStrategy, Component, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { __Entity__, __Entity__Input } from '@domain/entities/__entity__';

/** Alta y edición: `open(null)` es alta, `open(item)` es edición. No valida: eso lo hace la facade. */
@Component({
  selector: 'app-__feature__-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="item() ? 'Editar __label__' : 'Nueva __label__'" icon="primary">
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }
      <div class="field">
        <label for="__feature__-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- contrato de ModalComponent: showModal() sólo autoenfoca un elemento con 'autofocus' -->
        <input id="__feature__-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>
      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class __Feature__FormModalComponent {
  readonly error = input('');
  readonly saved = output<__Entity__Input>();
  private readonly modal = viewChild.required(ModalComponent);
  protected readonly item = signal<__Entity__ | null>(null);
  protected readonly name = signal('');

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }

  /** Siembra imperativa en cada apertura, con el item por parámetro (ver cancha-form-modal). */
  open(item: __Entity__ | null): void {
    this.item.set(item);
    this.name.set(item?.name ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({ name: this.name() });
  }
}
