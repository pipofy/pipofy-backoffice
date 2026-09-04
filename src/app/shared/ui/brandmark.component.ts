import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * El lockup de marca. El texto "Pipofy" ya está convertido a trazados dentro del
 * SVG, así que no se duplica en HTML: dos copias se desalinearían. El alt mantiene
 * el nombre accesible y el aria-label del enlace describe el destino.
 *
 * ponytail: un <img> no hereda currentColor, así que sobre una superficie oscura el
 * logo navy desaparece. Hoy no hay ninguna. Cuando la haya, la salida es la variante
 * 01b-isotipo-blanco del brandboard, que todavía no está en assets/.
 */
@Component({
  selector: 'app-brandmark',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brandmark" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <img class="bm-img" src="brand/logo-horizontal.svg" alt="Pipofy" />
    </a>
  `,
})
export class BrandmarkComponent {
  readonly link = input<string>('/');
  readonly ariaLabel = input<string>('Pipofy · ir al panel');
}
