import { IconRegistry } from '@config/icons';

/**
 * Iconos de navegación (`nav.ts`) e ilustraciones de estado (`state-*`, las usa
 * PlaceholderComponent). Markup SVG completo con `viewBox`; el tamaño lo pone el CSS del
 * consumidor. `var(--…)` resuelve contra los tokens de brand.css/tokens.css.
 */
export const PIPOFY_ICONS = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.7"/></svg>',
  grupos:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="9" r="2.4" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="9" r="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 18c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6M12.5 18c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  reservas:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  alumnos:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M4 19c0-3 2.2-5 5-5s5 2 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16 8.5a3 3 0 010 5M18 19c0-2-1-3.5-2.5-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  comercial:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke="currentColor" stroke-width="1.7"/><path d="M8 8V6a4 4 0 018 0v2M4 12h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  plantillas:
    '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9h17M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16.5" cy="15" r="3" fill="var(--color-accent-strong)" stroke="none"/></svg>',
  config:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4M17.9 17.9l-1.4-1.4M7.5 7.5L6.1 6.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',

  // Estados de PlaceholderComponent: pelota y paleta de pádel.
  'state-empty':
    '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><circle cx="9.6" cy="7.4" r="1" fill="currentColor" opacity=".45"/><circle cx="12" cy="10.2" r="1" fill="currentColor" opacity=".45"/><circle cx="14.4" cy="7.4" r="1" fill="currentColor" opacity=".45"/><path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  'state-error':
    '<svg viewBox="0 0 24 24" fill="none"><path d="M2 17h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><circle cx="17" cy="9" r="4.6" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M13.4 6.2c1.6 1.6 1.6 4 0 5.6M20.6 6.2c-1.6 1.6-1.6 4 0 5.6" stroke="currentColor" stroke-width="1.1" opacity=".55"/><path d="M4 20.5c1.6-3 3.6-5.2 6.2-6.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 2.6" opacity=".55"/></svg>',
  // La animación va inline: el markup entra por innerHTML y no recibe el scope de estilos
  // del componente. `spin` es el @keyframes global de components.css.
  'state-loading':
    '<svg viewBox="0 0 24 24" fill="none"><g style="transform-origin:12px 11px;animation:spin 900ms linear infinite"><circle cx="12" cy="11" r="5.4" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M7.7 7.7c1.9 1.9 1.9 4.7 0 6.6M16.3 7.7c-1.9 1.9-1.9 4.7 0 6.6" stroke="currentColor" stroke-width="1.1" opacity=".55"/></g><path d="M4 19.5h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35"/></svg>',
  'state-wip':
    '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="9" rx="6.5" ry="7" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 15.7h3.2l-.5 5.1a1.1 1.1 0 0 1-2.2 0l-.5-5.1Z" fill="var(--color-primary-soft)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.5 11.5h17" stroke="var(--color-warning-mark)" stroke-width="3" stroke-linecap="round"/><path d="M5 11.5h1.6M9 11.5h1.6M13 11.5h1.6M17 11.5h1.6" stroke="var(--color-surface)" stroke-width="3"/></svg>',
} satisfies IconRegistry;
