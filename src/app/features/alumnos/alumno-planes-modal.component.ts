import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { Student, studentDisplayName } from '@domain/entities/student';
import { StudentPlan } from '@domain/entities/student-plan';
import { domainErrorMessage } from '@domain/errors';
import { catalogLabel } from '@data/catalog-labels';
import { AlumnoPlanesFacade } from './alumno-planes.facade';

/**
 * Planes y créditos de un alumno. Se carga al ABRIR y no con la tabla: un pedido por alumno
 * en la lista sería un N+1 contra `/students/:id/plans`, que es el único endpoint que hay.
 *
 * Lee los planes y VENDE uno.
 */
@Component({
  selector: 'app-alumno-planes-modal',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal #modal title="Planes y créditos" [subtitle]="nombre()" icon="primary">
      <!-- BANNER y no una rama del chain: la facade también ESCRIBE, y un error de venta no
           puede tapar el formulario que es donde se corrige. El @else if data() de abajo es
           lo que mantiene oculta la tabla cuando lo que falló fue la CARGA. -->
      @if (errorText()) {
        <p class="notice hold form-error" role="alert">{{ errorText() }}</p>
      }

      @if (facade.loading()) {
        <p role="status">Cargando planes…</p>
      } @else if (facade.data()) {
        <p class="creditos" data-test="creditos-totales">
          <strong>{{ facade.credits() }}</strong> créditos disponibles hoy
        </p>

        @if (planes().length === 0) {
          <p class="a-empty">Este alumno todavía no compró ningún plan.</p>
        } @else {
          <!-- Sin clase ni CSS de tabla: los selectores de elemento de styles/components.css
               ya estilan table/th/td en toda la app, igual que en roster-table. -->
          <table>
            <thead>
              <tr><th>Plan</th><th>Comprado</th><th>Créditos</th><th>Vence</th></tr>
            </thead>
            <tbody>
              @for (plan of planes(); track plan.id) {
                <tr>
                  <td>{{ facade.planName(plan.planId) }}</td>
                  <td>{{ plan.purchasedAt ?? '—' }}</td>
                  <td>{{ plan.creditsRemaining ?? 0 }} / {{ plan.creditsTotal ?? 0 }}</td>
                  <td>
                    @if (plan.expiresAt === null) {
                      No vence
                    } @else if (facade.isExpired(plan)) {
                      <span class="vencido">Vencido {{ plan.expiresAt }}</span>
                    } @else {
                      {{ plan.expiresAt }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }

        <h4>Vender plan</h4>

        <div class="field field-dense">
          <label for="vp-plan">Plan</label>
          <select id="vp-plan" class="control" [value]="planId()" (change)="onPlan($event)">
            <option value="">Elegí un plan…</option>
            @for (p of facade.planCatalog(); track p.id) {
              <option [value]="p.id">{{ p.name || '(sin nombre)' }}</option>
            }
          </select>
          @if (facade.planCatalog().length === 0) {
            <p class="hint">No hay planes activos. Cargá uno en Configuración › Planes.</p>
          }
        </div>

        <div class="field field-dense">
          <label for="vp-monto">Monto cobrado</label>
          <!-- inputmode y no type="number": el monto viaja como string hasta un Decimal de
               Prisma, y un input numérico lo redondearía antes de que salga de la pantalla. -->
          <input id="vp-monto" class="control" inputmode="decimal" placeholder="0"
                 [value]="amount()" (input)="onAmount($event)" />
        </div>

        <div class="field field-dense">
          <label for="vp-medio">Medio de pago</label>
          <select id="vp-medio" class="control" [value]="methodId()" (change)="onMethod($event)">
            <option value="">Elegí un medio…</option>
            @for (m of facade.paymentMethods(); track m.id) {
              <option [value]="m.id">{{ label(m.name) }}</option>
            }
          </select>
          <!-- Mismo aviso que el select de plan: sin él, un catálogo que no cargó deja al
               usuario con "Elegí un medio de pago" y ningún medio que elegir. -->
          @if (facade.paymentMethods().length === 0) {
            <p class="hint">No se pudieron cargar los medios de pago. Reabrí el modal para reintentar.</p>
          }
        </div>

        <button type="button" class="btn btn-primary" data-test="vender"
                [disabled]="facade.loading()" (click)="onVender()">Vender plan</button>
      }
    </app-modal>
  `,
  styles: [`
    .creditos{font-size:var(--text-md);margin-bottom:var(--space-md)}
    .creditos strong{font-size:var(--text-xl);color:var(--color-primary)}
    .vencido{color:var(--color-destructive);font-weight:600}
    .form-error{margin-bottom:var(--space-md)}
    h4{margin:var(--space-md) 0 var(--space-sm)}
  `],
})
export class AlumnoPlanesModalComponent {
  protected readonly facade = inject(AlumnoPlanesFacade);
  private readonly modal = viewChild.required(ModalComponent);

  private readonly student = signal<Student | null>(null);

  /** Los tres inputs de "Vender plan". Vacío es '', igual que en el resto de los modales. */
  protected readonly planId = signal('');
  protected readonly amount = signal('');
  protected readonly methodId = signal('');

  protected label(name: string): string { return catalogLabel(name); }

  protected nombre(): string {
    const s = this.student();
    return s ? studentDisplayName(s) : '';
  }

  protected planes(): readonly StudentPlan[] {
    return this.facade.data() ?? [];
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  /** Elegir el plan pre-carga su precio de lista, que queda editable: el club cobra lo que
   *  cobra —una seña, un descuento— y el backend guarda el monto real, no el de la tabla. */
  protected onPlan(e: Event): void {
    const id = (e.target as HTMLSelectElement).value;
    this.planId.set(id);
    this.amount.set(this.facade.precioDe(id));
  }

  protected onAmount(e: Event): void { this.amount.set((e.target as HTMLInputElement).value); }
  protected onMethod(e: Event): void { this.methodId.set((e.target as HTMLSelectElement).value); }

  protected async onVender(): Promise<void> {
    const student = this.student();
    if (!student) return;
    const vendido = await this.facade.comprar(student.id, {
      planId: this.planId(),
      paymentMethodId: this.methodId(),
      amount: this.amount(),
    });
    // Se decide por la VENTA, no por error(): si la venta entró y lo que falló fue la
    // relectura, el banner lo cuenta pero el formulario TIENE que limpiarse igual — dejarlo
    // cargado invita a un segundo click que cobra dos veces.
    if (!vendido) return;
    this.resetForm();
  }

  private resetForm(): void {
    this.planId.set('');
    this.amount.set('');
    this.methodId.set('');
  }

  async open(student: Student): Promise<void> {
    this.student.set(student);
    // reset() y NO clearError(): la facade se provee en la RUTA, así que data() sobrevive al
    // cierre del modal, y run() no la limpia cuando falla. Sin esto, abrir a Bruno después de
    // Ana y que falle su GET mostraba el nombre de Bruno sobre los planes y los créditos de
    // Ana — y ofrecía vender contra esa vista.
    this.facade.reset();
    this.resetForm();
    this.modal().open();
    await this.facade.load(student.id);
  }

  close(): void {
    this.modal().close();
  }
}
