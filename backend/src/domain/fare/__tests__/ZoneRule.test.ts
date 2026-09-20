import { describe, expect, it } from 'vitest';
import { ZoneRule } from '../ZoneRule.js';
import { emptyBreakdown, type FareContext } from '../types.js';

const rule = new ZoneRule();

function ctx(overrides: Partial<FareContext> = {}): FareContext {
  return {
    journeyStatus: 'COMPLETED',
    originZoneCode: '1',
    destinationZoneCode: '2',
    riderDiscountPercent: 0,
    zonePairAmountPence: 400,
    fareRuleId: 'rule-z',
    incompletePenaltyPence: 500,
    capHeadroomPence: 1500,
    ...overrides,
  };
}

describe('ZoneRule', () => {
  it('sets base fare from zone-pair amount', () => {
    const result = rule.apply(ctx(), emptyBreakdown());
    expect(result.baseFare).toBe(400);
    expect(result.fareRuleId).toBe('rule-z');
  });

  it('skips pricing for incomplete journeys', () => {
    const result = rule.apply(
      ctx({ journeyStatus: 'INCOMPLETE_ENTRY', destinationZoneCode: null }),
      emptyBreakdown(),
    );
    expect(result.baseFare).toBe(0);
  });
});
