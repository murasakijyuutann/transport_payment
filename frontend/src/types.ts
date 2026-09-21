export type UserRole = 'CUSTOMER' | 'STAFF' | 'DEVICE';

export interface AccountView {
  accountId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  riderCategory: { name: string; discountPercent: string };
  media: Array<{ token: string; mediaType: string; status: string }>;
  wallet: { balance: string; currency: string };
}

export interface AuthResult {
  token: string;
  account: AccountView;
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

export interface JourneyView {
  id: string;
  status: string;
  originStation: { code: string; name: string };
  destinationStation: { code: string; name: string } | null;
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

export interface LedgerView {
  balance: string;
  currency: string;
  entries: Array<{
    id: string;
    type: string;
    amount: string;
    balanceAfter: string;
    referenceType: string;
    referenceId: string;
    createdAt: string;
  }>;
}

export interface CapStatusView {
  periodType: 'DAILY';
  periodStart: string;
  capAmount: string;
  chargedAmount: string;
  eligibleSpend: string;
  remainingHeadroom: string;
}
