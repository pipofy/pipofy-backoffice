import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from '@config/icons';

/** Un aviso por nombre y por carga de página, no uno por render. */
const warned = new Set<string>();

/**
 * Icono del registro del producto (ICONS). La caja (width/height/color) la pone el consumidor
 * sobre `app-icon`; el `.icon svg` global de components.css la llena.
 *
 * `bypassSecurityTrustHtml` es seguro acá y sólo acá: el registro es una constante del repo
 * (product/icons.ts) y nunca contiene entrada de usuario. No copiar este patrón para HTML que
 * venga de la API.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'icon', 'aria-hidden': 'true', '[innerHTML]': 'markup()' },
  template: '',
})
export class IconComponent {
  readonly name = input.required<string>();
  private readonly icons = inject(ICONS);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly markup = computed(() => {
    const svg = this.icons[this.name()];
    if (svg === undefined) {
      if (!warned.has(this.name())) {
        warned.add(this.name());
        console.warn(`[app-icon] no hay icono "${this.name()}" en el registro ICONS`);
      }
      return '';
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });
}
