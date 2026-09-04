import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-en-construccion',
  standalone: true,
  imports: [PlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-placeholder
      tone="wip"
      size="page"
      [title]="title"
      body="Esta sección todavía está en construcción."
    />
  `,
})
export class EnConstruccionComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title: string =
    (this.route.snapshot.data['title'] as string | undefined) ?? 'En construcción';
}
