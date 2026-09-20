import { describe, expect, it } from 'vitest';
import { CapRule } from '../CapRule.js';
import { FareEngine } from '../FareEngine.js';
import { IncompleteJourneyRule } from '../IncompleteJourneyRule.js';
import { RiderCategoryRule } from '../RiderCategoryRule.js';
import type { FareContext } from '../types.js';
import { ZoneRule } from '../ZoneRule.js';
import { utcDayStart } from '../utcDay.js';

const engine = new FareEngine([
  new ZoneRule(),
  new RiderCategoryRule(),
  new IncompleteJourneyRule(),
  new CapRule(),
]);

function baseContext(overrides: Partial<FareContext> = {}): FareContext {
  return {
    journeyStatus: 'COMPLETED',
    originZoneCode: '1',
    destinationZoneCode: '2',
    riderDiscountPercent: 0,
    zonePairAmountPence: 400,
    fareRuleId: 'rule-1',
    incompletePenaltyPence: 500,
    capHeadroomPence: 1500,
    ...overrides,
  };
}

describe('FareEngine rule order', () => {
  it('applies zone-pair amount as base fare for adults', () => {
    const result = engine.calculate(baseContext());
    expect(result.baseFare).toBe(400);
    expect(result.discount).toBe(0);
    expect(result.capAdjustment).toBe(0);
    expect(result.originalFare).toBe(400);
    expect(result.finalFare).toBe(400);
    expect(result.fareRuleId).toBe('rule-1');
  });

  it('applies 50% student discount before cap', () => {
    const result = engine.calculate(baseContext({ riderDiscountPercent: 50 }));
    expect(result.baseFare).toBe(400);
    expect(result.discount).toBe(200);
    expect(result.finalFare).toBe(200);
  });

  it('replaces zone fare with incomplete penalty', () => {
    const result = engine.calculate(
      baseContext({
        journeyStatus: 'INCOMPLETE_ENTRY',
        destinationZoneCode: null,
        zonePairAmountPence: 0,
      }),
    );
    expect(result.baseFare).toBe(0);
    expect(result.discount).toBe(0);
    expect(result.penalty).toBe(500);
    expect(result.finalFare).toBe(500);
  });

  it('trims fare to remaining cap headroom', () => {
    const result = engine.calculate(baseContext({ capHeadroomPence: 150 }));
    expect(result.originalFare).toBe(400);
    expect(result.capAdjustment).toBe(-250);
    expect(result.finalFare).toBe(150);
  });

  it('charges zero when cap headroom is exhausted', () => {
    const result = engine.calculate(baseContext({ capHeadroomPence: 0 }));
    expect(result.capAdjustment).toBe(-400);
    expect(result.finalFare).toBe(0);
  });

  it('applies student discount then caps incomplete penalty to headroom', () => {
    const result = engine.calculate(
      baseContext({
        journeyStatus: 'INCOMPLETE_ENTRY',
        destinationZoneCode: null,
        zonePairAmountPence: 0,
        riderDiscountPercent: 50,
        capHeadroomPence: 200,
      }),
    );
    expect(result.penalty).toBe(500);
    expect(result.discount).toBe(0);
    expect(result.finalFare).toBe(200);
    expect(result.capAdjustment).toBe(-300);
  });
});

describe('utcDayStart', () => {
  it('uses UTC midnight for period boundaries', () => {
    const late = utcDayStart(new Date('2026-09-20T23:59:59.000Z'));
    const early = utcDayStart(new Date('2026-09-21T00:01:00.000Z'));
    expect(late.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(early.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(late.getTime()).not.toBe(early.getTime());
  });
});
