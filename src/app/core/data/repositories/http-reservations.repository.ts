import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { ReservationsRepository } from '@domain/contracts/reservations.repository';
import { ReservationDraft } from '@domain/entities/reservation';
import { ClassPaymentDraft } from '@domain/entities/payment';
import { ClassPaymentRequestSchema } from '../dto/payments.dto';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

@Injectable()
export class HttpReservationsRepository extends ReservationsRepository {
  private readonly api = inject(ApiClient);

  /**
   * `sessionId` va en la URL y NO en el cuerpo: el ValidationPipe corre con
   * forbidNonWhitelisted, así que una clave de más devuelve 400.
   */
  async reserve(draft: ReservationDraft): Promise<void> {
    try {
      await firstValueFrom(
        this.api.post<unknown>(`/class-sessions/${draft.sessionId}/reservations`, {
          studentId: draft.studentId,
          studentPlanId: draft.studentPlanId,
        }),
      );
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async confirm(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post<unknown>(`/reservations/${id}/confirm`, {}));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Cobrar en vez de gastar un crédito. La respuesta —`{ reservation, payment }`— se descarta:
   * `SesionFacade.cobrar()` relee el roster con `GET /class-sessions/:id/reservations`
   * apenas termina esta llamada (y `GET /reservations` también existe, para otras pantallas),
   * así que no hace falta parsear esta respuesta para tener la reserva actualizada.
   */
  async confirmPayment(id: string, draft: ClassPaymentDraft): Promise<void> {
    try {
      const body = v.parse(ClassPaymentRequestSchema, draft);
      await firstValueFrom(this.api.post<unknown>(`/reservations/${id}/confirm-payment`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * Cancelar NO es sólo liberar el cupo, pero desde `584b6d3` tampoco es lo que decía este
   * comentario antes. `ReservationsService.cancel()` ya NO promueve a nadie: eso lo hace
   * `WaitingListOfferService.offerNext()`, y el controlador sólo lo llama si el body pide
   * `offerToWaitingList`. Sin esa clave el cupo queda libre y nadie se entera.
   *
   * Y la forma cambió: `offerNext()` no crea un hold para el siguiente en la fila. Marca su
   * anotación como 'notificado' con vencimiento a 15 minutos, encola un timeout y le manda un
   * WhatsApp con botones. El alumno acepta por WhatsApp y recién ahí toma el lugar. Por eso
   * quien llame a esto tiene que releer la lista de espera —la anotación cambió de estado—
   * pero NO va a ver un hold nuevo.
   *
   * `offerToWaitingList` va hardcodeado y no como parámetro del contrato: el comportamiento
   * anterior era "siempre promover" y esto lo restaura exactamente. Un booleano que el
   * llamador pueda apagar es una decisión de producto que hoy ninguna pantalla sabría tomar.
   *
   * `notify` + `reason` NO se mandan. Son la otra mitad de lo que el endpoint habilita ahora
   * —avisarle al alumno por WhatsApp con un motivo— y piden copy y un input propios. Además
   * `CancelReservationDto` exige `reason` no vacío cuando `notify` es true, así que mandar uno
   * sin el otro es un 400.
   */
  async cancel(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.api.delete<unknown>(`/reservations/${id}`, { offerToWaitingList: true }),
      );
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
