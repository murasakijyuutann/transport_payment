# Phase 5 — Daily Cap

**Duration estimate:** 3–4 days  
**Depends on:** Phase 3–4 (fare breakdown + wallet settle path)  
**Unlocks:** richer dashboard (cap status); realistic multi-trip demos  
**Deliverable:** after ~£15 charged in a UTC day, further fares trim to remaining headroom / £0; `GET /api/account/cap-status` works.

---

## 1. Why this phase exists

Capping is **not** journey logic. Putting `if (todaysTotal > 15) fare = 0` inside `JourneyService` (Java-ish approach) makes weekly caps, zone-scoped caps, and “eligible spend” definitions impossible without rewrites.

Introduce:

| Entity | Role |
|--------|------|
| `FareCap` | Policy: daily £15 all zones |
| `FareAccumulator` | Per-account per-period running totals |
| `CapRule` | FareEngine rule that trims fare to headroom |

**Why UTC midnight:** doc §21 — avoid server-local TZ and BST/GMT bugs. Store `periodStart` as timestamptz at `00:00:00.000Z`.

---

## 2. Ordered work checklist

### Step 5.1 — Schema + seed

```typescript
export const fareCaps = pgTable('fare_caps', {
  id: uuid('id').primaryKey().defaultRandom(),
  capType: varchar('cap_type', { length: 16 }).notNull(), // DAILY
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  scope: varchar('scope', { length: 32 }).notNull().default('ALL_ZONES'),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
});

export const fareAccumulators = pgTable('fare_accumulators', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => transitAccounts.id),
  periodType: varchar('period_type', { length: 16 }).notNull(), // DAILY
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  eligibleSpend: numeric('eligible_spend', { precision: 10, scale: 2 }).notNull().default('0'),
  chargedAmount: numeric('charged_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  capAmount: numeric('cap_amount', { precision: 10, scale: 2 }).notNull(),
}, (t) => ({
  uniq: uniqueIndex('fare_acc_account_period_uidx').on(t.accountId, t.periodType, t.periodStart),
}));
```

Seed: one active DAILY cap amount `15.00`.

### Step 5.2 — CapService

```typescript
function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async getOrCreateDailyAccumulator(accountId: string, at: Date = new Date()) {
  const periodStart = utcDayStart(at);
  // insert on conflict do nothing, then select
  // capAmount from fare_caps
}

async getHeadroom(accountId: string, at?: Date): Promise<number /* pence */> {
  const acc = await getOrCreateDailyAccumulator(accountId, at);
  return asPence(acc.capAmount) - asPence(acc.chargedAmount);
}
```

**Semantics:**

- `eligibleSpend` — sum of fares **before** cap trim (what trips “would have” cost)
- `chargedAmount` — sum actually charged after trim

Example from doc:

```text
J1 £5 → charged £5  (total 5)
J2 £6 → charged £6  (total 11)
J3 £5 → headroom £4 → charged £4  (total 15)
J4 £5 → headroom £0 → charged £0
```

### Step 5.3 — CapRule in FareEngine

Insert **last** in the rule pipeline (after zone, rider, incomplete):

```typescript
class CapRule implements FareRule {
  apply(ctx: FareContext, state: FareBreakdown): FareBreakdown {
    const headroom = ctx.capHeadroomPence ?? Infinity;
    const preCap = state.finalBeforeCap; // after discount/penalty
    const charged = Math.min(preCap, Math.max(0, headroom));
    const capAdjustment = charged - preCap; // ≤ 0
    return { ...state, capAdjustment, finalFare: charged };
  }
}
```

`FareService` loads headroom into context **before** `engine.calculate`.

### Step 5.4 — Update accumulator after successful charge

Only after wallet debit succeeds (or inside same transaction as charge):

```typescript
eligibleSpend += preCapFare
chargedAmount += finalFare
```

Use row lock on accumulator together with wallet lock order:

```text
Lock order (avoid deadlocks):
1. wallet
2. fare_accumulator
3. write ledger / charge / accumulator updates
```

Or lock accumulator first then wallet — **pick a global order and use it everywhere**.

### Step 5.5 — Cap status API

```text
GET /api/account/cap-status
```

```json
{
  "periodType": "DAILY",
  "periodStart": "2026-09-20T00:00:00.000Z",
  "capAmount": "15.00",
  "chargedAmount": "11.00",
  "eligibleSpend": "11.00",
  "remainingHeadroom": "4.00"
}
```

### Step 5.6 — Tests (mandatory)

| Case | Expect |
|------|--------|
| First trip under cap | full fare; accumulator updated |
| Trip crossing cap | final = headroom; `capAdjustment` negative |
| Trip after cap exhausted | final = 0; ledger may skip zero debit **or** write £0 — prefer **skip ledger insert if final = 0**, still store FareCalculation showing cap |
| Period boundary | journey at `23:59Z` vs `00:01Z` use different accumulators |

**Zero-fare handling:** still insert `FareCalculation` + `FareCharge` amount 0 with status `CHARGED` or `WAIVED`. Recommendation: `CHARGED` with 0 and **no** ledger row (ledger clutter). Document the choice.

---

## 3. File map

```text
domain/fare/CapRule.ts
services/CapService.ts
routes/account.ts          # cap-status
config/fareConfig.ts       # dailyCapPence = 1500
```

---

## 4. Reasoning: why not sum transactions ad hoc

Querying “sum of today’s fare ledger entries” works until:

- refunds
- waived charges
- timezone bugs
- weekly caps with different eligibility

`FareAccumulator` is an explicit domain object you can extend to `WEEKLY` without rewriting history queries.

---

## 5. Acceptance criteria

- [ ] Daily cap seeded at £15
- [ ] Multi-journey day demonstrates trim then zero
- [ ] `capAdjustment` visible on fare breakdown
- [ ] Cap status endpoint matches accumulator
- [ ] UTC midnight boundary covered by tests
- [ ] Incomplete penalties (Phase 6) also consume cap headroom (same CapRule path)

## 6. Out of scope

- Weekly caps
- Zone-scoped caps (`ZONE_1_2`)
- Peak caps

## 7. Handoff notes for Phase 6

Incomplete journey settlement must:

1. Build FareContext with `INCOMPLETE_ENTRY`
2. Run full engine including CapRule
3. Settle via WalletService

Penalty £5 still subject to remaining daily headroom.
