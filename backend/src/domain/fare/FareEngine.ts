import { emptyBreakdown, type FareBreakdown, type FareContext, type FareRule } from './types.js';

export class FareEngine {
  constructor(private readonly rules: FareRule[]) {}

  calculate(context: FareContext): FareBreakdown {
    let state = emptyBreakdown();
    for (const rule of this.rules) {
      state = rule.apply(context, state);
    }
    return finalize(state);
  }
}

/**
 * originalFare = pre-discount / pre-cap subtotal (base+zone+time+penalty)
 * finalFare = original - discount + capAdjustment (capAdjustment ≤ 0 in Phase 5)
 */
export function finalize(state: FareBreakdown): FareBreakdown {
  const originalFare =
    state.baseFare + state.zoneCharge + state.timeAdjustment + state.penalty;
  const finalFare = Math.max(0, originalFare - state.discount + state.capAdjustment);
  return {
    ...state,
    originalFare,
    finalFare,
  };
}
