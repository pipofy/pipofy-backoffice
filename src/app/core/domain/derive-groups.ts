/**
 * Deriva grupos, roster y lista de espera a partir de entidades ya mapeadas, no de DTOs.
 * Vive en `domain` (y no en `data/mappers`, donde estuvo antes) porque sólo depende de
 * `@domain/entities/*`; la consumen tanto `data` (`HttpGroupsRepository`) como `features`
 * (`GruposFacade`), y desde acá los dos llegan sin cruzar capas.
 */
import { Group, GroupSession, GroupWaitlistEntry, RosterMember } from '@domain/entities/group';
import { Schedule } from '@domain/entities/schedule';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { Court } from '@domain/entities/court';
import { Coach } from '@domain/entities/coach';
import { CategoryGroup } from '@domain/entities/category-group';
import { Category } from '@domain/entities/category';
import { SessionReservation, asistenciaTomada } from '@domain/entities/session-reservation';
import { WaitingListEntry } from '@domain/entities/waiting-list';
import { Student } from '@domain/entities/student';

/** Guión largo (EM DASH, U+2014), como en el resto de la pantalla. */
const DASH = '—';

/**
 * Todo lo que hace falta para derivar los grupos. No es un DTO: son entidades ya mapeadas por
 * los repositorios que `HttpGroupsRepository` compone.
 */
export interface GroupsInput {
  readonly schedules: readonly Schedule[];
  readonly sessions: readonly ClassSession[];
  readonly courts: readonly Court[];
  readonly coaches: readonly Coach[];
  readonly categoryGroups: readonly CategoryGroup[];
}

/**
 * Un grupo por `ScheduleTemplate` activo, con las sesiones de la ventana agrupadas por
 * `scheduleTemplateId`.
 *
 * `now` entra por parámetro y no se lee de `new Date()` acá adentro: la función queda pura y
 * testeable, y toda la pantalla mira UN solo reloj —el de la próxima sesión y el de `yaPaso` son
 * el mismo—, que es lo que evita que una sesión salga a la vez como "próxima" y como "ya pasó".
 */
export function toGroups(input: GroupsInput, now: Date): Group[] {
  const courtName = new Map(input.courts.map((c) => [c.id, c.name]));
  const coachName = new Map(input.coaches.map((c) => [c.id, c.displayName]));
  const groupName = new Map(input.categoryGroups.map((g) => [g.id, g.name]));

  const porTemplate = new Map<string, ClassSession[]>();
  for (const s of input.sessions) {
    // Una clase creada a mano no cuelga de ninguna plantilla: no es de ningún grupo.
    if (s.scheduleTemplateId === null) continue;
    const acumuladas = porTemplate.get(s.scheduleTemplateId);
    if (acumuladas) acumuladas.push(s);
    else porTemplate.set(s.scheduleTemplateId, [s]);
  }

  return (
    input.schedules
      // Un template inactivo no genera sesiones (`generateSessions` filtra `active: true`), así
      // que listarlo sería un grupo que ya no existe.
      .filter((t) => t.active)
      .map((t) => {
        const sessions = (porTemplate.get(t.id) ?? [])
          .slice()
          .sort(porStartAt)
          .map((s) => toGroupSession(s, courtName, now));
        const proxima = sessions.find((s) => s.status === 'programada' && !s.yaPaso) ?? null;

        return {
          id: t.id,
          category: groupName.get(t.categoryGroupId) ?? DASH,
          teacher: coachName.get(t.coachId) ?? DASH,
          courtName: courtName.get(t.courtId) ?? DASH,
          weekday: t.weekday,
          startTime: t.startTime,
          // capacity sale de la MISMA sesión que enrolled y waiting, no del template: si alguien
          // edita el cupo del horario en /configuracion/horarios, las ClassSession ya generadas
          // conservan el cupo viejo, y mezclar fuentes mostraría "4/6" ofreciendo lugares que
          // reserve() va a rechazar. Cae al template sólo cuando no hay próxima sesión.
          capacity: proxima?.capacity ?? t.capacity ?? 0,
          enrolled: proxima?.enrolled ?? 0,
          waiting: proxima?.waiting ?? 0,
          nextSessionId: proxima?.id ?? null,
          sessions,
        };
      })
  );
}

/**
 * ASC por `startAt`. Se comparan los STRINGS: el backend los manda siempre en el mismo formato
 * ISO con Z, y así ordena igual que como se leen. Las sesiones sin hora van al final — existen
 * en la base pero no entran en ninguna grilla.
 */
function porStartAt(a: ClassSession, b: ClassSession): number {
  if (a.startAt === null) return b.startAt === null ? 0 : 1;
  if (b.startAt === null) return -1;
  return a.startAt.localeCompare(b.startAt);
}

function toGroupSession(s: ClassSession, courtName: Map<string, string>, now: Date): GroupSession {
  return {
    id: s.id,
    startAt: s.startAt,
    courtName: courtName.get(s.courtId) ?? DASH,
    status: s.status,
    enrolled: occupiedSpots(s),
    capacity: s.capacity,
    waiting: s.waitingCount,
    // Sin hora no se puede decir que pasó, así que no pasó: no ofrece tomar asistencia.
    yaPaso: s.startAt !== null && new Date(s.startAt).getTime() <= now.getTime(),
  };
}

/**
 * El roster de una sesión: las reservas que OCUPAN LUGAR.
 *
 * La definición es la del backend (`occupiedSpotsWhere`): `confirmed`, o `held` con el hold
 * todavía vigente. Contar distinto haría que el `enrolled` del cupo y el largo de esta tabla no
 * coincidan, y el que se equivoca siempre parece ser el número de la pantalla.
 *
 * Nada expira los holds en la base —cada query del backend los filtra en tiempo de consulta—, por
 * eso el recorte por vencimiento se hace acá.
 */
export function toRoster(
  reservations: readonly SessionReservation[],
  categories: readonly Category[],
  now: Date,
): RosterMember[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  return reservations
    .filter((r) => ocupaLugar(r, now))
    .map((r) => ({
      id: r.id,
      studentId: r.studentId,
      name: r.studentName || DASH,
      category:
        r.studentCategoryId === null ? DASH : (categoryName.get(r.studentCategoryId) ?? DASH),
      status: r.status,
      // asistenciaTomada() y no el campo crudo: /reservas ya estrecha por acá, y su propia
      // docstring dice por qué — es defensa en profundidad porque el DTO declara `string`. Si el
      // backend algún día vuelve a aplanar el RSVP de WhatsApp en este campo, un valor que no sea
      // 'asistio'/'ausente' no debe prellenar el modal como Presente.
      attendanceStatus: asistenciaTomada(r),
    }));
}

function ocupaLugar(r: SessionReservation, now: Date): boolean {
  if (r.status === 'confirmed') return true;
  if (r.status !== 'held' || r.holdExpiresAt === null) return false;
  return new Date(r.holdExpiresAt).getTime() > now.getTime();
}

/**
 * La lista de espera SÍ necesita el padrón: `WaitingListService.list()` devuelve la fila cruda,
 * sin `include: { student }`, así que el `studentId` viene pelado.
 *
 * ponytail: se carga el padrón entero para resolver dos o tres nombres. Es el patrón que ya usa
 * `/reservas`. Salida: `include: { student: true }` en ese `findMany` del backend, una línea, la
 * misma que resolvió la relectura de asistencia.
 */
export function toGroupWaitlist(
  entries: readonly WaitingListEntry[],
  students: readonly Student[],
): GroupWaitlistEntry[] {
  const nombre = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
  return entries.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    name: nombre.get(e.studentId) || DASH,
    requestedAt: e.requestedAt,
  }));
}
