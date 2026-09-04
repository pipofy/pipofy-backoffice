import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Los tres colorways de la barra inline, alineados con .notice.* de components.css. */
export type NoticeTone = 'bad' | 'hold' | 'ok';

/**
 * Rol ARIA por tono. Record completo por el mismo motivo que en app-placeholder:
 * agregar un tone rompe el build hasta que declare su rol.
 *
 * El primitivo es el DUEÑO del rol. Los call sites NO declaran role="alert": si lo
 * hicieran, el lector de pantalla anunciaría dos veces.
 *
 * ponytail: `hold` siempre resuelve a 'alert', sin excepción — no sirve para un banner
 * informativo PERMANENTE (el lector de pantalla lo anunciaría como si algo acabara de
 * pasar). Caso real: el aviso de generar-clases-modal.component.ts ("se van a generar
 * clases para hasta N horarios...") quedó como `.notice hold` crudo, sin app-notice, por
 * este techo — ver Task 13. Salida cuando aparezca un segundo consumidor así: un tone
 * `info` sin rol, o un input `role` opcional. No se resuelve ahora por un solo caso.
 */
const ROLE: Record<NoticeTone, 'alert' | 'status'> = {
  bad: 'alert',
  hold: 'alert',
  ok: 'status',
};

/**
 * La barra inline de aviso. `bad` es un error, `hold` una advertencia (cupos, esperas)
 * y `ok` una confirmación. Antes de este primitivo los errores se pintaban con `hold`,
 * o sea con la paleta warning: un error de red se veía igual que un aviso de cupo.
 */
@Component({
  selector: 'app-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="notice" [class]="tone()" [attr.role]="role()"><ng-content /></p>
  `,
  styles: [
    // El margen reemplaza a .form-error{margin-bottom:var(--space-md)}, duplicada
    // carácter por carácter en 11 modales antes de este primitivo. Vive acá para no
    // repetirla en el consumidor 12. display:block es obligatorio: un custom element
    // es inline por defecto y ahí margin-bottom no hace nada.
    //
    // Trampa: en un contenedor flex/grid con gap, este margin-bottom se SUMA al gap en
    // vez de colapsar contra él (eso sólo pasa en flujo normal), y el aviso queda con el
    // doble de separación. Salida: el contenedor con gap anula el margen de sus hijos con
    // `app-notice{margin-bottom:0}`, como hace auth-page.css.
    `:host{display:block;margin-bottom:var(--space-md)}`,
  ],
})
export class NoticeComponent {
  readonly tone = input<NoticeTone>('bad');

  protected readonly role = computed(() => ROLE[this.tone()]);
}
