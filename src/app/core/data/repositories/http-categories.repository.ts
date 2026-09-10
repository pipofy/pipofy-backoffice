import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as v from 'valibot';
import { CategoriesRepository } from '@domain/contracts/categories.repository';
import { Category, CategoryDraft } from '@domain/entities/category';
import { CategoryListDtoSchema, CategoryRequestSchema } from '../dto/categories.dto';
import { toCategory, toCategoryRequest } from '../mappers/category.mapper';
import { toDomainError } from '../http/to-domain-error';
import { ApiClient } from '../http/api-client';

@Injectable()
export class HttpCategoriesRepository extends CategoriesRepository {
  private readonly api = inject(ApiClient);

  async list(): Promise<Category[]> {
    try {
      const raw = await firstValueFrom(this.api.get<unknown>('/categories'));
      const dtos = v.parse(CategoryListDtoSchema, raw);
      return dtos.map(toCategory);
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async create(draft: CategoryDraft): Promise<void> {
    try {
      const body = v.parse(CategoryRequestSchema, toCategoryRequest(draft));
      await firstValueFrom(this.api.post<unknown>('/categories', body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async update(id: string, draft: CategoryDraft): Promise<void> {
    try {
      const body = v.parse(CategoryRequestSchema, toCategoryRequest(draft));
      await firstValueFrom(this.api.patch<unknown>(`/categories/${id}`, body));
    } catch (err) {
      throw toDomainError(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete<unknown>(`/categories/${id}`));
    } catch (err) {
      throw toDomainError(err);
    }
  }
}
