/**
 * Un grupo es un `ScheduleTemplate` con sus sesiones: "los lunes 18:00, cancha 1, 7ma+8va, con
 * Diego". El id ES el del template.
 *
 * ponytail: el roster se DERIVA de las reservas de la próxima sesión programada. En Prisma no
 * existe la inscripción a un grupo —`Reservation` cuelga de `ClassSession`—, así que no hay otra
 * fuente. Techo: quien no reservó la próxima clase no aparece aunque venga hace un año, y un
 * grupo sin próxima sesión programada muestra roster vacío. Salida: tabla `enrollment`
 * (schedule_template_id, student_id, student_plan_id, joined_at, left_at) y `listGroups()` la lee
 * en vez de derivarla. Ver el spec §3.1.
 *
 * NO lleva `name`: el título se arma con `weekdayLabel()`, que es presentación y vive en
 * `shared/`, y `core/data` no puede importar `shared/`. Lo arma `grupos-format.ts`.
 */
export interface Group {
  readonly id: string;
  /** `categoryGroup.name`. */
  readonly category: string;
  /** `coach.displayName`. */
  readonly teacher: string;
  readonly courtName: string;
  /** 0 = Domingo. La pantalla lo formatea con `weekdayLabel()`. */
  readonly weekday: number | null;
  /** 'HH:mm', ya recortado del DateTime por `toSchedule()`. */
  readonly startTime: string | null;
  readonly capacity: number;
  /** Lugares tomados en la PRÓXIMA sesión programada. 0 si no hay ninguna. */
  readonly enrolled: number;
  /** La próxima sesión programada. De acá cuelgan el roster y la lista de espera del detalle. */
  readonly nextSessionId: string | null;
  /** Orden cronológico ASCENDENTE. */
  readonly sessions: readonly GroupSession[];
}

export interface GroupSession {
  readonly id: string;
  /**
   * El ISO CRUDO del backend, sin parsear: quien lo interpreta decide en qué zona hacerlo.
   * Mismo criterio —y mismo escarmiento— que `ClassSession.startAt`.
   */
  readonly startAt: string | null;
  readonly courtName: string;
  /** El `name` crudo del catálogo: 'programada' | 'cancelada' | 'completada'. */
  readonly status: string;
  readonly enrolled: number;
  readonly capacity: number;
  /**
   * Si la sesión ya empezó. Se resuelve en el mapper, con el mismo `now` con el que se elige la
   * próxima sesión: así toda la pantalla mira un solo reloj y el template no tiene que llamar a
   * `new Date()` en cada ciclo de detección de cambios.
   *
   * ponytail: queda viejo si la pestaña se deja abierta cruzando el horario de una clase. Nadie
   * se rompe —el backend no valida la hora— y un F5 lo arregla.
   */
  readonly yaPaso: boolean;
}

/**
 * Una fila del roster.
 *
 * `id` ES el de la RESERVA, no el del alumno ni el de una inscripción: es lo que pide
 * `POST /class-sessions/:id/attendance`.
 */
export interface RosterMember {
  readonly id: string;
  readonly studentId: string;
  /** Puede venir vacío: `first_name`/`last_name` son nullables. La pantalla pone el placeholder. */
  readonly name: string;
  readonly category: string;
  /**
   * 'confirmed' o 'held'. Las dos ocupan cupo —es la definición del backend— pero el modal de
   * asistencia sólo ofrece las `confirmed`: `AttendanceService.mark()` tira 400 sobre el resto.
   */
  readonly status: string;
  /** 'asistio' | 'ausente' | null. Prellena el modal con lo ya guardado. */
  readonly attendanceStatus: string | null;
}


/**
 * Si tiene sentido tomarle asistencia a esta sesión.
 *
 * El backend no lo valida —`markBulk` sólo mira que cada reserva esté `confirmed`— así que la
 * regla vive acá: una clase que todavía no empezó no tiene asistencia que tomar, y una cancelada
 * no la va a tener nunca.
 */
export function puedeTomarAsistencia(session: GroupSession): boolean {
  return session.yaPaso && session.status !== 'cancelada';
}
