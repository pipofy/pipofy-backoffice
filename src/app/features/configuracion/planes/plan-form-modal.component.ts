import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { Plan, PlanInput } from '@domain/entities/plan';
import { Coach } from '@domain/entities/coach';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { catalogLabel } from '@data/catalog-labels';

/**
 * El mismo componente para alta y edición: `open(null)` es alta, `open(plan)` es edición.
 *
 * No valida: emite lo que hay y la facade corre createPlanDraft, que es la única sede de
 * las invariantes.
 */
@Component({
  selector: 'app-plan-form-modal',
  standalone: true,
  imports: [ModalComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="plan() ? 'Editar plan' : 'Nuevo plan'" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). -->
      @if (error()) { <app-notice tone="bad">{{ error() }}</app-notice> }

      <div class="field field-dense">
        <label for="plan-nombre">Nombre</label>
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <input id="plan-nombre" class="control" type="text" autofocus
               [value]="name()" (input)="name.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="plan-tipo">Tipo de plan</label>
        <!-- SIN opción vacía, ni en alta ni en edición: planTypeId es obligatorio también en
             el PATCH (§3.4). El primer tipo del catálogo queda elegido por defecto en el alta:
             lo sincroniza el effect() del constructor, no basta con dejar que el <select> caiga
             en la primera <option> — si el modelo se queda en '' mientras el navegador ya
             muestra una opción elegida, createPlanDraft rechaza un tipo que a la vista estaba
             elegido (§4.1 caso C). -->
        <select id="plan-tipo" class="control" data-test="plan-type"
                [value]="planTypeId()" (change)="planTypeId.set(value($event))">
          @if (orphanPlanTypeId(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (item of planTypes(); track item.id) {
            <option [value]="item.id" [selected]="item.id === planTypeId()">{{ label(item.name) }}</option>
          }
        </select>
      </div>

      <div class="field field-dense">
        <label for="plan-profesor">Profesor</label>
        <select id="plan-profesor" class="control" data-test="plan-coach"
                [value]="coachId()" (change)="coachId.set(value($event))">
          <!-- La opción vacía SÓLO mientras el plan no tiene profesor: una vez asignado no se
               puede volver a sacar contra este backend (mandarlo en null da 500, omitirlo no
               lo borra). ponytail: se saca el @if el día que el backend acepte el null. -->
          @if (canClearCoach()) {
            <option value="" [selected]="coachId() === ''">— sin asignar —</option>
          }
          @if (orphanCoachId(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (coach of coaches(); track coach.id) {
            <option [value]="coach.id" [selected]="coach.id === coachId()">{{ coach.displayName }}</option>
          }
        </select>
      </div>

      <div class="field field-dense">
        <label for="plan-clases">Cantidad de clases</label>
        <input id="plan-clases" class="control" type="number" min="0" step="1"
               [value]="classCount()" (input)="classCount.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="plan-precio">Precio</label>
        <!-- type=number normaliza el separador decimal a punto: el backend valida
             @IsNumberString() y "12.000,50" con formato es-AR daría 400 (§3.5).

             SIN [value]: el campo es NO CONTROLADO a propósito, sembrado imperativamente por
             open() vía #precioInput (más abajo). Un dígito parcial como "12000." no es un
             floating-point number válido, así que type=number devuelve '' mientras se está
             tipeando — si [value] siguiera a \`price\` en vivo, Angular reescribiría el DOM con ''
             apenas la persona tipeara el punto, borrándole lo que tenía en pantalla (medido con
             una sonda: quedaba "5" en vez de "12000.5").

             Un [value]="priceSeed()" con un signal aparte (sembrado sólo en open()) TAMBIÉN
             se probó y se descartó: el <dialog> de ModalComponent nunca se destruye
             (modal.component.ts), así que este <input> es el MISMO nodo del DOM entre
             aperturas. Angular sólo escribe el DOM cuando la expresión del binding CAMBIA — si
             dos aperturas seguidas siembran el mismo priceSeed (p.ej. '' → '' en dos altas), no
             hay escritura y el campo se queda con lo que la persona tipeó la vez anterior,
             mintiendo sobre lo que dice \`price\`. Por eso la siembra es un \`.value =\` directo
             sobre el elemento, no un binding: no depende de que el valor sembrado difiera del
             anterior. \`price\` sigue siendo la única fuente para onSave(). -->
        <input id="plan-precio" #precioInput class="control" type="number" min="0" step="0.01"
               (input)="price.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="plan-validez">Días de validez</label>
        <input id="plan-validez" class="control" type="number" min="0" step="1"
               [value]="validityDays()" (input)="validityDays.set(value($event))" />
      </div>

      <!-- FUERA de .field a propósito: \`.field input\` es un selector de descendencia y
           convertiría el checkbox en una caja de texto. El primitivo .checkbox-row de
           styles/components.css:134 resuelve la geometría. -->
      <label class="checkbox-row" for="plan-activo">
        <input id="plan-activo" type="checkbox"
               [checked]="active()" (change)="active.set(checked($event))" />
        Activo
      </label>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class PlanFormModalComponent {
  readonly planTypes = input.required<readonly CatalogItem[]>();
  readonly coaches = input.required<readonly Coach[]>();
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<PlanInput>();

  private readonly modal = viewChild.required(ModalComponent);
  /** Input de precio, NO controlado: ver el comentario del template junto al input. */
  private readonly priceInput = viewChild.required<ElementRef<HTMLInputElement>>('precioInput');

  /** El plan en edición, o null en alta. Lo pone open(), no un input: ver ahí por qué. */
  protected readonly plan = signal<Plan | null>(null);

  protected readonly name = signal('');
  protected readonly planTypeId = signal('');
  protected readonly coachId = signal('');
  protected readonly classCount = signal('');
  /** Lo que lee onSave(); el DOM del input se siembra aparte, ver open(). */
  protected readonly price = signal('');
  protected readonly validityDays = signal('');
  protected readonly active = signal(true);

  constructor() {
    // El select de tipo NO ofrece vacío (§3.4): si el modelo se queda en '' con el catálogo ya
    // cargado, el navegador cae en la PRIMERA <option> pero el modelo sigue diciendo '' (§4.1
    // caso C) y createPlanDraft rechaza un tipo que a la vista estaba elegido. Sincroniza el
    // default acá — cubre tanto open(null) con el catálogo ya cargado como el catálogo
    // llegando DESPUÉS de abrir el modal, porque el effect se re-evalúa cuando planTypes()
    // cambia.
    effect(() => {
      const tipos = this.planTypes();
      if (this.planTypeId() === '' && tipos.length > 0) this.planTypeId.set(tipos[0].id);
    });
  }

  /** En alta (plan === null) siempre se puede dejar sin profesor; en edición, sólo si ya lo está. */
  protected readonly canClearCoach = computed(() => {
    const p = this.plan();
    return p === null || p.coachId === null;
  });

  /**
   * El valor guardado que no tiene ninguna <option> que lo matchee — porque el catálogo
   * todavía no llegó, o porque falló su carga (falla en silencio a propósito).
   *
   * Sin esta opción el navegador cae en la PRIMERA y la pantalla muestra un tipo distinto
   * del que se va a guardar. Medido en la Task 9: `[value]` a secas da selectedIndex 0.
   */
  protected readonly orphanPlanTypeId = computed(() => {
    const id = this.planTypeId();
    if (id === '') return null;
    return this.planTypes().some((t) => t.id === id) ? null : id;
  });

  protected readonly orphanCoachId = computed(() => {
    const id = this.coachId();
    if (id === '') return null;
    return this.coaches().some((c) => c.id === id) ? null : id;
  });

  protected label(name: string): string { return catalogLabel(name); }
  protected value(e: Event): string { return (e.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  /**
   * Siembra IMPERATIVA en CADA apertura, con el plan por PARÁMETRO. Las dos partes importan:
   * un effect() sobre un input no se re-dispara cuando el valor es Object.is-igual (dos altas
   * seguidas reabrían con lo tipeado), y leer el input dentro de open() devuelve el valor
   * ANTERIOR porque el binding se refresca recién en la detección de cambios (hazard
   * documentado en grupo-detail-page.component.ts:60-63).
   *
   * En alta `active` arranca en true: es el default del backend (`active Boolean @default(true)`)
   * y crear un plan inactivo no es lo que quiere nadie.
   *
   * El precio se siembra DOS veces y por vías distintas: `price` (el signal que lee onSave())
   * y `priceInput().nativeElement.value` (el DOM, directo, sin binding). El <input> es el
   * MISMO nodo entre aperturas (el <dialog> de ModalComponent nunca se destruye), así que un
   * binding [value] sembrado con el mismo string que ya tenía (p.ej. '' → '' en dos altas
   * seguidas) no reescribe nada — Angular sólo toca el DOM cuando la expresión CAMBIA. El
   * `.value =` directo no tiene ese problema: pisa el campo sin importar si el valor nuevo es
   * igual al anterior.
   */
  open(plan: Plan | null): void {
    this.plan.set(plan);
    this.name.set(plan?.name ?? '');
    this.planTypeId.set(plan?.planTypeId ?? '');
    this.coachId.set(plan?.coachId ?? '');
    this.classCount.set(plan?.classCount != null ? String(plan.classCount) : '');
    this.price.set(plan?.price ?? '');
    this.priceInput().nativeElement.value = plan?.price ?? '';
    this.validityDays.set(plan?.validityDays != null ? String(plan.validityDays) : '');
    this.active.set(plan?.active ?? true);
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    this.saved.emit({
      name: this.name(),
      planTypeId: this.planTypeId(),
      coachId: this.coachId(),
      classCount: this.classCount(),
      price: this.price(),
      validityDays: this.validityDays(),
      active: this.active(),
    });
  }
}
