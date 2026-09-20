import { describe, expect, it } from 'vitest';
import { CapRule, preCapPence } from '../CapRule.js';
import { emptyBreakdown, type FareContext } from '../types.js';

const rule = new CapRule();

function ctx(overrides: Partial<FareContext> = {}): FareContext {
  return {
    journeyStatus: 'COMPLETED',
    originZoneCode: '1',
    destinationZoneCode: '2',
    riderDiscountPercent: 0,
    zonePairAmountPence: 400,
    incompletePenaltyPence: 500,
    capHeadroomPence: 1500,
    ...overrides,
  };
}

describe('CapRule', () => {
  it('leaves fare unchanged when under headroom', () => {
    const current = { ...emptyBreakdown(), baseFare: 400 };
    const result = rule.apply(ctx({ capHeadroomPence: 1500 }), current);
    expect(result.capAdjustment).toBe(0);
  });

  it('trims to remaining headroom', () => {
    const current = { ...emptyBreakdown(), baseFare: 400 };
    const result = rule.apply(ctx({ capHeadroomPence: 150 }), current);
    expect(result.capAdjustment).toBe(-250);
  });

  it('zeros fare when headroom exhausted', () => {
    const current = { ...emptyBreakdown(), baseFare: 400 };
    const result = rule.apply(ctx({ capHeadroomPence: 0 }), current);
    expect(result.capAdjustment).toBe(-400);
  });
});

describe('preCapPence', () => {
  it('computes pre-cap amount after discount', () => {
    expect(
      preCapPence({
        ...emptyBreakdown(),
        baseFare: 400,
        discount: 100,
        penalty: 0,
      }),
    ).toBe(300);
  });
});
