# Phase 3 — Fare Engine

**Duration estimate:** 4–5 days  
**Depends on:** Phase 2 (COMPLETED journeys)  
**Unlocks:** Phase 4 (charges to debit), Phase 5 (cap adjustment), Phase 6 (penalty rule)  
**Deliverable:** completing a journey writes `FareCalculation` + `FareCharge`; `GET .../fare` shows the breakdown.

---

## 1. Why this phase exists

The Java prototype embeds fare math inside `FareCalculationService` and stores results on the `Journey` row (`fareAmount`, `discountAmount`, `finalAmount`). That couples travel state to pricing policy.

The overhaul rule (doc §11):

```text
Journey → FareContext → FareEngine → (rules) → FareCalculation → FareCharge
```

**Why a pluggable rule list:** zone pricing, student discount, incomplete penalty, and daily cap are different policies. Testing `ZoneRule` alone should not require Express or wallet code.

**Why persist `FareCalculation`:** answer “why was I charged £3.50?” for support, portfolio demos, and debugging. Discarding the breakdown is how prototypes become un-auditable.

---

## 2. Ordered work checklist

### Step 3.1 — Schema

Tables:

- `fare_rules` — data-driven zone-pair (and later filters)
- `fare_calculations` — audit breakdown per journey
- `fare_charges` — amount owed linked to calculation

```typescript
export const fareCalculations = pgTable('fare_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').notNull().references(() => journeys.id),
  baseFare: numeric('base_fare', { precision: 10, scale: 2 }).notNull(),
  zoneCharge: numeric('zone_charge', { precision: 10, scale: 2 }).notNull().default('0'),
  timeAdjustment: numeric('time_adjustment', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  capAdjustment: numeric('cap_adjustment', { precision: 10, scale: 2 }).notNull().default('0'),
  penalty: numeric('penalty', { precision: 10, scale: 2 }).notNull().default('0'),
  originalFare: numeric('original_fare', { precision: 10, scale: 2 }).notNull(),
  finalFare: numeric('final_fare', { precision: 10, scale: 2 }).notNull(),
  fareRuleId: uuid('fare_rule_id'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export const fareCharges = pgTable('fare_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').notNull().references(() => journeys.id),
  fareCalculationId: uuid('fare_calculation_id').notNull().references(() => fareCalculations.id),
  accountId: uuid('account_id').notNull().references(() => transitAccounts.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: fareChargeStatusEnum('status').notNull().default('PENDING'),
  chargedAt: timestamp('charged_at', { withTimezone: true }),
});
```

**Why `PENDING` then `CHARGED`:** Phase 3 can insert `PENDING` (or `CHARGED` if you skip wallet). Phase 4 flips to `CHARGED` when ledger writes succeed. Prefer inserting `PENDING` in Phase 3 and marking `CHARGED` in Phase 4 inside the wallet transaction.

### Step 3.2 — Seed fare rules (zone pairs)

Prefer lookup table over `base + zones * perZone`:

```text
1→1  2.50
1→2  4.00
2→1  4.00
2→2  2.50
```

(Adjust to match Java’s `baseFare + zoneDiff * perZone` if you want parity demos.)

```typescript
// fare_rules columns (simplified)
{
  ruleType: 'ZONE_PAIR',
  originZoneId,
  destinationZoneId,
  amount: '4.00',
  priority: 100,
  validFrom,
  validUntil: null,
}
```

**Why data-driven:** portfolio story includes “tariff is configuration, not code.” Hardcoded formula is fine as a fallback inside `ZoneRule` if no row matches — but seed the rows.

### Step 3.3 — Pure fare domain

```text
backend/src/domain/fare/
├── types.ts              # FareContext, FareAdjustment
├── FareEngine.ts
├── ZoneRule.ts
├── RiderCategoryRule.ts
├── IncompleteJourneyRule.ts
└── money.ts              # add/sub/mul helpers on string decimals or pence ints
```

#### Types

```typescript
export interface FareContext {
  journeyStatus: 'COMPLETED' | 'INCOMPLETE_ENTRY' | /* ... */;
  originZoneCode: string;
  destinationZoneCode: string | null;
  riderDiscountPercent: number; // 0 or 50
  // Phase 5 adds: capHeadroom: string
  // Phase 3 can leave capHeadroom undefined; CapRule no-ops or absent
}

export interface FareAdjustment {
  baseFare?: string;
  zoneCharge?: string;
  discount?: string;      // negative or positive convention — pick one
  penalty?: string;
  capAdjustment?: string; // Phase 5
  fareRuleId?: string;
}

export interface FareRule {
  apply(context: FareContext, current: FareBreakdown): FareBreakdown;
}
```

**Money convention (pick one and document in `money.ts`):**

| Option | Recommendation |
|--------|----------------|
| Integer pence | Best for arithmetic; convert at DB boundary |
| String decimal + decimal.js | OK if you already prefer numeric strings |

**Recommendation:** integer **pence** inside `domain/fare`, format to `numeric` string when inserting.

#### FareEngine

```typescript
export class FareEngine {
  constructor(private rules: FareRule[]) {}

  calculate(context: FareContext): FareBreakdown {
    let state = emptyBreakdown();
    for (const rule of this.rules) {
      state = rule.apply(context, state);
    }
    return finalize(state); // set originalFare / finalFare
  }
}
```

**Rule order matters:**

```text
1. ZoneRule              → sets base/zone from table
2. RiderCategoryRule     → applies percent discount
3. IncompleteJourneyRule → if INCOMPLETE_*, replace/set penalty path
4. CapRule (Phase 5)     → trims final to headroom
```

For Phase 3, register rules 1–3. Incomplete rule only fires when `journeyStatus` is incomplete (Phase 6 will call engine with that status); on normal COMPLETED it no-ops.

#### ZoneRule

- Load matching `fare_rules` row (inject a `FareRuleRepository` port into the service layer; domain rule receives the resolved amount OR the service passes amounts into context).

**Cleaner split:**

- `FareService` loads zone IDs + rule amount from DB into `FareContext`
- `ZoneRule` only applies numbers already on the context (pure)

```typescript
// FareContext includes:
zonePairAmount: number; // pence, required for COMPLETED
```

**Why:** domain tests do not need Drizzle.

#### RiderCategoryRule

```typescript
// discount pence = round(subtotal * discountPercent / 100)
```

Student 50% off zone subtotal before cap.

#### IncompleteJourneyRule

```typescript
if (context.journeyStatus === 'INCOMPLETE_ENTRY') {
  return { ...state, penalty: 500, /* clear or ignore zone */ };
}
```

Flat £5.00. Exact interaction with zone fare: **penalty replaces normal fare** for v1 (simpler). Document that choice.

### Step 3.4 — FareService (orchestration)

Called at end of journey COMPLETED (and later incomplete):

```typescript
async priceJourney(journeyId: string) {
  const agg = await loadJourneyAggregate(journeyId); // stations→zones, account→rider
  const context = toFareContext(agg);
  const breakdown = this.engine.calculate(context);

  return db.transaction(async (tx) => {
    const calc = await tx.insert(fareCalculations).values(...).returning();
    await tx.insert(fareCharges).values({
      journeyId,
      fareCalculationId: calc.id,
      accountId: agg.accountId,
      amount: breakdown.finalFare,
      status: 'PENDING',
    });
    return calc;
  });
}
```

Wire from `JourneyService` EXIT path:

```typescript
// after status COMPLETED
await this.fareService.priceJourney(journey.id);
```

### Step 3.5 — Fare breakdown API

```text
GET /api/account/journeys/:id/fare
```

Returns calculation fields + charge status/amount. 404 if journey not owned or not yet priced.

---

## 3. File map

```text
domain/fare/*          # pure
services/FareService.ts
routes/ (journey fare endpoint)
db/seed.ts             # extend with fare_rules
config/fareConfig.ts   # incompleteJourneyPenaltyPence = 500, etc.
```

```typescript
// config/fareConfig.ts
export const fareConfig = {
  incompleteJourneyPenaltyPence: 500,
  dailyCapPence: 1500,          // used Phase 5
  maxJourneyDurationHours: 4,   // used Phase 6
};
```

---

## 4. Reasoning: Journey must not calculate fare

If `Journey` entity methods call pricing:

- incomplete job, correction, and cap re-rate all bloat the entity
- unit tests need DB fixtures for every pricing change

Keep `Journey` as travel state only.

---

## 5. Acceptance criteria

- [ ] Zone-pair seed data loaded
- [ ] COMPLETED journey produces one `FareCalculation` and one `FareCharge` (`PENDING`)
- [ ] Student account shows 50% discount field populated
- [ ] `GET .../fare` returns base, zone, discount, penalty, final
- [ ] FareEngine unit tests for Zone + Rider without DB
- [ ] No wallet balance mutation yet

## 6. Out of scope

- CapRule / accumulators (Phase 5)
- Ledger debit (Phase 4)
- Peak/off-peak, weekly caps, route surcharges

## 7. Handoff notes for Phase 4

Phase 4 will:

1. Take `FareCharge` PENDING
2. Debit wallet + ledger in one transaction
3. Set charge `CHARGED`

Keep charge amount = `finalFare` from calculation (cap already applied once Phase 5 exists).
