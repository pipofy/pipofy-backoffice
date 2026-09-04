import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { Schedule, ScheduleInput } from '@domain/entities/schedule';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { catalogLabel } from '@data/catalog-labels';
import { WEEKDAY_OPTIONS } from './weekday-label';

/**
 * El mismo componente para alta y edición: `open(null)` es alta, `open(schedule)` es edición.
 *
 * No valida: emite lo que hay y la facade corre createScheduleDraft, que es la única sede de
 * las invariantes.
 */
@Component({
  selector: 'app-horario-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="schedule() ? 'Editar horario' : 'Nuevo horario'" icon="primary">
      <!-- Ancla para el effect() del scroll: el .modal-body real vive en ModalComponent, que
           es deliberadamente fino y no gana un método sólo para esto. Ver el comentario junto
           a modalBody más abajo sobre por qué scrollear ESTE div no alcanza. -->
      <div #body class="horario-body">
        <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
             que tiene scrim + blur(4px) (styles/components.css:254). -->
        @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

        <div class="field field-dense">
          <label for="horario-cancha">Cancha</label>
          <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
          <select id="horario-cancha" class="control" data-test="cancha" autofocus
                  [value]="courtId()" (change)="courtId.set(value($event))">
            <!-- Sin opción vacía: el FK es obligatorio también en el PATCH (§6.4).
                 La huérfana cubre el valor guardado que ya no está en la lista, y el
                 [selected] de CADA option cubre el lookup que llega tarde. Las dos piezas
                 hacen falta: [value] a secas da selectedIndex 0. -->
            @if (orphanCourtId(); as orphan) {
              <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
            }
            @for (court of courts(); track court.id) {
              <option [value]="court.id" [selected]="court.id === courtId()">{{ court.name }}</option>
            }
          </select>
        </div>

        <div class="field field-dense">
          <label for="horario-profesor">Profesor</label>
          <select id="horario-profesor" class="control" data-test="profesor"
                  [value]="coachId()" (change)="coachId.set(value($event))">
            @if (orphanCoachId(); as orphan) {
              <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
            }
            @for (coach of coaches(); track coach.id) {
              <option [value]="coach.id" [selected]="coach.id === coachId()">{{ coach.displayName }}</option>
            }
          </select>
        </div>

        <div class="field field-dense">
          <label for="horario-grupo">Grupo de categoría</label>
          <select id="horario-grupo" class="control" data-test="grupo"
                  [value]="categoryGroupId()" (change)="categoryGroupId.set(value($event))">
            @if (orphanCategoryGroupId(); as orphan) {
              <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
            }
            @for (group of categoryGroups(); track group.id) {
              <option [value]="group.id" [selected]="group.id === categoryGroupId()">{{ group.name }}</option>
            }
          </select>
        </div>

        <div class="field field-dense">
          <label for="horario-tipo">Tipo de clase</label>
          <select id="horario-tipo" class="control" data-test="tipo"
                  [value]="sessionTypeId()" (change)="sessionTypeId.set(value($event))">
            @if (orphanSessionTypeId(); as orphan) {
              <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
            }
            @for (item of sessionTypes(); track item.id) {
              <option [value]="item.id" [selected]="item.id === sessionTypeId()">{{ label(item.name) }}</option>
            }
          </select>
        </div>

        <div class="field field-dense">
          <label for="horario-dia">Día</label>
          <select id="horario-dia" class="control" data-test="dia"
                  [value]="weekday()" (change)="weekday.set(value($event))">
            <!-- La opción huérfana acá NO es por un lookup que puede fallar —la lista de días
                 es estática— sino por las filas con weekday null, que §6.4 dice que existen y
                 que la tabla muestra en vez de esconder. Sin ella el navegador cae en la
                 primera opción y la pantalla dice "Lunes" sobre una fila sin día; si además
                 se guardara, quedaría un lunes que nadie eligió.
                 Por lo mismo NO necesita el effect() que sí llevan los otros cuatro: no hay
                 nada asíncrono que pueda llegar tarde. -->
            @if (weekday() === '') {
              <option value="" [selected]="true" disabled>— sin día —</option>
            }
            @for (opt of weekdayOptions; track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === weekday()">{{ opt.label }}</option>
            }
          </select>
        </div>

        <div class="field-pair">
          <div class="field field-dense">
            <label for="horario-inicio">Hora de inicio</label>
            <input id="horario-inicio" class="control" type="time"
                   [value]="startTime()" (input)="startTime.set(value($event))" />
          </div>
          <div class="field field-dense">
            <label for="horario-fin">Hora de fin</label>
            <input id="horario-fin" class="control" type="time"
                   [value]="endTime()" (input)="endTime.set(value($event))" />
          </div>
        </div>

        <div class="field-pair">
          <div class="field field-dense">
            <label for="horario-cupo">Cupo</label>
            <input id="horario-cupo" class="control" type="number" min="0" step="1"
                   [value]="capacity()" (input)="capacity.set(value($event))" />
          </div>
          <div class="field field-dense">
            <label for="horario-precio">Precio</label>
            <!-- SIN [value]: campo NO CONTROLADO, sembrado imperativamente por open() vía
                 #precioInput. La explicación completa —por qué un [value] en vivo borra lo
                 tipeado al llegar al punto decimal, y por qué un signal-semilla aparte tampoco
                 alcanza— está en plan-form-modal.component.ts:79-95 y :195-212. No se repite. -->
            <input id="horario-precio" #precioInput class="control" type="number" min="0" step="0.01"
                   (input)="price.set(value($event))" />
          </div>
        </div>

        <div class="field-pair">
          <div class="field field-dense">
            <label for="horario-desde">Vigente desde</label>
            <input id="horario-desde" class="control" type="date"
                   [value]="validFrom()" (input)="validFrom.set(value($event))" />
          </div>
          <div class="field field-dense">
            <label for="horario-hasta">Vigente hasta</label>
            <input id="horario-hasta" class="control" type="date"
                   [value]="validTo()" (input)="validTo.set(value($event))" />
          </div>
        </div>
        <p class="hint">Se pueden corregir, pero no volver a dejarlas vacías.</p>

        <!-- FUERA de .field a propósito: \`.field input\` es un selector de descendencia y
             convertiría el checkbox en una caja de texto. El primitivo .checkbox-row de
             styles/components.css:134 resuelve la geometría. -->
        <label class="checkbox-row" for="horario-activo">
          <input id="horario-activo" type="checkbox"
                 [checked]="active()" (change)="active.set(checked($event))" />
          Activo
        </label>
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save"
                [disabled]="saving()" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
  styles: [`
    /* Los seis controles cortos van de a dos. Sin esto el modal suma 1022px de contenido
       contra los 668 que permite max-height:min(90dvh,900px) (components.css:251), y
       scrollea hasta en un monitor 4K. Con dos columnas baja a ~592 y entra en desktop. */
    .field-pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)}
  `],
})
export class HorarioFormModalComponent {
  readonly courts = input.required<readonly Court[]>();
  readonly coaches = input.required<readonly Coach[]>();
  readonly categoryGroups = input.required<readonly CategoryGroup[]>();
  readonly sessionTypes = input.required<readonly CatalogItem[]>();
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  /** true mientras la escritura está en vuelo: regla 5 de §8.0. */
  readonly saving = input(false);
  readonly saved = output<ScheduleInput>();

  protected readonly weekdayOptions = WEEKDAY_OPTIONS;

  private readonly modal = viewChild.required(ModalComponent);
  /** Input de precio, NO controlado: ver el comentario del template junto al input. */
  private readonly priceInput = viewChild.required<ElementRef<HTMLInputElement>>('precioInput');
  private readonly modalBody = viewChild.required<ElementRef<HTMLElement>>('body');

  /** El horario en edición, o null en alta. Lo pone open(), no un input: ver ahí por qué. */
  protected readonly schedule = signal<Schedule | null>(null);

  protected readonly courtId = signal('');
  protected readonly coachId = signal('');
  protected readonly categoryGroupId = signal('');
  protected readonly sessionTypeId = signal('');
  protected readonly weekday = signal('');
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');
  protected readonly capacity = signal('');
  /** Lo que lee onSave(); el DOM del input se siembra aparte, ver open(). */
  protected readonly price = signal('');
  protected readonly active = signal(true);
  protected readonly validFrom = signal('');
  protected readonly validTo = signal('');

  constructor() {
    // Los CUATRO selects de lookup: si el modelo quedó en '' con la lista ya cargada, el
    // navegador cae en la primera <option> pero el modelo sigue diciendo '' y
    // createScheduleDraft rechaza algo que a la vista estaba elegido. Cubre tanto open(null)
    // con el lookup ya cargado como el lookup llegando DESPUÉS de abrir el modal.
    // El select de DÍA no lleva effect: su lista es estática.
    effect(() => {
      const list = this.courts();
      if (this.courtId() === '' && list.length > 0) this.courtId.set(list[0].id);
    });
    effect(() => {
      const list = this.coaches();
      if (this.coachId() === '' && list.length > 0) this.coachId.set(list[0].id);
    });
    effect(() => {
      const list = this.categoryGroups();
      if (this.categoryGroupId() === '' && list.length > 0) this.categoryGroupId.set(list[0].id);
    });
    effect(() => {
      const list = this.sessionTypes();
      if (this.sessionTypeId() === '' && list.length > 0) this.sessionTypeId.set(list[0].id);
    });

    // Con once campos el modal SIEMPRE scrollea, y el .notice de error vive arriba del
    // .modal-body: sin esto, la persona aprieta Guardar desde abajo y el mensaje se pinta
    // fuera de la pantalla (§8.3).
    //
    // El .modal-body real vive en ModalComponent (deliberadamente fino, sin método para esto:
    // ver la clase). scrollTop = 0 sobre #body (el propio wrapper, SIN overflow declarado) NO
    // alcanza: probado, y falla el test — #body no es el que scrollea, es un div normal que
    // vive DENTRO de .modal-body (components.css:289, el que tiene el overflow-y:auto), así
    // que pisar su scrollTop es un no-op que no se propaga al ancestro. La proyección de
    // contenido de Angular sí mueve el nodo real de #body a ser HIJO de .modal-body en el DOM,
    // así que closest() desde acá SÍ lo encuentra trepando hacia arriba.
    effect(() => {
      if (this.error() === '') return;
      const modalBody = this.modalBody().nativeElement.closest('.modal-body');
      if (modalBody) (modalBody as HTMLElement).scrollTop = 0;
    });
  }

  /**
   * El valor guardado que no tiene ninguna <option> que lo matchee — porque el lookup
   * todavía no llegó, o porque falló su carga (falla en silencio a propósito).
   *
   * Sin esta opción el navegador cae en la PRIMERA y la pantalla muestra un valor distinto
   * del que se va a guardar.
   */
  protected readonly orphanCourtId = computed(() => {
    const id = this.courtId();
    if (id === '') return null;
    return this.courts().some((c) => c.id === id) ? null : id;
  });

  protected readonly orphanCoachId = computed(() => {
    const id = this.coachId();
    if (id === '') return null;
    return this.coaches().some((c) => c.id === id) ? null : id;
  });

  protected readonly orphanCategoryGroupId = computed(() => {
    const id = this.categoryGroupId();
    if (id === '') return null;
    return this.categoryGroups().some((g) => g.id === id) ? null : id;
  });

  protected readonly orphanSessionTypeId = computed(() => {
    const id = this.sessionTypeId();
    if (id === '') return null;
    return this.sessionTypes().some((t) => t.id === id) ? null : id;
  });

  protected label(name: string): string { return catalogLabel(name); }
  protected value(e: Event): string { return (e.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con el horario por PARÁMETRO. Las dos partes
   * importan: un effect() sobre un input no se re-dispara cuando el valor es Object.is-igual
   * (dos altas seguidas reabrían con lo tipeado), y leer el input dentro de open() devuelve el
   * valor ANTERIOR porque el binding se refresca recién en la detección de cambios.
   */
  open(schedule: Schedule | null): void {
    this.schedule.set(schedule);
    this.courtId.set(schedule?.courtId ?? this.courts()[0]?.id ?? '');
    this.coachId.set(schedule?.coachId ?? this.coaches()[0]?.id ?? '');
    this.categoryGroupId.set(schedule?.categoryGroupId ?? this.categoryGroups()[0]?.id ?? '');
    this.sessionTypeId.set(schedule?.sessionTypeId ?? this.sessionTypes()[0]?.id ?? '');
    // En el alta, lunes. En la edición, '' cuando la fila no tiene día — y NO un fallback a
    // lunes, que guardaría en silencio un día que nadie eligió.
    this.weekday.set(schedule === null ? '1' : (schedule.weekday === null ? '' : String(schedule.weekday)));
    this.startTime.set(schedule?.startTime ?? '');
    this.endTime.set(schedule?.endTime ?? '');
    this.capacity.set(schedule?.capacity != null ? String(schedule.capacity) : '');
    this.price.set(schedule?.price ?? '');
    this.priceInput().nativeElement.value = schedule?.price ?? '';
    this.active.set(schedule?.active ?? true);
    this.validFrom.set(schedule?.validFrom ?? '');
    this.validTo.set(schedule?.validTo ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({
      courtId: this.courtId(),
      coachId: this.coachId(),
      categoryGroupId: this.categoryGroupId(),
      sessionTypeId: this.sessionTypeId(),
      weekday: this.weekday(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      capacity: this.capacity(),
      price: this.price(),
      active: this.active(),
      validFrom: this.validFrom(),
      validTo: this.validTo(),
    });
  }
}
