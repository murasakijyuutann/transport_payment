import { describe, expect, it } from 'vitest';
import { IncompleteJourneyRule } from '../IncompleteJourneyRule.js';
import { emptyBreakdown, type FareContext } from '../types.js';

const rule = new IncompleteJourneyRule();

function ctx(overrides: Partial<FareContext> = {}): FareContext {
  return {
    journeyStatus: 'INCOMPLETE_ENTRY',
    originZoneCode: '1',
    destinationZoneCode: null,
    riderDiscountPercent: 50,
    zonePairAmountPence: 0,
    incompletePenaltyPence: 500,
    ...overrides,
  };
}

describe('IncompleteJourneyRule', () => {
  it('replaces zone fare with flat penalty', () => {
    const current = {
      ...emptyBreakdown(),
      baseFare: 400,
      discount: 200,
      fareRuleId: 'keep-me',
    };
    const result = rule.apply(ctx(), current);
    expect(result.baseFare).toBe(0);
    expect(result.discount).toBe(0);
    expect(result.penalty).toBe(500);
    expect(result.fareRuleId).toBeUndefined();
  });

  it('is a no-op for completed journeys', () => {
    const current = { ...emptyBreakdown(), baseFare: 400 };
    const result = rule.apply(ctx({ journeyStatus: 'COMPLETED' }), current);
    expect(result).toEqual(current);
  });
});
