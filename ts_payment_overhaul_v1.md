# Transport Payment System Overhaul

## Overview

This document redesigns the original transport payment backend into a more realistic and auditable account-based transit payment system.

The original prototype used five core entities:

```text
User
Card
Station
Journey
Transaction
```

The redesigned model separates:

- customer/account identity
- fare media
- physical transport network
- tap events
- journeys
- fare calculation
- fare charging
- wallet accounting
- external payment transactions

The main architectural goal is to ensure that each stage in the information flow represents one clear business concept.

---

## Technology Stack

```text
Backend:   Node.js + Express + TypeScript
           ts-node for development / tsc for production build
           node-cron for scheduled jobs

Database:  PostgreSQL
           Drizzle ORM (type-safe, lightweight, SQL-first)
           node-postgres (pg) as the driver

Frontend:  Plain HTML + CSS + TypeScript
           Compiled via Vite (vanilla-ts template)
           Native fetch() + async/await — no jQuery

Testing:   Vitest (unit) + Supertest (integration)
```

### Project Structure

```text
transport-payment-system/
├── backend/
│   ├── src/
│   │   ├── routes/            # Express routers (thin — no business logic)
│   │   │   ├── tap.ts
│   │   │   ├── account.ts
│   │   │   ├── journey.ts
│   │   │   └── admin.ts
│   │   ├── services/          # Orchestration logic
│   │   │   ├── TapService.ts
│   │   │   ├── JourneyService.ts
│   │   │   ├── FareService.ts
│   │   │   └── WalletService.ts
│   │   ├── domain/            # Pure business logic — no Express, no DB
│   │   │   ├── fare/
│   │   │   │   ├── FareEngine.ts
│   │   │   │   ├── ZoneRule.ts
│   │   │   │   ├── RiderCategoryRule.ts
│   │   │   │   └── IncompleteJourneyRule.ts
│   │   │   └── journey/
│   │   │       └── JourneyStateMachine.ts
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle schema definitions
│   │   │   ├── migrations/    # SQL migration files
│   │   │   └── index.ts       # DB connection pool
│   │   ├── jobs/
│   │   │   └── incompleteJourneyJob.ts   # node-cron scheduled job
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── shared/
│   │   │   └── types.ts       # Shared TypeScript interfaces
│   │   └── app.ts
│   ├── tsconfig.json
│   └── package.json
│
└── frontend/
    ├── index.html
    ├── src/
    │   ├── main.ts
    │   ├── api.ts             # All fetch() calls, typed
    │   ├── types.ts           # Shared interfaces matching backend
    │   └── pages/
    │       ├── dashboard.ts
    │       ├── journey.ts
    │       └── account.ts
    ├── vite.config.ts
    └── package.json
```

---

# 1. Use Account-Based Ticketing

A modern transport payment backend should be designed around **Account-Based Ticketing (ABT)**.

Instead of storing most travel/payment state directly on a card:

```text
Card
 ├─ balance
 ├─ journeys
 └─ fare information
```

the physical card or device should mainly act as an identifier:

```text
Fare Media
    ↓ identifies
Transit Account
    ↓ owns
Journey / balance / fare state
```

The redesigned model becomes:

```text
                    User
                      │
                      │ owns
                      ▼
               TransitAccount
                 /         \
                /           \
               ▼             ▼
         FareMedia          Wallet
             │                │
             │                │
             ▼                ▼
          TapEvent       LedgerEntry
             │
             ▼
           Journey
             │
             ▼
       FareCalculation
             │
             ▼
          FareCharge
             │
             ▼
      PaymentTransaction
```

The physical card should not be treated as the source of truth for journeys or account state.

---

# 2. Recommended Domain Model

Divide the system into five main domains.

```text
┌─────────────────────────────┐
│ 1. Customer / Account       │
│ User                        │
│ TransitAccount              │
│ FareMedia                   │
│ Wallet                      │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 2. Transport Network        │
│ Station                     │
│ Zone                        │
│ Route                       │
│ TransportMode               │
│ Validator                   │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 3. Travel                   │
│ TapEvent                    │
│ Journey                     │
│ JourneyLeg                  │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 4. Fare                     │
│ FareProduct                 │
│ FareRule                    │
│ FareCalculation             │
│ FareCap                     │
│ RiderCategory               │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Financial                │
│ FareCharge                  │
│ WalletLedgerEntry           │
│ PaymentTransaction          │
│ Refund                      │
└─────────────────────────────┘
```

This is preferable to putting unrelated business concepts into a single `Transaction` or `Journey` entity.

---

# 3. User Should Not Be the Centre of Every Transaction

The `User` entity should represent authentication and customer identity.

Do not make journeys directly depend on `User`.

Use:

```text
User
  │
  │ 1:1 or 1:N
  ▼
TransitAccount
  │
  │ 1:N
  ▼
FareMedia
```

## User

```typescript
interface User {
  id: string;           // UUID
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: Date;
}
```

Responsibilities:

- login identity
- authentication (JWT issued on login)
- profile information
- admin/customer role

## TransitAccount

```typescript
interface TransitAccount {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  riderCategoryId: string;
  createdAt: Date;
}
```

Responsibilities:

- travel identity
- fare state
- rider category
- linked fare media
- wallet relationship

This separation allows:

```text
User = person/login identity

TransitAccount = travel/payment identity
```

An administrator can therefore be a `User` without necessarily being a passenger.

It also allows future structures such as:

```text
Parent User
    ├── Adult TransitAccount
    └── Child TransitAccount
```

---

# 4. Replace Card with FareMedia

Instead of designing only around a physical transit card, use a more general entity:

```text
FareMedia
```

Possible media types include:

- transit card
- contactless bank card
- mobile wallet
- QR code

## FareMedia

```typescript
type FareMediaType = 'TRANSIT_CARD' | 'CONTACTLESS_BANK_CARD' | 'MOBILE_WALLET' | 'QR_CODE';

interface FareMedia {
  id: string;
  transitAccountId: string;
  mediaType: FareMediaType;
  token: string;          // the identifier read by the validator
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
  issuedAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}
```

For version 1, the project can support only `TRANSIT_CARD` while still keeping the domain flexible.

---

# 5. Introduce TapEvent

`TapEvent` should be a first-class entity.

Do not directly store tap-in and tap-out as arbitrary journey fields without preserving the original events.

A tap is a real-world fact.

## TapEvent

```typescript
type TapType = 'ENTRY' | 'EXIT';
type TapStatus = 'ACCEPTED' | 'REJECTED' | 'PENDING';

interface TapEvent {
  id: string;
  mediaId: string;
  validatorId: string;
  stationId: string;
  tapType: TapType;
  eventTime: Date;      // timestamp from the validator device
  receivedAt: Date;     // timestamp when the backend received it
  status: TapStatus;
}
```

Example entry tap request body:

```json
{
  "mediaToken": "CARD-ABC-829301",
  "validatorId": "VAL-WAT-ENTRY-04",
  "timestamp": "2026-09-20T08:13:42Z"
}
```

Example exit tap request body:

```json
{
  "mediaToken": "CARD-ABC-829301",
  "validatorId": "VAL-KGX-EXIT-02",
  "timestamp": "2026-09-20T08:47:11Z"
}
```

These events allow the backend to construct:

```text
Journey
=======
origin       = Station at VAL-WAT-ENTRY-04
destination  = Station at VAL-KGX-EXIT-02
startTime    = 08:13:42
endTime      = 08:47:11
```

The important distinction is:

```text
TapEvent = fact

Journey = interpretation of facts
```

---

# 6. Add Validator

A tap should occur against a physical or logical validation device.

```text
Station
   │
   ├── Validator #A
   ├── Validator #B
   ├── Validator #C
   └── Validator #D
```

## Validator

```typescript
type ValidatorType =
  | 'ENTRY_GATE'
  | 'EXIT_GATE'
  | 'BIDIRECTIONAL_GATE'
  | 'BUS_READER'
  | 'INSPECTION_TERMINAL';

interface Validator {
  id: string;
  stationId: string;
  validatorCode: string;
  type: ValidatorType;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  lastHeartbeatAt: Date | null;
}
```

The tap endpoint:

```http
POST /api/taps
```

The backend resolves the validator, infers tap direction, and creates the TapEvent.

---

# 7. Separate Station and Zone

Instead of:

```typescript
// Avoid — zone embedded in station
interface Station {
  id: string;
  name: string;
  zone: number;
}
```

use separate entities:

```typescript
interface Zone {
  id: string;
  code: string;    // e.g. "1", "2", "A"
  name: string;
}

interface Station {
  id: string;
  name: string;
  zoneId: string;  // FK → Zone
}
```

Example:

```text
Zone 1
 ├── Central
 ├── City Hall
 └── Museum

Zone 2
 ├── Riverside
 ├── Airport East
 └── Green Park
```

Now the fare engine can reason about `Zone 1 → Zone 3` without embedding tariff logic inside the station itself.

---

# 8. Add Route, Network, and TransportMode

This is optional for version 1 but recommended in the domain model.

## TransportMode

```typescript
type TransportMode = 'TRAIN' | 'METRO' | 'BUS' | 'TRAM' | 'FERRY';
```

## Route

```typescript
interface Route {
  id: string;
  name: string;
  mode: TransportMode;
  operatorId: string;
}
```

This matters because fares may depend on more than zones.

Example:

```text
Airport Express:   Zone 1 → Zone 3 = £12
Normal Metro:      Zone 1 → Zone 3 = £5
```

The zones are the same, but the route or service type changes the fare.

---

# 9. Journey Should Be Created from TapEvents

## Journey

```typescript
type JourneyStatus =
  | 'OPEN'
  | 'COMPLETED'
  | 'INCOMPLETE_ENTRY'
  | 'INCOMPLETE_EXIT'
  | 'EXPIRED'
  | 'CORRECTED';

interface Journey {
  id: string;
  transitAccountId: string;
  mediaId: string;
  entryTapId: string;
  exitTapId: string | null;
  originStationId: string;
  destinationStationId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  status: JourneyStatus;
}
```

Example flow:

```text
CARD tapped at Paddington
        ↓
TapEvent #1001
        ↓
Journey #501
status = OPEN
```

Later:

```text
CARD tapped at King's Cross
        ↓
TapEvent #1019
        ↓
Journey #501
status = COMPLETED
```

Then:

```text
fareEngine.calculate(journey)
```

---

# 10. Incomplete Journey Behaviour

An incomplete journey should be a natural state in the model.

Example:

```text
08:00
ENTRY tap
    ↓
Journey OPEN

12:00
no EXIT
    ↓
maxJourneyDuration reached

12:01
Journey
status = INCOMPLETE_ENTRY
```

Then:

```text
FareEngine
     ↓
IncompleteJourneyRule
     ↓
£5.00 penalty
```

In Node.js, the timeout job uses `node-cron`:

```typescript
import cron from 'node-cron';

// Runs every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await journeyService.expireOpenJourneys();
});
```

This is cleaner than placing timeout checks randomly inside general journey logic.

---

# 11. Do Not Let Journey Calculate Its Own Fare

Fare calculation should be handled by a dedicated fare engine.

```text
Journey
   │
   ▼
FareContext
   │
   ▼
FareEngine
   │
   ├── ZoneRule
   ├── TimeRule
   ├── RiderCategoryRule
   ├── TransferRule
   ├── IncompleteJourneyRule
   └── CapRule
   │
   ▼
FareCalculation
```

In TypeScript, each rule implements a shared interface:

```typescript
interface FareRule {
  apply(context: FareContext): FareAdjustment;
}

class ZoneRule implements FareRule {
  apply(context: FareContext): FareAdjustment { ... }
}

class IncompleteJourneyRule implements FareRule {
  apply(context: FareContext): FareAdjustment { ... }
}
```

This prevents the `Journey` domain model from becoming overloaded with pricing policy. It also makes each rule independently unit-testable with Vitest.

---

# 12. Introduce FareRule

Simple prototype pricing might begin with hardcoded config:

```typescript
// config/fareConfig.ts
export const fareConfig = {
  baseFare: 2.50,
  perZoneCharge: 1.50,
  incompleteJourneyPenalty: 5.00,
  dailyCapAmount: 15.00,
  maxJourneyDurationHours: 4,
};
```

But real pricing should eventually become data-driven via a `fare_rules` table in PostgreSQL.

## FareRule

```typescript
interface FareRule {
  id: string;
  ruleType: string;
  originZoneId: string | null;
  destinationZoneId: string | null;
  transportMode: TransportMode | null;
  riderCategoryId: string | null;
  timeBandId: string | null;
  amount: number;
  priority: number;
  validFrom: Date;
  validUntil: Date | null;
}
```

Example data:

```text
Zone 1 → Zone 1 = £2.50
Zone 1 → Zone 2 = £4.00
Zone 1 → Zone 3 = £5.50
```

This is preferable to hardcoding:

```typescript
// Avoid
const fare = baseFare + zoneDifference * perZoneCharge;
```

because tariff policy may later introduce:

```text
Airport route surcharge = £3
Weekend fare = £2
Student = 50%
Peak Zone 1-4 = £6.80
```

---

# 13. Add FareProduct

## FareProduct

```typescript
type FareProductType =
  | 'SINGLE_JOURNEY'
  | 'DAILY_PASS'
  | 'WEEKLY_PASS'
  | 'AIRPORT_EXPRESS'
  | 'STUDENT_SINGLE';

interface FareProduct {
  id: string;
  name: string;
  type: FareProductType;
  price: number;
  currency: string;   // 'GBP', 'JPY', etc.
}
```

A fare engine may select a product dynamically.

Example:

```text
Journey
   ↓
matches Zone1ToZone3AdultPeak
   ↓
FareProduct → £5.50
```

---

# 14. Add RiderCategory

## RiderCategory

```typescript
interface RiderCategory {
  id: string;
  name: 'ADULT' | 'STUDENT' | 'CHILD' | 'SENIOR';
  discountPercent: number;   // 0 = no discount, 50 = 50% off
}
```

Relationship:

```text
TransitAccount
       │
       ▼
RiderCategory
```

Do not hard-code fare eligibility:

```typescript
// Avoid
if (user.age < 18) { ... }

// Prefer — rider category is stored business data
const discount = account.riderCategory.discountPercent;
```

---

# 15. Store FareCalculation

Fare calculation should be auditable.

Do not merely calculate and discard the reasoning:

```typescript
// Avoid — result only, no audit trail
const fare = fareEngine.calculate(journey);
```

## FareCalculation

```typescript
interface FareCalculation {
  id: string;
  journeyId: string;
  baseFare: number;
  zoneCharge: number;
  timeAdjustment: number;
  discount: number;
  capAdjustment: number;
  penalty: number;
  originalFare: number;
  finalFare: number;
  fareRuleId: string | null;
  calculatedAt: Date;
  version: number;
}
```

Example breakdown:

```text
Base fare             £2.50
Zone surcharge        £3.00
Student discount     -£1.10
Daily cap adjustment -£0.90
--------------------------------
Final fare             £3.50
```

This allows the system to answer:

> Why was this passenger charged £3.50?

That is valuable for:

- customer support
- debugging
- auditing
- financial reconciliation
- interview discussion

---

# 16. Separate FareCharge from PaymentTransaction

A generic entity called `Transaction` is too ambiguous.

It could mean:

```text
tap
fare
wallet deduction
bank charge
refund
top-up
```

Use separate domain entities:

```text
FareCharge
PaymentTransaction
WalletLedgerEntry
```

---

# 17. FareCharge

`FareCharge` represents the transport system's financial claim for travel.

## FareCharge

```typescript
type FareChargeStatus = 'PENDING' | 'CHARGED' | 'WAIVED' | 'REFUNDED';

interface FareCharge {
  id: string;
  journeyId: string;
  fareCalculationId: string;
  accountId: string;
  amount: number;
  status: FareChargeStatus;
  chargedAt: Date;
}
```

Meaning:

> Journey 501 costs £4.00 and the passenger owes that amount.

This is distinct from money actually entering or leaving an external bank account.

---

# 18. WalletLedgerEntry

If the system supports stored value, use a wallet with an immutable ledger.

## Wallet

```typescript
interface Wallet {
  id: string;
  accountId: string;
  balance: number;    // current balance — derived from ledger, kept for fast reads
  currency: string;
}
```

## WalletLedgerEntry

```typescript
type LedgerEntryType = 'TOP_UP' | 'FARE' | 'REFUND' | 'ADJUSTMENT';

interface WalletLedgerEntry {
  id: string;
  walletId: string;
  type: LedgerEntryType;
  amount: number;         // positive = credit, negative = debit
  balanceAfter: number;   // snapshot after this entry
  referenceType: string;  // 'FARE_CHARGE' | 'PAYMENT_TRANSACTION' | etc.
  referenceId: string;
  createdAt: Date;
}
```

Example history:

```text
09:00 TOP_UP       +£30.00 → £30.00
10:12 FARE          -£4.00 → £26.00
12:22 FARE          -£3.00 → £23.00
15:01 REFUND        +£1.50 → £24.50
```

This is much safer and more auditable than:

```typescript
// Avoid — no history, no audit trail
wallet.balance -= fare;
await walletRepo.save(wallet);
```

In PostgreSQL, `WalletLedgerEntry` rows are append-only. Never update or delete them.

---

# 19. PaymentTransaction

`PaymentTransaction` should represent external money movement.

## PaymentTransaction

```typescript
type PaymentTransactionType = 'TOP_UP' | 'BANK_CHARGE' | 'REFUND' | 'DEBT_RECOVERY';
type PaymentTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface PaymentTransaction {
  id: string;
  accountId: string;
  type: PaymentTransactionType;
  provider: string;            // 'MOCK' in Phase 1, 'STRIPE' later
  providerReference: string | null;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  createdAt: Date;
  completedAt: Date | null;
}
```

Conceptual distinction:

```text
PaymentTransaction  →  "Did £20 enter the transport system from Visa?"
FareCharge          →  "How much did the passenger owe for Journey 501?"
WalletLedgerEntry   →  "How did the stored-value balance change?"
```

These are three different questions and should be separate entities.

---

# 20. Support Aggregated Payment

Open-loop transit systems may aggregate travel before charging the payment provider.

Example:

```text
Tap
Tap
Tap
Tap
    ↓
Journeys
    ↓
Fare calculations
    ↓
Daily aggregation
    ↓
ONE payment transaction
```

This is different from charging the card on every tap. That is another reason why travel and external payment must be separated.

In Phase 1, top-up is mocked — a simple POST request credits the wallet directly without a real payment provider.

---

# 21. Daily Capping Should Be Its Own Concept

Do not put cap logic directly into `JourneyService`.

Instead introduce a fare cap domain.

## FareCap

```typescript
interface FareCap {
  id: string;
  capType: 'DAILY' | 'WEEKLY';
  amount: number;
  scope: 'ALL_ZONES' | 'ZONE_1_2' | string;
  validFrom: Date;
  validTo: Date | null;
}
```

## FareAccumulator

```typescript
type PeriodType = 'DAILY' | 'WEEKLY';

interface FareAccumulator {
  accountId: string;
  periodType: PeriodType;
  periodStart: Date;        // midnight of the day (UTC)
  eligibleSpend: number;
  chargedAmount: number;
  capAmount: number;
}
```

Example daily flow:

```text
Journey #1 = £5    → Daily total = £5
Journey #2 = £6    → Daily total = £11
Journey #3 = £5    → Cap headroom = £4    → Charged = £4    → Daily total = £15
Journey #4 = £5    → Cap headroom = £0    → Charged = £0
```

This is much more extensible than:

```typescript
// Avoid
if (todaysTotal > 15) {
  fare = 0;
}
```

**Important:** The `FareAccumulator` period resets at midnight. Use UTC timestamps consistently across PostgreSQL and Node.js to avoid timezone drift bugs.

---

# 22. Complete Tap-In Information Flow

```text
Passenger
    │
    │ taps card
    ▼
Validator
    │
    │ mediaToken, validatorId, timestamp
    ▼
POST /api/taps
    │
    ▼
TapService
    │
    ├─ resolve FareMedia by token
    ├─ resolve TransitAccount
    ├─ check media status (ACTIVE?)
    ├─ check account status (ACTIVE?)
    └─ INSERT TapEvent (status = ACCEPTED)
             │
             ▼
       JourneyService
             │
             ├─ query: open journey for this account?
             │
             └─ none found
                    │
                    ▼
             INSERT Journey
             status = OPEN
             entryTapId = TapEvent.id
```

No fare needs to be finalized at tap-in. The response to the validator should be fast — resolve and insert, nothing more.

---

# 23. Complete Tap-Out Information Flow

```text
Passenger
    │
    ▼
POST /api/taps  (EXIT)
    │
    ▼
TapService → INSERT TapEvent
    │
    ▼
JourneyService
    │
    ├─ find OPEN journey for account
    ├─ set exitTapId
    ├─ set destinationStationId
    ├─ set completedAt
    └─ set status = COMPLETED
             │
             ▼
        FareService
             │
             ▼
         FareEngine
             │
      ┌──────┼────────┐
      │      │        │
     Zone   Time    Rider
     Rule   Rule  Category
      │      │        │
      └──────┼────────┘
             ▼
      INSERT FareCalculation
             │
             ▼
         CapService
         (apply daily cap headroom)
             │
             ▼
      INSERT FareCharge
             │
             ▼ (single DB transaction)
        WalletService
             │
             ├─ UPDATE wallet.balance
             └─ INSERT WalletLedgerEntry
```

The `FareCharge` insert and `WalletLedgerEntry` insert must be wrapped in a single PostgreSQL transaction:

```typescript
await db.transaction(async (trx) => {
  await trx.insert(fareCharges).values(charge);
  await trx.insert(walletLedgerEntries).values(ledgerEntry);
  await trx.update(wallets).set({ balance: newBalance }).where(...);
});
```

If any step fails, nothing commits.

---

# 24. Incomplete Journey Processing Flow

```text
ENTRY tap
    ↓
Journey OPEN
    ↓
4 hours pass  (node-cron job runs every 5 minutes)
    ↓
journeyService.expireOpenJourneys()
    ↓
Journey = INCOMPLETE_ENTRY
    ↓
IncompleteJourneyFareRule
    ↓
£5.00 penalty
    ↓
FareCalculation
    ↓
FareCharge
    ↓
WalletLedgerEntry
```

A later correction could work like this:

```text
Customer submits missing exit station
        ↓
POST /api/journeys/:id/correct
        ↓
JourneyService.correctJourney()
        ↓
recalculate fare
        ↓
old £5.00 charge  →  actual £3.00 fare
        ↓
INSERT Refund (£2.00)
        ↓
INSERT WalletLedgerEntry (REFUND +£2.00)
```

---

# 25. Resulting Entity Relationships

## Customer / Travel Side

```text
User
 │ 1
 │
 │ 1
TransitAccount
 │
 ├────────────── 1:N ───────────── FareMedia
 │                                  │
 │                                  ▼
 │                              TapEvent
 │                                  │
 │                                  ▼
 │                              Journey
 │                                  │
 │                                  ▼
 │                           FareCalculation
 │                                  │
 │                                  ▼
 │                             FareCharge
 │
 ├────────────── 1:1 ───────────── Wallet
 │                                  │
 │                                  ▼
 │                           WalletLedgerEntry
 │
 └────────────── 1:N ───── PaymentTransaction
```

## Transport Network

```text
Zone
 │
 └── Station
       │
       └── Validator
             │
             └── TapEvent
```

## Fare Domain

```text
RiderCategory ──── TransitAccount

FareRule
 ├─ originZoneId
 ├─ destinationZoneId
 ├─ transportMode
 ├─ riderCategoryId
 └─ timeBandId
       │
       ▼
  FareProduct
```

---

# 26. Revised Entity List

The original model:

```text
User
Card
Station
Journey
Transaction
```

evolves into:

```text
CORE ACCOUNT
------------
User
TransitAccount
FareMedia
Wallet

NETWORK
-------
Zone
Station
Validator
Route

TRAVEL
------
TapEvent
Journey

FARE
----
FareProduct
FareRule
FareCalculation
FareCap
FareAccumulator
RiderCategory

FINANCIAL
---------
FareCharge
WalletLedgerEntry
PaymentTransaction
Refund
```

Not all entities need to be implemented in version 1, but the architecture should account for them.

---

# 27. PostgreSQL Schema Notes

Use `uuid` primary keys throughout:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

Use `NUMERIC(10, 2)` for all monetary amounts — never `FLOAT` or `REAL`:

```sql
amount NUMERIC(10, 2) NOT NULL
```

Use `TIMESTAMPTZ` (timestamp with timezone) for all timestamps to avoid midnight-boundary bugs with daily capping:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Enforce card uniqueness at the database level:

```sql
-- Only one open journey per transit account
CREATE UNIQUE INDEX one_open_journey_per_account
  ON journeys (transit_account_id)
  WHERE status = 'OPEN';
```

Wallet ledger entries are append-only. Enforce at the application layer — never `UPDATE` or `DELETE` a `wallet_ledger_entries` row.

---

# 28. Frontend Notes (Vite + TypeScript)

The frontend is compiled TypeScript with no framework. All API calls use native `fetch()`.

Initialise the frontend:

```bash
npm create vite@latest frontend -- --template vanilla-ts
```

All API calls live in `api.ts`, typed against the same interfaces as the backend:

```typescript
// frontend/src/api.ts

import type { TapResult, Journey, WalletLedgerEntry } from './types';

const BASE = '/api';

export async function postTap(mediaToken: string, validatorId: string): Promise<TapResult> {
  const res = await fetch(`${BASE}/taps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaToken, validatorId, timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getJourneyHistory(accountId: string): Promise<Journey[]> {
  const res = await fetch(`${BASE}/accounts/${accountId}/journeys`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Vite's dev server proxies `/api` requests to the Express backend during development:

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

---

# 29. Recommended Portfolio Scope

Do not try to reproduce a full production transit network immediately.

A strong portfolio scope would be:

```text
Phase 1 — Core (build this first)

Account-based backend
Fare media: proprietary transit card
Network: stations + zones
Travel: tap-in, tap-out, incomplete journeys
Pricing: zone-based fare, adult/student fares, daily cap
Payment: prepaid wallet, top-up (mocked), fare deduction
Audit: fare calculation breakdown, immutable wallet ledger
Frontend: account dashboard, journey history, wallet balance
```

Phase 2 (add after Phase 1 is fully working):

```text
Open-loop contactless bank card support
Weekly capping
Peak / off-peak fares
Multiple transport modes
Auto top-up trigger
Journey correction + refund workflow
Payment aggregation
Debt recovery
```

---

# 30. Build Phases

## Phase 0 — Project Setup (1–2 days)

Goal: running skeleton with database connected.

```text
✓ Initialise backend: npm init, TypeScript, Express, ts-node
✓ Initialise frontend: Vite vanilla-ts
✓ Connect PostgreSQL locally (Docker recommended)
✓ Set up Drizzle ORM + first migration
✓ Basic Express app.ts with health check route
✓ Vite proxy configured to backend
✓ Shared types.ts accessible to both sides
```

Deliverable: `GET /api/health` returns `{ status: "ok" }`. Frontend loads in browser.

---

## Phase 1 — Account & Network (3–4 days)

Goal: data foundation. Nothing moves yet, but all the reference data exists.

```text
✓ DB tables: users, transit_accounts, fare_media, wallets
✓ DB tables: zones, stations, validators
✓ DB tables: rider_categories
✓ Seed script: 2 zones, 6 stations, 1 validator per station
✓ Seed script: adult and student rider categories
✓ POST /api/auth/register
✓ POST /api/auth/login  (JWT)
✓ GET  /api/account     (current account + wallet balance)
✓ POST /api/wallet/topup  (mock — no real payment provider)
✓ Admin: GET /api/admin/stations
```

Deliverable: register a user, log in, top up wallet, see balance.

---

## Phase 2 — Tap & Journey Core (4–5 days)

Goal: the heart of the system. A card tap creates events and journeys.

```text
✓ DB tables: tap_events, journeys
✓ POST /api/taps  (handles both ENTRY and EXIT)
✓ TapService: resolve media token → FareMedia → TransitAccount
✓ JourneyService: create journey on ENTRY
✓ JourneyService: complete journey on EXIT
✓ GET  /api/account/journeys  (journey history)
✓ GET  /api/account/journeys/:id  (single journey detail)
```

Deliverable: simulate a full trip — tap in at Station A, tap out at Station B, journey record created and completed.

---

## Phase 3 — Fare Engine (4–5 days)

Goal: calculate and record the cost of every journey.

```text
✓ DB tables: fare_rules, fare_calculations, fare_charges
✓ Seed fare_rules: zone-pair lookup table (Zone1→Zone1, Zone1→Zone2, etc.)
✓ FareEngine with ZoneRule
✓ RiderCategoryRule (adult = full, student = 50%)
✓ IncompleteJourneyRule (flat £5 penalty)
✓ FareCalculation INSERT on journey completion
✓ FareCharge INSERT on journey completion
✓ GET /api/account/journeys/:id/fare  (fare breakdown)
```

Deliverable: completing a journey produces a stored fare breakdown showing base fare, zone charge, discount, and final fare.

---

## Phase 4 — Wallet Deduction & Ledger (2–3 days)

Goal: fare charges actually deduct from the wallet with a full audit trail.

```text
✓ DB table: wallet_ledger_entries
✓ WalletService: atomic FareCharge + LedgerEntry + balance update
✓ Single PostgreSQL transaction wrapping all three writes
✓ GET /api/account/wallet/ledger  (full ledger history)
✓ Insufficient balance handling (reject tap-out if balance < fare)
```

Deliverable: after a trip, the wallet balance is reduced and the ledger shows the deduction. Top-up shows as a credit entry.

---

## Phase 5 — Daily Cap (3–4 days)

Goal: passengers are never charged more than the daily cap.

```text
✓ DB tables: fare_caps, fare_accumulators
✓ Seed: daily cap = £15
✓ CapService: query today's eligible spend for account
✓ FareEngine: CapRule — trim fare to remaining cap headroom
✓ FareAccumulator: update after each charge
✓ Midnight reset (UTC) — verified with tests
✓ GET /api/account/cap-status  (today's spend vs cap)
```

Deliverable: after enough journeys in a day, subsequent fares are reduced to zero. Cap status visible on dashboard.

---

## Phase 6 — Incomplete Journey Job (2 days)

Goal: unpaid open journeys are automatically penalised.

```text
✓ node-cron job: runs every 5 minutes
✓ Query: journeys with status=OPEN and startedAt > 4 hours ago
✓ JourneyService.expireOpenJourneys()
✓ Apply IncompleteJourneyRule via FareEngine
✓ Write FareCalculation + FareCharge + LedgerEntry
✓ Test: manually open a journey, wait for job, verify penalty applied
```

Deliverable: a journey left open for 4+ hours is automatically closed and penalised.

---

## Phase 7 — Frontend Dashboard (3–4 days)

Goal: a usable UI over the completed backend.

```text
✓ Login / register page
✓ Account dashboard: balance, rider category, linked card token
✓ Simulate tap page: enter mediaToken + stationId, POST to /api/taps
✓ Journey history: list with status, origin, destination, fare
✓ Journey detail: full fare breakdown (base, zone, discount, cap, final)
✓ Wallet ledger: chronological list with running balance
✓ Top-up form
```

Deliverable: full end-to-end demo usable in a browser without touching the API directly.

---

## Phase 8 — Polish & Portfolio Prep (2–3 days)

Goal: make it presentable.

```text
✓ README with architecture diagram and domain model
✓ Seed script producing a realistic demo dataset
✓ API documentation (inline comments or simple markdown)
✓ Unit tests for FareEngine rules (Vitest)
✓ Integration test for tap-in → tap-out → fare → ledger flow (Supertest)
✓ Environment config via .env (DATABASE_URL, JWT_SECRET, PORT)
✓ tsconfig.json strict mode enabled throughout
```

---

# Final Architectural Principle

The information flow should be:

```text
             REAL-WORLD EVENT
                    │
                    ▼
                 TapEvent
                 "What physically happened?"
                    │
                    ▼
                 Journey
                 "What trip did those events represent?"
                    │
                    ▼
             FareCalculation
             "What should this trip cost, and why?"
                    │
                    ▼
                FareCharge
                "What does the passenger owe?"
                    │
                    ▼
            WalletLedgerEntry
            "How did their stored value change?"
                    │
                    ▼
           PaymentTransaction
           "What external money moved?"
```

Each layer answers a different question. No layer should reach into another layer's responsibilities.

This separation makes the backend:

- consistent
- testable
- auditable
- easier to extend
- easier to debug
- closer to real transport payment architecture
- better suited for demonstrating backend/system-design ability in a portfolio
