import { describe, expect, it } from 'vitest';
import { RiderCategoryRule } from '../RiderCategoryRule.js';
import { emptyBreakdown, type FareContext } from '../types.js';

const rule = new RiderCategoryRule();

function ctx(overrides: Partial<FareContext> = {}): FareContext {
  return {
    journeyStatus: 'COMPLETED',
    originZoneCode: '1',
    destinationZoneCode: '1',
    riderDiscountPercent: 50,
    zonePairAmountPence: 250,
    incompletePenaltyPence: 500,
    ...overrides,
  };
}

describe('RiderCategoryRule', () => {
  it('applies percent discount on base+zone+time', () => {
    const current = { ...emptyBreakdown(), baseFare: 400, zoneCharge: 0 };
    const result = rule.apply(ctx({ riderDiscountPercent: 50 }), current);
    expect(result.discount).toBe(200);
  });

  it('rounds discount to nearest penny', () => {
    const current = { ...emptyBreakdown(), baseFare: 250 };
    const result = rule.apply(ctx({ riderDiscountPercent: 50 }), current);
    expect(result.discount).toBe(125);
  });

  it('skips discount for incomplete journeys', () => {
    const current = { ...emptyBreakdown(), baseFare: 400 };
    const result = rule.apply(
      ctx({ journeyStatus: 'INCOMPLETE_ENTRY', riderDiscountPercent: 50 }),
      current,
    );
    expect(result.discount).toBe(0);
  });
});
