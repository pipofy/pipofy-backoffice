import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavBadgesService } from './nav-badges.service';

describe('NavBadgesService', () => {
  it('arranca sin contadores: un número inventado invita a hacerle caso', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), NavBadgesService],
    });
    const svc = TestBed.inject(NavBadgesService);
    expect(svc.counts()).toEqual({ alerts: 0, payments: 0 });
  });
});
