# Phase 6 — Incomplete Journey Job

**Duration estimate:** 2 days  
**Depends on:** Phase 2 (OPEN journeys), Phase 3–4 (price + settle), Phase 5 optional but recommended  
**Unlocks:** realistic “forgot to tap out” portfolio story  
**Deliverable:** OPEN journeys older than 4 hours auto-close as `INCOMPLETE_ENTRY`, get penalty fare, debit wallet.

---

## 1. Why this phase exists

Open journeys left forever break capping, reporting, and revenue. Checking timeout inside every random API call is nondeterministic.

Use a **scheduled job** (`node-cron` every 5 minutes) as the single place that expires journeys (doc §10, §24).

```text
ENTRY → OPEN → (4h pass) → cron → INCOMPLETE_ENTRY → FareEngine → Charge → Ledger
```

---

## 2. Ordered work checklist

### Step 6.1 — Config

```typescript
// already in fareConfig
maxJourneyDurationHours: 4,
incompleteJourneyPenaltyPence: 500,
```

Allow override via env for tests:

```env
MAX_JOURNEY_DURATION_HOURS=4
```

### Step 6.2 — JourneyService.expireOpenJourneys

```typescript
async expireOpenJourneys(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - fareConfig.maxJourneyDurationHours * 3600_000);
  const stale = await db.select().from(journeys).where(
    and(eq(journeys.status, 'OPEN'), lt(journeys.startedAt, cutoff)),
  );

  let count = 0;
  for (const j of stale) {
    await this.expireOne(j.id, now);
    count++;
  }
  return count;
}

private async expireOne(journeyId: string, now: Date) {
  await db.transaction(async (tx) => {
    const j = await lockJourney(tx, journeyId);
    if (j.status !== 'OPEN') return; // lost race

    await tx.update(journeys).set({
      status: 'INCOMPLETE_ENTRY',
      completedAt: now,
    }).where(eq(journeys.id, journeyId));

    // Reuse shared settle path:
    await this.fareService.priceAndSettle(journeyId, tx);
  });
}
```

**Why lock + re-check status:** cron and a late EXIT tap can race. EXIT should win if it commits first; expire no-ops if no longer OPEN.

### Step 6.3 — Shared `priceAndSettle`

Refactor Phase 3–4 into one method used by EXIT and expire:

```typescript
// FareService.priceAndSettle(journeyId, tx?)
// 1. load aggregate
// 2. engine.calculate (IncompleteJourneyRule fires)
// 3. insert calculation + PENDING charge
// 4. WalletService.applyFareCharge
// 5. CapService.updateAccumulator
```

**Do not copy-paste** debit logic into the job file.

### Step 6.4 — Cron wiring

```typescript
// backend/src/jobs/incompleteJourneyJob.ts
import cron from 'node-cron';
import { JourneyService } from '../services/JourneyService';

export function startIncompleteJourneyJob(journeyService: JourneyService) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const n = await journeyService.expireOpenJourneys();
      if (n > 0) console.log(`Expired ${n} open journeys`);
    } catch (err) {
      console.error('incompleteJourneyJob failed', err);
    }
  });
}
```

Call from `server.ts` only (not `app.ts`) so tests do not spawn cron:

```typescript
// server.ts
startIncompleteJourneyJob(journeyService);
```

### Step 6.5 — Testing strategy

Waiting 4 hours is impractical. Use one of:

1. **Inject clock** / pass `now` into `expireOpenJourneys`
2. **Test env** `MAX_JOURNEY_DURATION_HOURS=0` or minutes
3. **Direct SQL** set `started_at` in the past, then call `expireOpenJourneys()` in a Vitest/Supertest test (no cron needed)

Recommended acceptance test:

```typescript
// create OPEN journey with startedAt = now - 5 hours
await journeyService.expireOpenJourneys(new Date());
// assert status INCOMPLETE_ENTRY, fare penalty, ledger FARE
```

### Step 6.6 — Insufficient balance on expire

If Policy A (Phase 4) rolls back on insufficient funds, cron would retry every 5 minutes forever.

**Recommendation for expire path:**

| Approach | Notes |
|----------|-------|
| **Charge with waiver / PENDING debt** | More realistic; more code |
| **Force charge allowing negative balance** | Simple; document as v1 debt |
| **Expire journey, leave charge PENDING, skip ledger** | Journey closed; collect later |

Pick **expire journey + PENDING charge without wallet debit** when insufficient funds; log `INSUFFICIENT_BALANCE_ON_EXPIRE`. Prevents infinite OPEN state. Dashboard can show unpaid charges later (Phase 8 nice-to-have).

Alternatively allow negative wallet only in expire path — state the choice in README.

---

## 3. File map

```text
jobs/incompleteJourneyJob.ts
services/JourneyService.ts      # expireOpenJourneys
domain/journey/JourneyStateMachine.ts  # EXPIRE transition
domain/fare/IncompleteJourneyRule.ts   # already from Phase 3
```

---

## 4. Reasoning: why not expire on next tap

Expiring only when the passenger taps again delays revenue and complicates ENTRY while OPEN+stale. Cron makes the system converge without passenger action — closer to real ABT back-office jobs.

---

## 5. Acceptance criteria

- [ ] Cron registered on server start
- [ ] Stale OPEN → `INCOMPLETE_ENTRY`
- [ ] Penalty FareCalculation + charge path runs
- [ ] Ledger/wallet updated when balance sufficient
- [ ] Late EXIT vs expire race does not double-charge (status guard)
- [ ] Automated test without waiting 4 real hours

## 6. Out of scope

- Journey correction API (`POST /journeys/:id/correct`) — doc Phase 2 future
- Refunds after late evidence of exit
- Inspection taps / fare evasion flows

## 7. Handoff notes for Phase 7

UI should show journey status badges including `INCOMPLETE_ENTRY` and fare penalty on detail view. Simulator can create an OPEN journey; admin/dev button “Run expire job now” is optional for demos (`POST /api/admin/jobs/expire-journeys`).
