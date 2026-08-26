import { Injectable, inject } from '@angular/core';
import { CategoryGroupsRepository } from '@domain/contracts/category-groups.repository';
import { IdSetHintFacade } from '../id-set-hint.facade';
import { GrupoItemsStore } from './grupo-items-store';

/**
 * Las categorías de UN grupo. Toda la mecánica —selección optimista, rollback, pista del
 * navegador— está en `IdSetHintFacade`.
 */
@Injectable()
export class GrupoItemsFacade extends IdSetHintFacade {
  private readonly repo = inject(CategoryGroupsRepository);
  protected readonly store = inject(GrupoItemsStore);

  protected add(groupId: string, categoryId: string): Promise<void> {
    return this.repo.addItem(groupId, categoryId);
  }

  protected remove(groupId: string, categoryId: string): Promise<void> {
    return this.repo.removeItem(groupId, categoryId);
  }
}
