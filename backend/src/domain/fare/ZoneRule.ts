import type { FareContext, FareBreakdown, FareRule } from './types.js';

/** Applies the zone-pair tariff already resolved onto the context. */
export class ZoneRule implements FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown {
    if (
      context.journeyStatus === 'INCOMPLETE_ENTRY' ||
      context.journeyStatus === 'INCOMPLETE_EXIT'
    ) {
      return current;
    }

    return {
      ...current,
      baseFare: context.zonePairAmountPence,
      zoneCharge: 0,
      fareRuleId: context.fareRuleId,
    };
  }
}
