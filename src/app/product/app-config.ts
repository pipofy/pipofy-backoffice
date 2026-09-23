import { AppConfig } from '@config/app-config';

/**
 * Marca y copy de Pipofy. Es la superficie de producto: un producto nuevo edita este archivo,
 * product/nav.ts, product/icons.ts, styles/brand.css y public/brand/. Ver docs/TEMPLATE.md.
 */
export const PIPOFY_CONFIG: AppConfig = {
  brand: {
    name: 'PipoFy',
    tagline:
      'Gestión de clubes de pádel: grupos, créditos, pagos y WhatsApp en un solo lugar.',
    logoHorizontal: 'brand/logo-horizontal.svg',
    // ponytail: href null = las páginas no existen. Techo: un producto real las necesita.
    // Salida: crearlas y poner la ruta.
    footerLinks: [
      { label: 'Términos', href: null },
      { label: 'Privacidad', href: null },
      { label: 'Soporte', href: null },
    ],
  },
  locale: 'es-AR',
  // NO cambiar: los navegadores que ya tienen sesión/pistas guardadas las conservan.
  storagePrefix: 'PipoFy',
  /** Los cuatro roles que siembra el backend en el signup. */
  roleLabels: {
    admin: 'Administrador',
    encargado: 'Encargado',
    profesor: 'Profesor',
    superprofesor: 'Superprofesor',
  },
};
