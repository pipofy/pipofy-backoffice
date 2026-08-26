import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandmarkComponent } from './brandmark.component';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [BrandmarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer">
      <div class="sf-inner">
        <div class="sf-top">
          <div>
            <app-brandmark />
            <p class="sf-blurb">
              Gestión de clubes de pádel y tenis: grupos, créditos, pagos y WhatsApp en un solo lugar.
            </p>
          </div>
          <div class="sf-ctas"><ng-content /></div>
        </div>
        <div class="sf-legal">
          <!-- ponytail: sin nombre de club. El token trae clubId, no el nombre, y no vale la pena
               un GET /clubs/me acá solo para el pie. Salida: ya lo consume Configuración › Club. -->
          <span>© 2026 SetPoint</span>
          <!-- ponytail: los tres sin handler, no llevan a ninguna parte todavía. Techo: un
               producto real necesita estas páginas y hoy no existen. Salida: crearlas
               (Términos, Privacidad, Soporte) y reemplazar el href="#" por routerLink. -->
          <nav aria-label="Enlaces del pie">
            <a href="#" (click)="$event.preventDefault()">Términos</a>
            <a href="#" (click)="$event.preventDefault()">Privacidad</a>
            <a href="#" (click)="$event.preventDefault()">Soporte</a>
          </nav>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {}
