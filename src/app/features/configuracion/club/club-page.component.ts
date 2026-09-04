import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ClubFacade } from './club.facade';
import { Club, ClubInput } from '@domain/entities/club';
import { domainErrorMessage } from '@domain/errors';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

/**
 * La ÚNICA pantalla que edita in-place, sin <dialog>. De ahí salen sus dos rarezas:
 *
 *  · el formulario sólo existe cuando data() no es null — un formulario vacío y editable
 *    sobre una carga fallida manda los cuatro nullables en null, y en esta entidad el null
 *    VACÍA de verdad (§3.8). Serían tres campos borrados sin un aviso.
 *  · dirty() + el CanDeactivate de club-can-deactivate.guard.ts. Las otras seis pantallas
 *    no lo necesitan porque showModal() pone `inert` en el resto del documento y no se
 *    puede clickear un tab con el modal abierto: el <dialog> las protegía gratis.
 */
@Component({
  selector: 'app-club-page',
  standalone: true,
  imports: [PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './club-page.component.html',
  styleUrl: './club-page.component.css',
})
export class ClubPageComponent {
  protected readonly facade = inject(ClubFacade);
  private readonly toast = inject(ToastService);

  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly address = signal('');
  protected readonly usesLeveling = signal(false);
  protected readonly holdMinutes = signal('');
  protected readonly transferAlias = signal('');

  constructor() {
    // La facade se provee en la ruta PADRE: un error de guardado o borrado queda en error()
    // indefinidamente. Sin este clearError(), volver a esta tab reconstruye la página con
    // data() ya poblado (no se llama load(), así que run() nunca lo limpia) y el banner de
    // un error viejo reaparece sobre un formulario que está perfectamente bien.
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Siembra cuando el club LLEGA por primera vez, y cuando el componente se recrea al
    // volver a este tab con la facade ya poblada (la facade sobrevive en los providers de
    // la ruta padre). Funciona porque toClub() devuelve un objeto NUEVO en cada parseo, así
    // que la referencia siempre cambia: un effect() sobre un valor Object.is-igual NO corre.
    //
    // Ese hazard es real y ya rompió cosas acá, pero hay DOS y conviene no confundirlos:
    //   · effect() sobre un INPUT que no se re-dispara → rompió los modales de canchas y
    //     categorías (slice 2026-08-01-11 del panel de configuración).
    //   · bindingUpdated haciendo Object.is sobre un [value] y no escribiendo el DOM →
    //     rompió el campo Precio del modal de planes (slice 2026-08-01).
    // El de acá es el primero. El modal de planes NUNCA tuvo un effect() sobre un input.
    //
    // La re-siembra POST-GUARDADO (mismo componente, sin recrearse) NO depende de este
    // effect: ver el comentario de seed() y su segundo llamador en onSave().
    effect(() => {
      const club = this.facade.data();
      if (club === null) return;
      this.seed(club);
    });
  }

  /** Público: lo lee el CanDeactivateFn de la ruta. */
  readonly dirty = computed(() => {
    const club = this.facade.data();
    if (club === null) return false;
    return this.name() !== club.name
      || this.phone() !== (club.phone ?? '')
      || this.address() !== (club.address ?? '')
      || this.usesLeveling() !== club.usesLeveling
      || this.holdMinutes() !== String(club.holdMinutes)
      || this.transferAlias() !== (club.transferAlias ?? '');
  });

  /**
   * ponytail-deviation del brief: el brief inlineaba esto en el effect() y confiaba en que
   * `save()` siempre reseed vía la referencia nueva de facade.data(). Eso es cierto en
   * producción (el mapper parsea un objeto nuevo por respuesta) pero NO cuando un repo
   * devuelve la MISMA referencia en dos lecturas seguidas — exactamente lo que hace el
   * mock de club-page.component.spec.ts ("guardar manda el draft y vuelve a dejar dirty()
   * en false"): con la referencia repetida, Object.is no ve cambio y el effect no vuelve a
   * correr, así que dirty() queda pegado en true tras guardar. Extraído a un método y
   * llamado también desde onSave() para no depender de esa casualidad referencial.
   */
  private seed(club: Club): void {
    this.name.set(club.name);
    this.phone.set(club.phone ?? '');
    this.address.set(club.address ?? '');
    this.usesLeveling.set(club.usesLeveling);
    this.holdMinutes.set(String(club.holdMinutes));
    this.transferAlias.set(club.transferAlias ?? '');
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected value(e: Event): string { return (e.target as HTMLInputElement).value; }
  protected checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  protected retry(): void {
    this.facade.clearError();
    void this.facade.load();
  }

  protected async onSave(): Promise<void> {
    const input: ClubInput = {
      name: this.name(),
      phone: this.phone(),
      address: this.address(),
      usesLeveling: this.usesLeveling(),
      holdMinutes: this.holdMinutes(),
      transferAlias: this.transferAlias(),
    };
    await this.facade.save(input);
    const club = this.facade.data();
    if (this.facade.error() || club === null) return;
    this.seed(club);
    this.toast.show('ok', 'Club actualizado', 'Se guardaron los datos del club.');
  }
}
