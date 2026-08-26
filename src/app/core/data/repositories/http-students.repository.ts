import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { StudentsRepository } from '@domain/contracts/students.repository';
import { Student, StudentDraft } from '@domain/entities/student';
import { StudentPlan } from '@domain/entities/student-plan';
import { PlanPurchaseDraft } from '@domain/entities/payment';
import { StudentListDtoSchema, StudentRequestSchema } from '../dto/students.dto';
import { StudentPlanListDtoSchema } from '../dto/student-plans.dto';
import { PlanPurchaseRequestSchema } from '../dto/payments.dto';
import { toStudent, toStudentPlan, toStudentRequest } from '../mappers/student.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

/**
 * ApiClient ya normaliza los errores HTTP a DomainError, pero v.parse tira ValiError fuera
 * del observable: el try/catch está para que las dos vías salgan normalizadas.
 */
@Injectable()
export class HttpStudentsRepository extends StudentsRepository {
  private readonly api = inject(ApiClient);

  async list(): Promise<Student[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/students'));
      const dtos = v.parse(StudentListDtoSchema, raw);
      // ponytail: el filtro de borrados es del cliente porque students.service.list() no
      // excluye deletedAt. Techo: además el backend no pagina, así que la lista entera
      // viaja en cada carga. Con un club de cientos de alumnos empieza a pesar. Salida
      // real: paginar y filtrar en el backend.
      return dtos.filter((d) => d.deletedAt === null).map(toStudent);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: StudentDraft): Promise<void> {
    try {
      const body = v.parse(StudentRequestSchema, toStudentRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/students', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: StudentDraft): Promise<void> {
    try {
      const body = v.parse(StudentRequestSchema, toStudentRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/students/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/students/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async plans(studentId: string): Promise<StudentPlan[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>(`/students/${studentId}/plans`));
      const dtos = v.parse(StudentPlanListDtoSchema, raw);
      // Mismo filtro de borrados que list(), por el mismo motivo: el service no lo hace.
      // El orden ya viene del backend (purchasedAt desc), así que no se reordena acá.
      return dtos.filter((d) => d.deletedAt === null).map(toStudentPlan);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  /**
   * La respuesta —`{ studentPlan, payment }`— se DESCARTA: no hay schema que la valide ni
   * pantalla que la use, y la facade re-lee `plans(studentId)`, que es la lista que se muestra.
   */
  async purchasePlan(studentId: string, draft: PlanPurchaseDraft): Promise<void> {
    try {
      const body = v.parse(PlanPurchaseRequestSchema, draft);
      await firstValueFrom(this.api.post<unknown>(`/students/${studentId}/plans`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
