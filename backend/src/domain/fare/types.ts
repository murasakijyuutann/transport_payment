export type FareJourneyStatus =
  | 'COMPLETED'
  | 'INCOMPLETE_ENTRY'
  | 'INCOMPLETE_EXIT'
  | 'EXPIRED'
  | 'CORRECTED'
  | 'OPEN';

export interface FareContext {
  journeyStatus: FareJourneyStatus;
  originZoneCode: string;
  destinationZoneCode: string | null;
  riderDiscountPercent: number;
  /** Full zone-pair tariff in pence (loaded by FareService). */
  zonePairAmountPence: number;
  fareRuleId?: string;
  incompletePenaltyPence: number;
  /** Phase 5: remaining daily cap headroom in pence. */
  capHeadroomPence?: number;
}

/** All amounts in integer pence. discount = positive reduction; capAdjustment ≤ 0. */
export interface FareBreakdown {
  baseFare: number;
  zoneCharge: number;
  timeAdjustment: number;
  discount: number;
  capAdjustment: number;
  penalty: number;
  originalFare: number;
  finalFare: number;
  fareRuleId?: string;
}

export interface FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown;
}

export function emptyBreakdown(): FareBreakdown {
  return {
    baseFare: 0,
    zoneCharge: 0,
    timeAdjustment: 0,
    discount: 0,
    capAdjustment: 0,
    penalty: 0,
    originalFare: 0,
    finalFare: 0,
  };
}
