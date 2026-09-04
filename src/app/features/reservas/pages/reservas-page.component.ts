import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ReservasFacade } from '../reservas.facade';
import { SesionModalComponent } from '../components/sesion-modal.component';
import { CancelarClaseModalComponent } from '../components/cancelar-clase-modal.component';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { Student } from '@domain/entities/student';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { CourtsRepository } from '@domain/contracts/courts.repository';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { CancelClassInput } from '@domain/entities/class-cancellation';
import { domainErrorMessage } from '@domain/errors';
import { localHhMm } from '@domain/local-date';
import { ToastService } from '@shared/ui/toast/toast.service';
import { NoticeComponent } from '@shared/ui/notice.component';
import { PlaceholderComponent } from '@shared/ui/placeholder.component';

@Component({
  selector: 'app-reservas-page',
  standalone: true,
  imports: [SesionModalComponent, CancelarClaseModalComponent, PlaceholderComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservas-page.component.html',
  styleUrl: './reservas-page.component.css',
})
export class ReservasPageComponent {
  protected readonly facade = inject(ReservasFacade);
  private readonly studentsRepo = inject(StudentsRepository);
  private readonly courtsRepo = inject(CourtsRepository);
  private readonly coachesRepo = inject(CoachesRepository);
  private readonly groupsRepo = inject(CategoryGroupsRepository);
  private readonly toast = inject(ToastService);

  private readonly modal = viewChild.required(SesionModalComponent);
  private readonly cancelModal = viewChild.required(CancelarClaseModalComponent);

  /** Qué se está cancelando: una clase, el día ('dia'), o nada (modal cerrado). */
  private readonly cancelando = signal<ClassSession | 'dia' | null>(null);

  protected readonly students = signal<readonly Student[]>([]);
  private readonly courtName = signal<ReadonlyMap<string, string>>(new Map());
  private readonly coachName = signal<ReadonlyMap<string, string>>(new Map());
  private readonly groupName = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    this.facade.clearError();
    if (!this.facade.data() && !this.facade.loading()) void this.facade.load();

    // Los tres catálogos de nombres y la lista de alumnos fallan en SILENCIO, igual que los
    // catálogos de Canchas: sin ellos la tabla muestra ids en vez de nombres, pero sigue
    // siendo usable, y el error de las sesiones es el que importa.
    //
    // ponytail: cuatro lecturas en paralelo (alumnos + 3 catálogos) en cada carga de esta
    // pantalla, sin cachear entre navegaciones. Techo: recién se nota con miles de alumnos.
    // Salida: un endpoint agregador — el mismo que le falta a /dashboard (ver
    // http-dashboard.repository.ts, que compone su snapshot con el mismo problema).
    void this.studentsRepo.list().then((v) => this.students.set(v)).catch(() => undefined);
    void this.courtsRepo.list()
      .then((v) => this.courtName.set(new Map(v.map((c) => [c.id, c.name]))))
      .catch(() => undefined);
    void this.coachesRepo.list()
      .then((v) => this.coachName.set(new Map(v.map((c) => [c.id, c.displayName]))))
      .catch(() => undefined);
    void this.groupsRepo.list()
      .then((v) => this.groupName.set(new Map(v.map((g) => [g.id, g.name]))))
      .catch(() => undefined);
  }

  /** Se le pasa al modal como input para que arme su subtítulo sin repetir los tres mapas. */
  protected readonly label = (s: ClassSession): string =>
    `${this.court(s)} · ${this.hora(s)} · ${this.grupo(s)}`;

  protected court(s: ClassSession): string { return this.courtName().get(s.courtId) || '—'; }
  protected coach(s: ClassSession): string { return this.coachName().get(s.coachId) || '—'; }
  protected grupo(s: ClassSession): string {
    return this.groupName().get(s.categoryGroupId) || '—';
  }

  /**
   * 'HH:mm' local. `startAt` puede ser null: Prisma lo permite y nadie lo valida — esa
   * tolerancia es de la página, `localHhMm` (domain) ya recibe un `Date` válido.
   */
  protected hora(s: ClassSession): string {
    if (s.startAt === null) return '—';
    const at = new Date(s.startAt);
    if (Number.isNaN(at.getTime())) return '—';
    return localHhMm(at);
  }

  protected cupo(s: ClassSession): string {
    return `${occupiedSpots(s)}/${s.capacity}`;
  }

  protected errorText(): string {
    const err = this.facade.error();
    return err ? domainErrorMessage(err) : '';
  }

  protected onDate(e: Event): void {
    void this.facade.setDate((e.target as HTMLInputElement).value);
  }

  protected openSession(session: ClassSession): void {
    this.modal().open(session);
  }

  /**
   * Las de la fecha que todavía NO cancelamos en esta sesión: son las que cancelDay toca.
   *
   * `computed` y no un método: el template lo consulta vía hayVigentes() y un método plano
   * volvería a filtrar la lista en CADA ciclo de detección de cambios.
   */
  private readonly vigentes = computed(() =>
    this.facade.sorted().filter((s) => !this.facade.cancelled().has(s.id)),
  );

  protected readonly hayVigentes = computed(() => this.vigentes().length > 0);

  protected estaCancelada(session: ClassSession): boolean {
    return this.facade.cancelled().has(session.id);
  }

  /** clearError() antes de abrir: sin esto un error viejo aparecería dentro del modal. */
  protected askCancelClase(session: ClassSession): void {
    this.facade.clearError();
    this.cancelando.set(session);
    this.cancelModal().open({
      what: `la clase de ${this.label(session)}`,
      affected: occupiedSpots(session),
    });
  }

  protected askCancelDia(): void {
    this.facade.clearError();
    const rows = this.vigentes();
    this.cancelando.set('dia');
    this.cancelModal().open({
      what: rows.length === 1 ? 'la única clase de este día' : `las ${rows.length} clases de este día`,
      affected: rows.reduce((n, s) => n + occupiedSpots(s), 0),
    });
  }

  protected onCancelConfirm(input: CancelClassInput): void {
    const target = this.cancelando();
    if (target === null) return;

    void (target === 'dia'
      ? this.facade.cancelarDia(input)
      : this.facade.cancelarClase(target.id, input)
    ).then(() => {
      // Sólo si salió bien: cerrar tras un error se lleva puesto el motivo ya tipeado.
      if (this.facade.error()) return;
      this.cancelModal().close();
      this.cancelando.set(null);
      // El título sale del BOTÓN que se apretó, no de cuántas clases había: apretar
      // "Cancelar el día" en un día con una sola clase igual canceló el día.
      this.toast.show(
        'ok',
        target === 'dia' ? 'Día cancelado' : 'Clase cancelada',
        input.notify ? 'Se les avisó por WhatsApp.' : 'No se envió ningún aviso.',
      );
    });
  }
}
