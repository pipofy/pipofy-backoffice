import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { DOMINANT_HANDS, Student, StudentInput } from '@domain/entities/student';
import { dominantHandLabel } from './hand-label';
import { Category } from '@domain/entities/category';
import { CatalogItem } from '@data/dto/catalogs.dto';
import { catalogLabel } from '@data/catalog-labels';

/**
 * El mismo componente para alta y edición: `open(null)` es alta, `open(alumno)` es edición.
 *
 * No valida: emite lo que hay y la facade corre createStudentDraft, que es la única sede de
 * las invariantes. La ÚNICA excepción es la fecha de nacimiento — ver onSave().
 */
@Component({
  selector: 'app-alumno-form-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal [title]="student() ? 'Editar alumno' : 'Nuevo alumno'" icon="primary">
      <!-- El error va DENTRO del modal: el .notice de la página queda detrás del ::backdrop,
           que tiene scrim + blur(4px) (styles/components.css:254). Acá es donde se corrige,
           y con el 409 por teléfono duplicado eso importa especialmente. -->
      @if (error()) { <p class="notice hold form-error" role="alert">{{ error() }}</p> }

      <div class="field field-dense">
        <label for="alumno-telefono">Teléfono</label>
        <!-- READONLY y no disabled en la edición: students.service.update() no escribe phone
             (§3.1), así que editarlo devolvería 200 sin cambiar nada. Un disabled además no
             es enfocable y rompería el autofocus que exige el contrato de ModalComponent. -->
        <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -- requerido por el contrato de ModalComponent: showModal() sólo autoenfoca un elemento con el atributo HTML 'autofocus'; sin él, el dialog nativo se autoenfoca a sí mismo y el foco no llega al primer control (modal.component.ts) -->
        <input id="alumno-telefono" class="control" type="text" autofocus
               [readOnly]="student() !== null"
               [value]="phone()" (input)="phone.set(value($event))" />
        @if (student()) { <p class="hint">El teléfono no se puede cambiar.</p> }
      </div>

      <div class="field field-dense">
        <label for="alumno-nombre">Nombre</label>
        <input id="alumno-nombre" class="control" type="text"
               [value]="firstName()" (input)="firstName.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="alumno-apellido">Apellido</label>
        <input id="alumno-apellido" class="control" type="text"
               [value]="lastName()" (input)="lastName.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="alumno-nacimiento">Fecha de nacimiento</label>
        <input id="alumno-nacimiento" class="control" type="date"
               [value]="birthDate()" (input)="birthDate.set(value($event))" />
        <!-- No sirve \`required\`: no hay <form> (se guarda con un click, no con un submit),
             así que el navegador nunca corre la validación. Este aviso es lo que evita que
             la persona intente algo que el backend va a ignorar (§3.3). -->
        @if (!canClearBirthDate()) {
          <p class="hint">Se puede corregir, pero no volver a dejar vacía.</p>
        }
      </div>

      <div class="field field-dense">
        <label for="alumno-categoria">Categoría</label>
        <select id="alumno-categoria" class="control" data-test="alumno-categoria"
                [value]="categoryId()" (change)="categoryId.set(value($event))">
          <!-- La opción vacía SÓLO mientras el alumno no tiene categoría: una vez asignada no
               se puede volver a sacar contra este backend (mandarla en null da 500, omitirla
               no la borra). ponytail: se saca el @if el día que el backend acepte el null. -->
          @if (canClearCategory()) {
            <option value="" [selected]="categoryId() === ''">— sin categoría —</option>
          }
          @if (orphanCategoryId(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (category of categories(); track category.id) {
            <option [value]="category.id" [selected]="category.id === categoryId()">
              {{ category.name || '(sin nombre)' }}
            </option>
          }
        </select>
      </div>

      <!-- SÓLO en edición: CreateStudentDto no declara studentStatusId, así que en el alta el
           backend lo fuerza a 'pending_classification' y un select acá prometería algo que no
           se cumple. UpdateStudentDto:38 sí lo acepta. -->
      @if (student()) {
        <div class="field field-dense">
          <label for="alumno-estado">Estado</label>
          <select id="alumno-estado" class="control" data-test="alumno-estado"
                  [value]="studentStatusId()" (change)="studentStatusId.set(value($event))">
            <!-- Sin opción vacía: la columna es NOT NULL, no hay "sin estado" que elegir. -->
            @if (orphanStatusId(); as orphan) {
              <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
            }
            @for (status of statuses(); track status.id) {
              <option [value]="status.id" [selected]="status.id === studentStatusId()">
                {{ statusLabel(status) }}
              </option>
            }
          </select>
          <p class="hint">Los que entran por WhatsApp quedan sin clasificar hasta que un profe les asigna categoría.</p>
        </div>
      }

      <div class="field field-dense">
        <label for="alumno-mano">Mano hábil</label>
        <!-- Este select SÍ ofrece siempre el vacío: dominantHand es un String? libre y
             mandarlo en null lo borra sin problema (§3.3). -->
        <select id="alumno-mano" class="control" data-test="alumno-mano"
                [value]="dominantHand()" (change)="dominantHand.set(value($event))">
          <option value="" [selected]="dominantHand() === ''">— sin especificar —</option>
          @if (orphanHand(); as orphan) {
            <option [value]="orphan" [selected]="true" disabled>(no disponible)</option>
          }
          @for (hand of hands; track hand) {
            <option [value]="hand" [selected]="hand === dominantHand()">{{ handLabel(hand) }}</option>
          }
        </select>
      </div>

      <div class="field field-dense">
        <label for="alumno-ranking">Ranking</label>
        <input id="alumno-ranking" class="control" type="number" min="0" step="1"
               [value]="ranking()" (input)="ranking.set(value($event))" />
      </div>

      <div class="field field-dense">
        <label for="alumno-notas">Notas</label>
        <textarea id="alumno-notas" class="control"
                  [value]="notes()" (input)="notes.set(value($event))"></textarea>
      </div>

      <div class="modal-foot" modal-foot>
        <button type="button" class="btn btn-ghost" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn-primary" data-test="save" (click)="onSave()">Guardar</button>
      </div>
    </app-modal>
  `,
  styles: [`.form-error{margin-bottom:var(--space-md)}`],
})
export class AlumnoFormModalComponent {
  readonly categories = input.required<readonly Category[]>();
  readonly statuses = input.required<readonly CatalogItem[]>();
  /** Copy ya traducido del error que dejó la facade; '' cuando no hay. */
  readonly error = input('');
  readonly saved = output<StudentInput>();

  private readonly modal = viewChild.required(ModalComponent);

  /** El alumno en edición, o null en alta. Lo pone open(), no un input: ver ahí por qué. */
  protected readonly student = signal<Student | null>(null);

  protected readonly phone = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly birthDate = signal('');
  protected readonly categoryId = signal('');
  protected readonly studentStatusId = signal('');
  protected readonly dominantHand = signal('');
  protected readonly ranking = signal('');
  protected readonly notes = signal('');

  protected readonly hands = DOMINANT_HANDS;

  /** En alta siempre se puede dejar sin categoría; en edición, sólo si todavía lo está. */
  protected readonly canClearCategory = computed(() => {
    const s = this.student();
    return s === null || s.categoryId === null;
  });

  /** Lo mismo con la fecha, pero acá el motivo es el `? :` del service, no BigInt(null). */
  protected readonly canClearBirthDate = computed(() => {
    const s = this.student();
    return s === null || s.birthDate === null;
  });

  /**
   * El valor guardado que no tiene ninguna <option> que lo matchee — porque la categoría
   * fue borrada, o porque la lista todavía no llegó.
   *
   * Sin esta opción el navegador cae en la PRIMERA y la pantalla muestra una categoría
   * distinta de la que tiene el alumno. Medido en la Task 9: `[value]` a secas da
   * selectedIndex 0, no -1.
   *
   * Va `disabled` para que no se pueda volver a elegir después de cambiarla: es un valor
   * que existe en la base pero ya no está entre los válidos.
   */
  protected readonly orphanCategoryId = computed(() => {
    const id = this.categoryId();
    if (id === '') return null;
    return this.categories().some((c) => c.id === id) ? null : id;
  });

  /** Mismo hazard que orphanCategoryId: si el catálogo no cargó, sin esta opción el select
   *  mostraría el primer estado de la lista como si fuera el del alumno. */
  protected readonly orphanStatusId = computed(() => {
    const id = this.studentStatusId();
    if (id === '') return null;
    return this.statuses().some((s) => s.id === id) ? null : id;
  });

  /** Para una mano hábil guardada con un valor que ya no está en DOMINANT_HANDS. */
  protected readonly orphanHand = computed(() => {
    const hand = this.dominantHand();
    if (hand === '') return null;
    return (DOMINANT_HANDS as readonly string[]).includes(hand) ? null : hand;
  });

  /** El catálogo llega en snake_case del seed: 'pending_classification' → 'Sin clasificar'. */
  protected statusLabel(status: CatalogItem): string {
    return catalogLabel(status.name);
  }

  protected handLabel(hand: string): string {
    return dominantHandLabel(hand);
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  /**
   * Siembra IMPERATIVA en CADA apertura, con el alumno por PARÁMETRO. Las dos partes importan:
   * un effect() sobre un input no se re-dispara cuando el valor es Object.is-igual (dos altas
   * seguidas reabrían con lo tipeado y un Guardar de más creaba un duplicado), y leer el input
   * dentro de open() devuelve el valor ANTERIOR porque el binding se refresca recién en la
   * detección de cambios (hazard documentado en grupo-detail-page.component.ts:60-63).
   */
  open(student: Student | null): void {
    this.student.set(student);
    this.phone.set(student?.phone ?? '');
    this.firstName.set(student?.firstName ?? '');
    this.lastName.set(student?.lastName ?? '');
    this.birthDate.set(student?.birthDate ?? '');
    this.categoryId.set(student?.categoryId ?? '');
    this.studentStatusId.set(student?.studentStatusId ?? '');
    this.dominantHand.set(student?.dominantHand ?? '');
    this.ranking.set(student?.ranking != null ? String(student.ranking) : '');
    this.notes.set(student?.notes ?? '');
    this.modal().open();
  }

  close(): void { this.modal().close(); }

  protected onSave(): void {
    // La fecha se emite tal cual está en el campo. Que vaciarla no la borre lo resuelve
    // toStudentRequest, que OMITE la clave cuando es null (student.mapper.ts:37): Prisma lee
    // `undefined` como "no toques este campo" y el valor viejo queda. Rescatar acá la fecha
    // original sería el mismo resultado escrito dos veces — y el día que el backend acepte
    // vaciarla, se toca el mapper y esto seguiría resucitándola en silencio. El hint del
    // formulario es lo que le avisa a la persona; el mapper es lo que lo cumple.
    this.saved.emit({
      phone: this.phone(),
      firstName: this.firstName(),
      lastName: this.lastName(),
      birthDate: this.birthDate(),
      categoryId: this.categoryId(),
      // '' en el alta (el select no se dibuja): createStudentDraft lo pasa a null y el
      // mapper omite la clave, que es lo que el backend espera.
      studentStatusId: this.studentStatusId(),
      dominantHand: this.dominantHand(),
      ranking: this.ranking(),
      notes: this.notes(),
    });
  }
}
