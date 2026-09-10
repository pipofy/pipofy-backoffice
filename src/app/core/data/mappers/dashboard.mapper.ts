import { Coach } from '@domain/entities/coach';
import { Court } from '@domain/entities/court';
import { CategoryGroup } from '@domain/entities/category-group';
import {
  CourtSession,
  DashboardSnapshot,
  WaitlistEntry,
} from '@domain/entities/dashboard-snapshot';
import { occupancyPercent } from '@domain/occupancy';
import { catalogLabel } from '@data/catalog-labels';
import { CatalogItem } from '../dto/catalogs.dto';
import { ClassSession, occupiedSpots } from '@domain/entities/class-session';
import { localHhMm } from '@domain/local-date';

/**
 * El dashboard no tiene endpoint agregador: el snapshot se ensambla en el front desde cinco
 * fuentes (spec §5.2). Esta función es pura.
 */
export interface DashboardSources {
  readonly clubId: string;
  readonly courts: readonly Court[];
  readonly coaches: readonly Coach[];
  readonly categoryGroups: readonly CategoryGroup[];
  readonly surfaceTypes: readonly CatalogItem[];
  readonly sessions: readonly ClassSession[];
}

function courtMeta(court: Court, surfaceOf: ReadonlyMap<string, string>): string {
  const surfaceName = court.surfaceTypeId === null ? undefined : surfaceOf.get(court.surfaceTypeId);
  const parts = [
    surfaceName !== undefined ? catalogLabel(surfaceName) : null,
    court.indoor ? 'Techada' : 'Descubierta',
  ];
  return parts.filter((p): p is string => p !== null).join(' · ');
}

export function toDashboardSnapshot(src: DashboardSources): DashboardSnapshot {
  const courtById = new Map(src.courts.map((c, i) => [c.id, { column: i, name: c.name }]));
  const surfaceOf = new Map(src.surfaceTypes.map((s) => [s.id, s.name]));
  const coachOf = new Map(src.coaches.map((c) => [c.id, c.displayName]));
  const groupOf = new Map(src.categoryGroups.map((g) => [g.id, g.name]));

  // El filtro de fecha ya lo hizo ClassSessionsRepository.list(): lo que llega acá es del
  // día pedido. Lo que sigue vivo es la validación de startAt, que además distingue POR QUÉ
  // descarta para poder avisar.
  const todays: { readonly session: ClassSession; readonly hhmm: string; readonly at: Date }[] = [];
  for (const session of src.sessions) {
    if (session.startAt === null) {
      console.warn(`[dashboard] sesión ${session.id} sin startAt: se descarta`);
      continue;
    }
    const at = new Date(session.startAt);
    if (Number.isNaN(at.getTime())) {
      console.warn(
        `[dashboard] sesión ${session.id} con startAt inválido (${session.startAt}): se descarta`,
      );
      continue;
    }
    todays.push({ session, hhmm: localHhMm(at), at });
  }

  // Orden cronológico: hace que la celda la gane la primera sesión que se escribe, sin
  // ninguna estructura auxiliar que mantener en sincronía. `sort` es estable desde ES2019,
  // así que dos sesiones con el mismo startAt conservan el orden en que las mandó la API.
  todays.sort((a, b) => a.at.getTime() - b.at.getTime());

  // 2. Filas: horas locales distintas, ascendentes. Sin sesiones, grilla vacía.
  const hours = [...new Set(todays.map(({ hhmm }) => hhmm))].sort();
  const rowOf = new Map(hours.map((h, i) => [h, i]));

  // 3. Celdas.
  const sessions: (CourtSession | null)[][] = hours.map(() => src.courts.map(() => null));
  /**
   * Las sesiones que EFECTIVAMENTE entraron a la grilla. Sólo éstas alimentan la lista de
   * espera: una sesión descartada por cancha desconocida o por colisión de slot no se ve en
   * ningún lado, y listarla en el rail sería ofrecer una fila que no lleva a nada — encima
   * con el nombre de cancha vacío.
   */
  const placed: {
    readonly session: ClassSession;
    readonly hhmm: string;
    readonly court: string;
  }[] = [];

  for (const { session, hhmm } of todays) {
    const court = courtById.get(session.courtId);
    if (court === undefined) {
      // Pasa de verdad: CourtsRepository filtra los borrados pero /class-sessions no (§3.5).
      console.warn(
        `[dashboard] sesión ${session.id} en cancha desconocida ${session.courtId}: se descarta`,
      );
      continue;
    }
    const ci = court.column;
    const ri = rowOf.get(hhmm);
    if (ri === undefined) continue; // imposible: la hora salió de este mismo set

    if (sessions[ri][ci] !== null) {
      // ponytail: una celda = una sesión, y gana la más temprana porque `todays` viene
      // ordenado. La salida de fondo es que la celda sea una lista, no antes de que un club
      // real tenga solapamientos.
      console.warn(
        `[dashboard] slot ${hhmm}/${session.courtId} ya ocupado: se descarta la sesión ${session.id}`,
      );
      continue;
    }

    const capacity = session.capacity;
    const waiting = session.waitingCount;
    sessions[ri][ci] = {
      id: session.id,
      category: groupOf.get(session.categoryGroupId) ?? '',
      professor: coachOf.get(session.coachId) ?? '',
      occupied: occupiedSpots(session),
      capacity,
      state: session.availableSpots > 0 ? 'open' : waiting > 0 ? 'wait' : 'full',
    };
    placed.push({ session, hhmm, court: court.name });
  }

  // 4. KPIs sobre las sesiones de hoy, hayan entrado a la grilla o no.
  let occupiedSum = 0;
  let capacitySum = 0;
  for (const { session } of todays) {
    capacitySum += session.capacity;
    occupiedSum += occupiedSpots(session);
  }

  // 5. Lista de espera: una entrada por sesión VISIBLE con gente esperando.
  const waitlist: WaitlistEntry[] = [];
  for (const { session, hhmm, court } of placed) {
    const n = session.waitingCount;
    if (n === 0) continue;
    waitlist.push({
      id: session.id,
      title: `${groupOf.get(session.categoryGroupId) ?? ''} · ${court} · ${hhmm}`,
      meta: `${n} en espera · cupo lleno`,
    });
  }

  return {
    clubId: src.clubId,
    kpis: {
      sessionsToday: todays.length,
      courtsTotal: src.courts.length,
      occupancyPct: occupancyPercent(occupiedSum, capacitySum),
    },
    grid: {
      courts: src.courts.map((c) => ({ name: c.name, meta: courtMeta(c, surfaceOf) })),
      hours,
      sessions,
    },
    waitlist,
  };
}
