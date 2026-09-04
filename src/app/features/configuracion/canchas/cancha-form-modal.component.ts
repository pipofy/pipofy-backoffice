import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { Court, CourtInput } from '@domain/entities/court';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { catalogLabel } from '@data/catalog-labels';

/**
 * El mismo componente para alta y edición: `open(null)` es alta, `open(cancha)` es edición.
 *
 * No valida: emite lo que hay y la facade corre createCourtDraft, que es la única sede de
 * la invariante. Duplicar el "nombre requerido" acá daría dos copys que se desincronizan.
 */
@Component({
  selector: 'app-cancha-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="court() ? 'Editar cancha' : 'Nueva cancha'" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). Acá es donde se corrige. -->
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

      <div class="field">
        <label for="cancha-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <input id="cancha-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>

      <div class="field">
        <label for="cancha-codigo">Código</label>
        <input id="cancha-codigo" class="control" type="text"
               [value]="code()" (input)="code.set(value($event))" />
      </div>

      <div class="field">
        <label for="cancha-superficie">Superficie</label>
        <select id="cancha-superficie" class="control" data-test="surface"
                [value]="surfaceTypeId()" (change)="surfaceTypeId.set(value($event))">
          <!-- La opción vacía SÓLO mientras el FK es null: una vez asignado no se puede
               volver a vaciar contra este backend (§4.5), y ofrecerla sería mentir.
               ponytail: se saca el @if el día que el backend acepte el null. -->
          @if (canClearSurface()) {
            <option value="" [selected]="surfaceTypeId() === ''">— sin especificar —</option>
          }
          @if (orphanSurfaceId(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (item of surfaceTypes(); track item.id) {
            <option [value]="item.id" [selected]="item.id === surfaceTypeId()">{{ label(item.name) }}</option>
          }
        </select>
      </div>

      <!-- FUERA de .field a propósito: \`.field input\` es un selector de descendencia y
           convertiría el checkbox en una caja de texto. El primitivo .checkbox-row de
           styles/components.css:134 resuelve la geometría. -->
      <label class="checkbox-row" for="cancha-techada">
        <input id="cancha-techada" type="checkbox"
               [checked]="indoor()" (change)="indoor.set(checked($event))" />
        Techada
      </label>

      <div class="field">
        <label for="cancha-estado">Estado</label>
        <select id="cancha-estado" class="control" data-test="status"
                [value]="courtStatusId()" (change)="courtStatusId.set(value($event))">
          @if (canClearStatus()) {
            <option value="" [selected]="courtStatusId() === ''">— sin especificar —</option>
          }
          @if (orphanStatusId(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (item of courtStatuses(); track item.id) {
            <option [value]="item.id" [selected]="item.id === courtStatusId()">{{ label(item.name) }}</option>
          }
        </select>
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class CanchaFormModalComponent {
  readonly surfaceTypes = input.required<readonly CatalogItem[]>();
  readonly courtStatuses = input.required<readonly CatalogItem[]>();
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<CourtInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** La cancha en edición, o null en alta. La pone open(), no un input: ver ahí por qué. */
  protected readonly court = signal<Court | null>(null);

  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly surfaceTypeId = signal('');
  protected readonly indoor = signal(false);
  protected readonly courtStatusId = signal('');

  /** En alta (court === null) siempre se puede dejar vacío; en edición, sólo si todavía lo está. */
  protected readonly canClearSurface = computed(() => {
    const c = this.court();
    return c === null || c.surfaceTypeId === null;
  });

  protected readonly canClearStatus = computed(() => {
    const c = this.court();
    return c === null || c.courtStatusId === null;
  });

  /**
   * El valor guardado que no tiene ninguna <option> que lo matchee — porque el catálogo
   * todavía no llegó, o porque falló su carga (falla en silencio a propósito).
   *
   * Sin esta opción el navegador cae en la PRIMERA y la pantalla muestra una superficie
   * distinta de la que se va a guardar. Medido: `[value]` a secas da selectedIndex 0 en
   * ese caso, no -1.
   *
   * Va `disabled` para que el usuario no pueda volver a elegirla después de cambiarla: es
   * un valor que existe en la base pero ya no está entre los válidos.
   */
  protected readonly orphanSurfaceId = computed(() => {
    const id = this.surfaceTypeId();
    if (id === '') return null;
    return this.surfaceTypes().some((s) => s.id === id) ? null : id;
  });

  protected readonly orphanStatusId = computed(() => {
    const id = this.courtStatusId();
    if (id === '') return null;
    return this.courtStatuses().some((s) => s.id === id) ? null : id;
  });

  protected label(name: string): string { return catalogLabel(name); }
  protected value(e: Event): string { return (e.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con la cancha por PARÁMETRO. Las dos partes importan.
   *
   * Con un effect() sobre un input, Angular corta el set cuando el valor nuevo es Object.is-igual
   * al viejo: dar de alta dos canchas seguidas (`editing` sigue en null) reabría el formulario con
   * lo que se acababa de tipear, y un Guardar de más creaba un duplicado.
   *
   * Y leer el input DENTRO de open() tampoco alcanza: la página hace `editing.set(c); form().open()`
   * y el binding recién se refresca en la detección de cambios, así que el input todavía tiene el
   * valor ANTERIOR — el mismo hazard que documenta grupo-detail-page.component.ts:60-63. El
   * parámetro es el único valor que ya está fresco cuando se abre.
   */
  open(court: Court | null): void {
    this.court.set(court);
    this.name.set(court?.name ?? '');
    this.code.set(court?.code ?? '');
    this.surfaceTypeId.set(court?.surfaceTypeId ?? '');
    this.indoor.set(court?.indoor ?? false);
    this.courtStatusId.set(court?.courtStatusId ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({
      name: this.name(),
      code: this.code(),
      surfaceTypeId: this.surfaceTypeId(),
      indoor: this.indoor(),
      courtStatusId: this.courtStatusId(),
    });
  }
}
