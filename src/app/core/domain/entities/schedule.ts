import { InvalidScheduleError } from '../errors';
import { optionalInt } from '../optional-int';
import { shiftDateKey } from '../local-date';

/**
 * Una plantilla de horario: "los lunes de 18:00 a 19:30, en la cancha 1, el grupo
 * Cuarta/Quinta con el profe Díaz". De acá salen las ClassSession al generar.
 *
 * Casi todo es nullable porque el schema lo es: hay filas viejas sin día ni hora, y
 * generateSessions las saltea (`if (!template.startTime) continue`). La pantalla las
 * muestra con '—' en vez de esconderlas: existen, ocupan un id, y esconderlas haría que
 * el botón "Nuevo" pareciera crear duplicados.
 */
export interface Schedule {
  readonly id: string;
  readonly courtId: string;
  readonly coachId: string;
  readonly categoryGroupId: string;
  readonly sessionTypeId: string;
  /** 0 = Domingo … 6 = Sábado (§3.4). */
  readonly weekday: number | null;
  /** 'HH:mm' ya extraído del DateTime que manda el backend (§3.2). */
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly capacity: number | null;
  /**
   * Decimal sin redondear, como string. SÓLO LECTURA: el backend devuelve la columna pero
   * no acepta el campo al escribir (ver `ScheduleRequestSchema`), así que no está en
   * `ScheduleDraft` ni en `ScheduleInput`. El formateo es cosa de la pantalla.
   */
  readonly price: string | null;
  readonly active: boolean;
  /** 'YYYY-MM-DD', el formato que quiere <input type="date"> (§3.2). */
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

export interface ScheduleDraft {
  readonly courtId: string;
  readonly coachId: string;
  readonly categoryGroupId: string;
  readonly sessionTypeId: string;
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly capacity: number | null;
  readonly active: boolean;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

/** Lo que sale de los controles: todo string salvo el checkbox y los días. */
export interface ScheduleInput {
  readonly courtId: string;
  readonly coachId: string;
  readonly categoryGroupId: string;
  readonly sessionTypeId: string;
  /**
   * Uno o más días, como los emiten los chips. La plantilla del backend tiene UN weekday
   * (`ScheduleTemplate.weekday`), así que N días son N plantillas: por eso el plural vive acá
   * y no en ScheduleDraft, que sigue siendo lo que viaja en un POST.
   */
  readonly weekdays: readonly string[];
  readonly startTime: string;
  readonly endTime: string;
  readonly capacity: string;
  readonly active: boolean;
  readonly validFrom: string;
  readonly validTo: string;
}

/** 'HH:mm' de 00:00 a 23:59. <input type="time"> ya devuelve este formato o ''. */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** 'YYYY-MM-DD'. <input type="date"> ya devuelve este formato o ''. */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El valor de un chip de día. El vacío se chequea ANTES de convertir, y no es una
 * formalidad: Number('') es 0, que es un weekday VÁLIDO (domingo, §3.4) — sin esto, un chip
 * con value roto se guardaría como domingo en silencio.
 */
function parseWeekday(raw: string): number {
  if (raw.trim() === '') throw new InvalidScheduleError('Elegí al menos un día de la semana.');
  const weekday = Number(raw);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new InvalidScheduleError('Elegí al menos un día de la semana.');
  }
  return weekday;
}

/**
 * UN draft, el de la edición: una fila de la tabla es UNA plantilla, así que cambiarle el día
 * es cambiar un día. Con más de uno tira en vez de guardar el primero y perder los otros en
 * silencio.
 */
export function createScheduleDraft(input: ScheduleInput): ScheduleDraft {
  const drafts = createScheduleDrafts(input);
  if (drafts.length > 1) {
    throw new InvalidScheduleError('Se edita un día a la vez: elegí uno solo.');
  }
  return drafts[0];
}

/**
 * UN draft por día elegido: todo lo demás se valida UNA vez y se comparte. Es el alta, y es
 * el PRIMITIVO — `createScheduleDraft` es este mismo con un día. Al revés (el singular como
 * primitivo y el plural llamándolo con un día recortado) el plural tenía que doctorear su
 * argumento para esquivar la invariante del singular, y `weekdays[0]` se parseaba dos veces.
 *
 * Los días se deduplican porque dos chips iguales serían dos plantillas idénticas, y el
 * backend no tiene @@unique que las frene (§3.11).
 */
export function createScheduleDrafts(input: ScheduleInput): ScheduleDraft[] {
  // Los cuatro FK son @IsString() SIN @IsOptional(), y también en el PATCH porque
  // UpdateScheduleDto reexporta CreateScheduleDto. El backend responde 400 sin decir cuál
  // falta: validar acá es lo que permite nombrarlo.
  if (input.courtId === '') throw new InvalidScheduleError('Elegí una cancha.');
  if (input.coachId === '') throw new InvalidScheduleError('Elegí un profesor.');
  if (input.categoryGroupId === '') throw new InvalidScheduleError('Elegí un grupo de categoría.');
  if (input.sessionTypeId === '') throw new InvalidScheduleError('Elegí un tipo de clase.');

  if (input.weekdays.length === 0) {
    throw new InvalidScheduleError('Elegí al menos un día de la semana.');
  }
  const weekdays = [...new Set(input.weekdays.map(parseWeekday))];

  if (!HHMM.test(input.startTime)) throw new InvalidScheduleError('Poné una hora de inicio válida.');
  if (!HHMM.test(input.endTime)) throw new InvalidScheduleError('Poné una hora de fin válida.');
  // Comparación de strings, que sobre 'HH:mm' con cero a la izquierda ordena igual que las
  // horas ('09:30' < '18:00'). El backend NO valida esto (§3.6): un 20:00→18:00 se guarda,
  // y generateSessions crea sesiones con endAt < startAt que después no se pueden borrar.
  if (input.endTime <= input.startTime) {
    throw new InvalidScheduleError('La hora de fin tiene que ser posterior a la de inicio.');
  }

  const validFrom = input.validFrom === '' ? null : input.validFrom;
  const validTo = input.validTo === '' ? null : input.validTo;
  if (validFrom !== null && !YMD.test(validFrom)) {
    throw new InvalidScheduleError('La fecha "vigente desde" no es válida.');
  }
  if (validTo !== null && !YMD.test(validTo)) {
    throw new InvalidScheduleError('La fecha "vigente hasta" no es válida.');
  }
  // Mismo problema que createSessionGenerationDraft ya resuelve con assertRealDate: YMD sólo
  // valida la FORMA, y Date.parse rueda un día de mes imposible en silencio ('2026-02-30' →
  // '2026-03-02') en vez de dar NaN. Ambos son opcionales (el vacío ya se convirtió en null
  // arriba), así que el chequeo va sólo cuando hay valor.
  if (validFrom !== null) assertRealDate(validFrom, '"vigente desde"');
  if (validTo !== null) assertRealDate(validTo, '"vigente hasta"');
  // Igual que con las horas: comparación de strings sobre 'YYYY-MM-DD'.
  if (validFrom !== null && validTo !== null && validTo < validFrom) {
    throw new InvalidScheduleError('La vigencia "hasta" no puede ser anterior a "desde".');
  }

  const base = {
    courtId: input.courtId,
    coachId: input.coachId,
    categoryGroupId: input.categoryGroupId,
    sessionTypeId: input.sessionTypeId,
    startTime: input.startTime,
    endTime: input.endTime,
    // OJO: optionalInt tira InvalidNumberError, NO InvalidScheduleError. Es el patrón que
    // ya usa plan.ts:52, y el test correspondiente tiene que assertear esa clase (§10).
    // El mensaje dice "0 o más" y no "positivo" porque el regex de optionalInt (/^\d+$/)
    // acepta '0': el texto de plan.ts dice "positivo" y es falso ahí también.
    capacity: optionalInt(input.capacity, 'El cupo tiene que ser un número entero de 0 o más.'),
    active: input.active,
    validFrom,
    validTo,
  };
  return weekdays.map((weekday) => ({ ...base, weekday }));
}

export interface SessionGenerationInput {
  readonly from: string;
  readonly to: string;
}

export interface SessionGenerationDraft {
  readonly from: string;
  readonly to: string;
}

export interface SessionGenerationResult {
  readonly created: number;
  readonly skipped: number;
}

/**
 * El techo del rango, en días inclusive. El backend no acota nada y no existe ningún
 * endpoint que borre una ClassSession (§3.11): una vez generadas, quedan. Sesenta días son
 * dos meses, que es más de lo que un club planifica de una sentada.
 *
 * Vive en el dominio y no en el componente a propósito: es una regla sobre la operación,
 * no sobre la pantalla. Si el botón se muda, el límite se muda con él.
 */
export const MAX_GENERATION_DAYS = 60;

/** Días inclusive entre dos 'YYYY-MM-DD'. UTC para que el horario de verano no la corra. */
function inclusiveDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return ms / 86_400_000 + 1;
}

/**
 * Confirma que 'YYYY-MM-DD' sea una fecha real, no sólo con la forma correcta. Date.parse NO
 * devuelve NaN con un día de mes imposible dentro de un mes que existe: '2026-02-30' rueda en
 * silencio a '2026-03-02', así que el chequeo de NaN solo no alcanza. La única forma de
 * detectarlo es la vuelta: reserializar el resultado y compararlo contra lo que entró.
 */
function assertRealDate(ymd: string, label: string): void {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== ymd) {
    throw new InvalidScheduleError(`La fecha ${label} no es una fecha real.`);
  }
}

export function createSessionGenerationDraft(input: SessionGenerationInput): SessionGenerationDraft {
  if (!YMD.test(input.from)) throw new InvalidScheduleError('Elegí la fecha de inicio.');
  if (!YMD.test(input.to)) throw new InvalidScheduleError('Elegí la fecha de fin.');
  // Antes de comparar los strings entre sí: así el mensaje puede nombrar CUÁL de las dos
  // fechas es la imposible, en vez de caer en el "anterior" genérico de más abajo.
  assertRealDate(input.from, 'de inicio');
  assertRealDate(input.to, 'de fin');
  if (input.to < input.from) {
    throw new InvalidScheduleError('La fecha de fin no puede ser anterior a la de inicio.');
  }

  const days = inclusiveDays(input.from, input.to);
  // Con las dos fechas ya confirmadas reales por assertRealDate, este NaN es inalcanzable en
  // la práctica. Se deja como red de seguridad barata: si el día de mañana se reordena el
  // código de arriba, esta línea sigue evitando que `NaN > 60` (que es false) deje pasar un
  // rango imposible en silencio.
  if (!Number.isFinite(days)) {
    throw new InvalidScheduleError('Alguna de las fechas no es válida.');
  }
  if (days > MAX_GENERATION_DAYS) {
    throw new InvalidScheduleError(
      `El rango no puede superar los ${MAX_GENERATION_DAYS} días: las clases generadas no se pueden borrar.`,
    );
  }
  return { from: input.from, to: input.to };
}

/**
 * Cuatro semanas: el horizonte con el que trabaja un club (§4), y el default del modal.
 * INCLUSIVE, como MAX_GENERATION_DAYS — por eso los dos usos restan 1 al desplazar.
 */
const VENTANA_SIN_VIGENCIA_DIAS = 28;

/**
 * El rango con el que se generan las clases al guardar un horario: SU VIGENCIA, acotada a lo
 * que tiene sentido crear. Tres recortes, cada uno por un motivo distinto:
 *
 *  1. Arranca HOY aunque la vigencia empiece antes. Generar clases pasadas llena el calendario
 *     de historia que después nadie puede sacar: no existe DELETE de ClassSession (§3.11).
 *  2. Sin "vigente hasta", cuatro semanas.
 *  3. Nunca más de MAX_GENERATION_DAYS. Ese es el tope que valida createSessionGenerationDraft,
 *     así que una vigencia de un año no generaría "un año de clases": sería rechazada entera y
 *     no se generaría NADA. Recortar es lo único que deja el guardado útil.
 *
 * `null` cuando la vigencia ya terminó: no hay ni un día que generar, y pedirlo igual sería
 * una request para que el backend devuelva 0 y 0.
 */
export function sessionRangeForSchedule(
  vigencia: { readonly validFrom: string | null; readonly validTo: string | null },
  hoy: string,
): SessionGenerationInput | null {
  const from = vigencia.validFrom !== null && vigencia.validFrom > hoy ? vigencia.validFrom : hoy;
  if (vigencia.validTo !== null && vigencia.validTo < from) return null;
  // -1 en los dos porque cuentan días INCLUSIVE: from + 59 son 60 días contando el from.
  const tope = shiftDateKey(from, MAX_GENERATION_DAYS - 1);
  const to = vigencia.validTo ?? shiftDateKey(from, VENTANA_SIN_VIGENCIA_DIAS - 1);
  // El recorte se aplica a las DOS ramas: sobre la ventana de 28 días es un no-op demostrable
  // (28 < 60), y así no hay que leer un ternario para ver cuál de las dos queda sin acotar.
  return { from, to: to > tope ? tope : to };
}
