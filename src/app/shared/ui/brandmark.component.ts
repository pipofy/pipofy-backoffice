import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@config/app-config';

/**
 * El lockup de marca. El texto ya está convertido a trazados dentro del SVG, así que no se
 * duplica en HTML. El alt mantiene el nombre accesible y el aria-label del enlace el destino.
 *
 * ponytail: un <img> no hereda currentColor, así que sobre una superficie oscura el logo
 * desaparece. Hoy no hay ninguna. Salida: un segundo campo `logoOnDark` en AppBrand.
 */
@Component({
  selector: 'app-brandmark',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brandmark" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <img class="bm-img" [src]="brand.logoHorizontal" [alt]="brand.name" />
    </a>
  `,
})
export class BrandmarkComponent {
  protected readonly brand = inject(APP_CONFIG).brand;
  readonly link = input<string>('/');
  readonly ariaLabel = input<string>(`${this.brand.name} · ir al panel`);
}
