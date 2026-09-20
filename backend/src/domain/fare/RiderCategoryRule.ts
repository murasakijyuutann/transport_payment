import type { FareContext, FareBreakdown, FareRule } from './types.js';

/** Percent discount off (base + zone + time). Stored as positive reduction. */
export class RiderCategoryRule implements FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown {
    if (
      context.journeyStatus === 'INCOMPLETE_ENTRY' ||
      context.journeyStatus === 'INCOMPLETE_EXIT'
    ) {
      return current;
    }

    const percent = context.riderDiscountPercent;
    if (percent <= 0) {
      return { ...current, discount: 0 };
    }

    const subtotal = current.baseFare + current.zoneCharge + current.timeAdjustment;
    const discount = Math.round((subtotal * percent) / 100);
    return { ...current, discount };
  }
}
