import { Injectable, computed, inject } from '@angular/core';
import { SignalStore } from '@shared/signal-store/signal-store.base';
import { CoachesRepository } from '@domain/contracts/coaches.repository';
import { Coach, CoachInput, createCoachDraft } from '@domain/entities/coach';
import { DomainError, InvalidUserError } from '@domain/errors';
import { toDomainError } from '@data/http/to-domain-error';
import { UsersRepository } from '@data/repositories/users.repository';
import { NewUserInput, createNewUserDraft } from '@domain/entities/new-user';

/** El backend crea el CoachProfile cuando el rol se llama EXACTAMENTE así (users.service.ts). */
const ROL_PROFESOR = 'profesor';

/**
 * Sin remove: no hay endpoint para dar de baja un profesor.
 *
 * `crear()` no vive en `CoachesRepository` a propósito: crear un profesor es crear un
 * USUARIO, y esconder eso detrás de un método del contrato de coaches haría creer que
 * existe un `POST /coaches` (§4.4).
 *
 * ponytail: save() reusa `loading`, así que la tabla muestra su spinner mientras se guarda.
 * Es aceptable porque el modal la tapa — mismo techo que las otras cinco facades con tabla.
 */
@Injectable()
export class ProfesoresFacade extends SignalStore<Coach[], DomainError> {
  private readonly repo = inject(CoachesRepository);
  private readonly usersRepo = inject(UsersRepository);

  /** El backend no ordena: coaches.service.list() no tiene ORDER BY (§3.1). Sin esto,
   *  editar un profesor lo manda al final de la tabla. */
  readonly sorted = computed(() => {
    const rows = this.data() ?? [];
    return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  load(): Promise<void> {
    return this.run(this.repo.list(), toDomainError);
  }

  clearError(): void {
    this.setError(null);
  }

  /** createCoachDraft no tira, pero la cadena se arma igual que en las otras facades para
   *  que el fallo del repo salga normalizado por run()/toDomainError. */
  save(id: string, input: CoachInput): Promise<void> {
    return this.run(
      Promise.resolve()
        .then(() => this.repo.update(id, createCoachDraft(input)))
        .then(() => this.repo.list()),
      toDomainError,
    );
  }

  /**
   * Alta de profesor. Crea un USUARIO con rol 'profesor': el backend crea el `CoachProfile`
   * como efecto de asignar ese rol, y no existe `POST /coaches`.
   *
   * NO usa run(): run() no escribe data() cuando la promesa falla, y acá hay que releer en
   * las DOS ramas — `POST /users` no es atómico con el envío del mail, así que un 500 puede
   * dejar el profesor creado (§3.2). El parecido con `AlumnoPlanesFacade.comprar()` termina
   * en que ninguna de las dos usa run(): `comprar()` NO relee tras un fallo de escritura
   * (`return false` en su catch); la relectura en las DOS ramas es propia de `crear()`, por
   * la no-atomicidad de `POST /users`.
   *
   * Devuelve true si la ESCRITURA salió bien, para que la página sepa si cerrar el modal.
   */
  async crear(input: NewUserInput): Promise<boolean> {
    this.setLoading(true);
    this.setError(null);

    let creado = false;
    try {
      const roles = await this.usersRepo.roles();
      const rol = roles.find((r) => r.name === ROL_PROFESOR);
      if (!rol) {
        // §3.1: los roles se crean por club en el signup y las cuentas 'particular' sólo
        // reciben 'superprofesor'. El mensaje es específico porque el caso es real y frecuente.
        throw new InvalidUserError(
          'Tu cuenta no tiene configurado el rol de profesor. Sólo las cuentas de club pueden dar de alta profesores.',
        );
      }
      await this.usersRepo.create(createNewUserDraft(input, rol.id));
      creado = true;
    } catch (err) {
      this.setError(toDomainError(err));
    }

    // Se relee SIEMPRE, también después de un fallo (§3.2).
    try {
      this.setData(await this.repo.list());
    } catch (err) {
      // El error de la escritura gana: es el que explica qué pasó. Éste sólo llena el hueco.
      //
      // ponytail: si la escritura anduvo y sólo falló la relectura, la tabla queda
      // desactualizada hasta cambiar de tab. Techo aceptado: con la escritura ya hecha, un
      // error de red al releer no tiene arreglo del lado del cliente.
      if (!this.error()) this.setError(toDomainError(err));
    }

    this.setLoading(false);
    return creado;
  }
}
