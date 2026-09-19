import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@config/app-config';
import { BrandmarkComponent } from './brandmark.component';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [BrandmarkComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer">
      <div class="sf-inner">
        <div class="sf-top">
          <div>
            <app-brandmark />
            @if (brand.tagline) { <p class="sf-blurb">{{ brand.tagline }}</p> }
          </div>
          <div class="sf-ctas"><ng-content /></div>
        </div>
        <div class="sf-legal">
          <!-- ponytail: sin nombre de club. El token trae clubId, no el nombre, y no vale la pena
               un GET /clubs/me acá solo para el pie. Salida: ya lo consume Configuración › Club. -->
          <span>© {{ year }} {{ brand.name }}</span>
          @if (brand.footerLinks.length) {
            <nav aria-label="Enlaces del pie">
              @for (link of brand.footerLinks; track link.label) {
                @if (link.href; as href) {
                  <a [routerLink]="href">{{ link.label }}</a>
                } @else {
                  <!-- href null = la página no existe todavía (ver AppBrand.footerLinks). -->
                  <a href="#" (click)="$event.preventDefault()">{{ link.label }}</a>
                }
              }
            </nav>
          }
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected readonly brand = inject(APP_CONFIG).brand;
  protected readonly year = new Date().getFullYear();
}
