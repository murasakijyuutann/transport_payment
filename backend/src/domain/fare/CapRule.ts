import type { FareBreakdown, FareContext, FareRule } from './types.js';

/**
 * Trims fare to remaining daily (or other) cap headroom.
 * Sets `capAdjustment` ≤ 0; `finalize` applies it to `finalFare`.
 */
export class CapRule implements FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown {
    const headroom = context.capHeadroomPence ?? Number.POSITIVE_INFINITY;
    const preCap =
      current.baseFare +
      current.zoneCharge +
      current.timeAdjustment +
      current.penalty -
      current.discount;
    const charged = Math.min(Math.max(0, preCap), Math.max(0, headroom));
    const capAdjustment = charged - Math.max(0, preCap);
    return { ...current, capAdjustment };
  }
}

/** Pre-cap amount in pence (after discount, before cap trim). */
export function preCapPence(state: FareBreakdown): number {
  return Math.max(
    0,
    state.baseFare + state.zoneCharge + state.timeAdjustment + state.penalty - state.discount,
  );
}
