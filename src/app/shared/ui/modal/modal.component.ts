import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';

let nextModalId = 0;

/**
 * Wrapper FINO sobre <dialog> nativo, que ya trae foco atrapado, Escape, `inert`
 * sobre el resto y ::backdrop. Lo único que agrega es cerrar al clickear el backdrop.
 *
 * ponytail: delgado a propósito. No hay servicio de modales, ni stack, ni registry,
 * ni animaciones custom — <dialog> ya hace todo eso, APILADO incluido: el reloj de
 * TimePickerFieldComponent se abre desde adentro del formulario de Horarios y el top layer
 * los ordena solo, sin que este componente sepa que hay otro abajo.
 *
 * AUTOFOCUS: showModal() enfoca SÓLO un elemento con el atributo HTML `autofocus`;
 * si no hay ninguno, enfoca el <dialog>. El CONSUMIDOR debe poner `autofocus` en su
 * primer control. Este componente no lo gestiona.
 *
 * Sin CSS propio: todas sus clases viven en styles/components.css (primitivos del DS).
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- click de backdrop-para-cerrar; el equivalente de teclado (Esc) ya lo da <dialog> nativo, no hace falta duplicarlo -->
    <dialog #dlg class="modal" [attr.aria-labelledby]="titleId"
            (click)="onBackdropClick($event)" (close)="closed.emit()">
      <div class="modal-head">
        <span class="m-ic {{ icon() }}" aria-hidden="true"><ng-content select="[modal-icon]" /></span>
        <div>
          <h3 [id]="titleId">{{ title() }}</h3>
          @if (subtitle()) { <div class="m-sub">{{ subtitle() }}</div> }
        </div>
        <button type="button" class="x" aria-label="Cerrar" (click)="close()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body"><ng-content /></div>
      <ng-content select="[modal-foot]" />
    </dialog>
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /**
   * Variantes del `.m-ic`. Presentes: danger (Onboarding) y primary (Grupos, Configuración).
   * La maqueta también tiene `wa` (docs/maquetas/index-v2.html:611), pero su consumidor llega con su slice
   * (Plantillas). Misma regla de admisión que dejó afuera a `.btn-wa`/`.btn-light`/`.btn-sm`:
   * un primitivo sin consumidor es CSS muerto.
   *
   * `primary` se llamaba `court` hasta que tuvo tres consumidores que no eran canchas: el
   * nombre describía a su primer usuario, no a lo que hace (es el esquema de color neutro).
   *
   * PARA AMPLIARLO: sumá el valor a este union Y su regla `.m-ic.<valor>` a components.css.
   * Las dos cosas, o el ícono sale sin estilo.
   */
  readonly icon = input<'danger' | 'primary'>('danger');
  readonly closed = output<void>();

  /** Id único generado: el consumidor no inventa ids (a diferencia de la maqueta). */
  protected readonly titleId = `modal-title-${nextModalId++}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  open(): void { this.dlg().nativeElement.showModal(); }
  close(): void { this.dlg().nativeElement.close(); }

  /** El ::backdrop no es un nodo: un click sobre él tiene al propio <dialog> como target. */
  protected onBackdropClick(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.close();
  }
}
