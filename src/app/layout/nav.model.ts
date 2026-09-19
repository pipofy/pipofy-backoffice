export type BadgeKey = 'alerts' | 'payments';
export type NavGroup = 'Operación' | 'Gestión';
export type NavIcon =
  | 'dashboard'
  | 'grupos'
  | 'reservas'
  | 'alumnos'
  | 'comercial'
  | 'plantillas'
  | 'config';

/** Sub-destino de la sidebar. Sin icono ni badge: es una lista de texto indentada. */
export interface NavChild {
  readonly label: string;
  readonly path: string;    // ruta absoluta
}

export interface NavItem {
  readonly label: string;   // etiqueta en la sidebar
  readonly short: string;   // etiqueta en la tab-bar móvil
  readonly path: string;    // ruta absoluta
  readonly group: NavGroup;
  readonly icon: NavIcon;
  readonly badge?: BadgeKey;
  /**
   * Con hijos, el item NO navega: despliega. La tab-bar móvil los ignora y sigue linkeando
   * a `path`, que redirige al primer hijo.
   *
   * PARA AGREGAR UNA ENTIDAD DE CONFIGURACIÓN: sumar su entrada acá Y su child route en
   * configuracion.routes.ts.
   */
  readonly children?: readonly NavChild[];
}

export const NAV_GROUPS: readonly NavGroup[] = ['Operación', 'Gestión'];

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard',             short: 'Panel',      path: '/dashboard',  group: 'Operación', icon: 'dashboard',  badge: 'alerts' },
  { label: 'Grupos y Clases',       short: 'Grupos',     path: '/grupos',     group: 'Operación', icon: 'grupos' },
  { label: 'Reservas',              short: 'Reservas',   path: '/reservas',   group: 'Operación', icon: 'reservas' },
  { label: 'Alumnos y Créditos',    short: 'Alumnos',    path: '/alumnos',    group: 'Operación', icon: 'alumnos' },
  { label: 'Comercial y Pagos',     short: 'Pagos',      path: '/comercial',  group: 'Gestión',   icon: 'comercial',  badge: 'payments' },
  { label: 'Plantillas y WhatsApp', short: 'Plantillas', path: '/plantillas', group: 'Gestión',   icon: 'plantillas' },
  {
    label: 'Configuración', short: 'Config', path: '/configuracion', group: 'Gestión', icon: 'config',
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
