import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * La ruta `**`. Cuelga del shell, así que llega con la sidebar puesta y el usuario
 * puede irse a otro lado; y como el shell está detrás de authGuard, una URL
 * desconocida sin sesión redirige al login antes de llegar acá.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [PlaceholderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-placeholder
      tone="error"
      size="page"
      title="No encontramos esta página"
      body="El enlace puede estar viejo o mal escrito."
    >
      <a class="btn btn-primary" routerLink="/dashboard">Volver al panel</a>
    </app-placeholder>
  `,
})
export class NotFoundPageComponent {}
