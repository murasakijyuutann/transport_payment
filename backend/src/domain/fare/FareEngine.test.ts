import { describe, expect, it } from 'vitest';
import { FareEngine } from './FareEngine.js';
import { IncompleteJourneyRule } from './IncompleteJourneyRule.js';
import { RiderCategoryRule } from './RiderCategoryRule.js';
import type { FareContext } from './types.js';
import { ZoneRule } from './ZoneRule.js';

const engine = new FareEngine([
  new ZoneRule(),
  new RiderCategoryRule(),
  new IncompleteJourneyRule(),
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
    ...overrides,
  };
}

describe('FareEngine', () => {
  it('applies zone-pair amount as base fare for adults', () => {
    const result = engine.calculate(baseContext());
    expect(result.baseFare).toBe(400);
    expect(result.discount).toBe(0);
    expect(result.originalFare).toBe(400);
    expect(result.finalFare).toBe(400);
    expect(result.fareRuleId).toBe('rule-1');
  });

  it('applies 50% student discount', () => {
    const result = engine.calculate(baseContext({ riderDiscountPercent: 50 }));
    expect(result.baseFare).toBe(400);
    expect(result.discount).toBe(200);
    expect(result.originalFare).toBe(400);
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
});
