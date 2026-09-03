import { Registration } from '@domain/entities/registration';
import { Session } from '@domain/entities/session';
import { SessionDto, SignupRequest } from '../dto/auth.dto';

/**
 * Única sede de la traducción de vocabulario entre el BO y la API:
 * el BO dice role: 'profesor' | 'club'; la API dice tipo: 'particular' | 'club'.
 */
export function toSignupDto(reg: Registration): SignupRequest {
  return {
    email: reg.email,
    password: reg.password,
    tipo: reg.role === 'club' ? 'club' : 'particular',
    nombre: reg.nombre,
    apellido: reg.apellido,
    phone: reg.phone,
    // Se OMITE cuando no corresponde en vez de mandarlo vacío: el club se crea con
    // `dto.tipo === 'club' ? dto.nombreClub : dto.nombre`, y un string vacío dejaría
    // el club sin nombre.
    ...(reg.role === 'club' && reg.nombreClub ? { nombreClub: reg.nombreClub } : {}),
  };
}

export function toSession(dto: SessionDto): Session {
  return {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    mustChangePassword: dto.mustChangePassword,
  };
}
