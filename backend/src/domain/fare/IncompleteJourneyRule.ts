import type { FareContext, FareBreakdown, FareRule } from './types.js';

/**
 * Incomplete journeys: flat penalty replaces normal zone fare (v1).
 * Clears base/zone/discount and sets penalty.
 */
export class IncompleteJourneyRule implements FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown {
    if (
      context.journeyStatus !== 'INCOMPLETE_ENTRY' &&
      context.journeyStatus !== 'INCOMPLETE_EXIT'
    ) {
      return current;
    }

    return {
      ...current,
      baseFare: 0,
      zoneCharge: 0,
      timeAdjustment: 0,
      discount: 0,
      penalty: context.incompletePenaltyPence,
      fareRuleId: undefined,
    };
  }
}
