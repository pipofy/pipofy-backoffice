import { NavConfig } from '@config/nav';
import { PIPOFY_ICONS } from './icons';

/** `icon` tipado contra el registro: un nombre que no existe no compila. */
type Icon = keyof typeof PIPOFY_ICONS;

const GROUPS = ['Operación', 'Gestión'] as const;

/** `group` tipado contra GROUPS: un item con un grupo que no existe no compila. */
interface Item extends Omit<NavConfig['items'][number], 'icon' | 'group'> {
  readonly icon: Icon;
  readonly group: (typeof GROUPS)[number];
}

const ITEMS: readonly Item[] = [
  { label: 'Dashboard',             short: 'Panel',      path: '/dashboard',  group: 'Operación', icon: 'dashboard',  badge: 'alerts' },
  { label: 'Grupos y Clases',       short: 'Grupos',     path: '/grupos',     group: 'Operación', icon: 'grupos' },
  { label: 'Reservas',              short: 'Reservas',   path: '/reservas',   group: 'Operación', icon: 'reservas' },
  { label: 'Alumnos y Créditos',    short: 'Alumnos',    path: '/alumnos',    group: 'Operación', icon: 'alumnos' },
  { label: 'Comercial y Pagos',     short: 'Pagos',      path: '/comercial',  group: 'Gestión',   icon: 'comercial',  badge: 'payments' },
  { label: 'Plantillas y WhatsApp', short: 'Plantillas', path: '/plantillas', group: 'Gestión',   icon: 'plantillas' },
  {
    label: 'Configuración', short: 'Config', path: '/configuracion', group: 'Gestión', icon: 'config',
    // PARA AGREGAR UNA ENTIDAD DE CONFIGURACIÓN: sumar su entrada acá Y su child route en
    // features/configuracion/configuracion.routes.ts.
    children: [
      { label: 'Club',                path: '/configuracion/club' },
      { label: 'Canchas',             path: '/configuracion/canchas' },
      { label: 'Categorías',          path: '/configuracion/categorias' },
      { label: 'Grupos de categoría', path: '/configuracion/grupos-categoria' },
      { label: 'Planes',              path: '/configuracion/planes' },
      { label: 'Profesores',          path: '/configuracion/profesores' },
      { label: 'Horarios',            path: '/configuracion/horarios' },
    ],
  },
];

export const PIPOFY_NAV: NavConfig = { groups: GROUPS, items: ITEMS };
