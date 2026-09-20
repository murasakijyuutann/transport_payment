// Shared interfaces mirrored by the frontend as needed.

export interface HealthResponse {
  status: string;
}

export interface AuthPayload {
  sub: string;
  accountId: string;
}

export interface AccountView {
  accountId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  riderCategory: { name: string; discountPercent: string };
  media: Array<{ token: string; mediaType: string; status: string }>;
  wallet: { balance: string; currency: string };
}

export interface StationView {
  id: string;
  code: string;
  name: string;
  zone: { id: string; code: string; name: string };
  validators: Array<{
    id: string;
    validatorCode: string;
    type: string;
    status: string;
  }>;
}

export interface StationRef {
  code: string;
  name: string;
}

export interface JourneyView {
  id: string;
  status: string;
  originStation: StationRef;
  destinationStation: StationRef | null;
  startedAt: string;
  completedAt: string | null;
}

export interface TapResult {
  tapId: string;
  tapType: 'ENTRY' | 'EXIT';
  status: 'ACCEPTED';
  journeyId: string;
  journeyStatus: 'OPEN' | 'COMPLETED';
}

export interface FareView {
  journeyId: string;
  baseFare: string;
  zoneCharge: string;
  timeAdjustment: string;
  discount: string;
  capAdjustment: string;
  penalty: string;
  originalFare: string;
  finalFare: string;
  fareRuleId: string | null;
  calculatedAt: string;
  charge: { id: string; amount: string; status: string } | null;
}

export interface LedgerEntryView {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}

export interface LedgerView {
  balance: string;
  currency: string;
  entries: LedgerEntryView[];
}

export interface CapStatusView {
  periodType: 'DAILY';
  periodStart: string;
  capAmount: string;
  chargedAmount: string;
  eligibleSpend: string;
  remainingHeadroom: string;
}
