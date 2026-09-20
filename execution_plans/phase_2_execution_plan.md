# Phase 2 — Tap & Journey Core

**Duration estimate:** 4–5 days  
**Depends on:** Phase 1 (media, validators, accounts)  
**Unlocks:** Phase 3–6 (all fare/wallet flows hang off completed/open journeys)  
**Deliverable:** tap-in at Station A → tap-out at Station B → `Journey` status `COMPLETED` visible in history.

> **This is the primary backend milestone.** If Phase 2 is solid, later phases are mostly plugins on the EXIT path. If Phase 2 is muddy (tap mixed with fare/SQL in one function), Phases 3–6 will fight you.

---

## 1. Why this phase exists

Separate two questions the Java prototype conflated:

| Question | Entity |
|----------|--------|
| What physically happened at a gate? | `TapEvent` |
| What trip do those facts represent? | `Journey` |

**Why not only update journey fields on tap:** you lose an audit trail of rejected taps, duplicate taps, and validator metadata. Support and debugging need the raw event stream.

**Why no fare in this phase:** tap-in must be fast and reliable. Fare belongs after EXIT interpretation. Building fare into `POST /taps` early creates circular dependencies (wallet balance blocking journey state).

---

## 2. Domain model for this phase

### TapEvent

```typescript
type TapType = 'ENTRY' | 'EXIT';
type TapStatus = 'ACCEPTED' | 'REJECTED' | 'PENDING';

interface TapEvent {
  id: string;
  mediaId: string;
  validatorId: string;
  stationId: string;
  tapType: TapType;
  eventTime: Date;    // from device/client
  receivedAt: Date;   // server clock
  status: TapStatus;
}
```

### Journey

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

Phase 2 only writes `OPEN` and `COMPLETED`. Other statuses are reserved for Phase 6 / future correction.

---

## 3. Ordered work checklist

### Step 2.1 — Schema + constraint

```typescript
export const tapTypeEnum = pgEnum('tap_type', ['ENTRY', 'EXIT']);
export const tapStatusEnum = pgEnum('tap_status', ['ACCEPTED', 'REJECTED', 'PENDING']);
export const journeyStatusEnum = pgEnum('journey_status', [
  'OPEN', 'COMPLETED', 'INCOMPLETE_ENTRY', 'INCOMPLETE_EXIT', 'EXPIRED', 'CORRECTED',
]);

export const tapEvents = pgTable('tap_events', { /* ... */ });
export const journeys = pgTable('journeys', { /* ... */ });
```

**Critical DB constraint** (doc §27):

```sql
CREATE UNIQUE INDEX one_open_journey_per_account
  ON journeys (transit_account_id)
  WHERE status = 'OPEN';
```

**Why:** two concurrent ENTRY taps must not create two OPEN journeys. App-level check alone races; the unique index is the source of truth. Catch unique violation → return `409 JOURNEY_ALREADY_OPEN` (or treat second ENTRY as rejected tap).

### Step 2.2 — Pure state machine (no DB)

```typescript
// backend/src/domain/journey/JourneyStateMachine.ts

export type JourneyEvent =
  | { type: 'ENTRY_ACCEPTED' }
  | { type: 'EXIT_ACCEPTED' }
  | { type: 'EXPIRE' }; // used Phase 6

export function nextJourneyStatus(
  current: JourneyStatus | null,
  event: JourneyEvent,
): JourneyStatus {
  if (current === null && event.type === 'ENTRY_ACCEPTED') return 'OPEN';
  if (current === 'OPEN' && event.type === 'EXIT_ACCEPTED') return 'COMPLETED';
  if (current === 'OPEN' && event.type === 'EXPIRE') return 'INCOMPLETE_ENTRY';
  throw new Error(`Invalid transition: ${current} + ${event.type}`);
}
```

**Why pure:** unit-test all illegal transitions without Postgres. Services call this before writing.

### Step 2.3 — Infer tap direction from validator

```typescript
function inferTapType(validatorType: ValidatorType): TapType {
  switch (validatorType) {
    case 'ENTRY_GATE': return 'ENTRY';
    case 'EXIT_GATE': return 'EXIT';
    case 'BIDIRECTIONAL_GATE':
      throw new AppError(400, 'tapType required for bidirectional validator', 'TAP_TYPE_REQUIRED');
    default:
      throw new AppError(400, 'Unsupported validator for journey taps', 'VALIDATOR_TYPE');
  }
}
```

Request body (fixed for v1):

```json
{
  "mediaToken": "CARD-DEMO-001",
  "validatorId": "VAL-CENTRAL-ENTRY-01",
  "timestamp": "2026-09-20T08:13:42Z"
}
```

Accept `validatorId` as validator **code** (human-friendly for the simulator). Resolve to UUID internally.

### Step 2.4 — TapService orchestration

```text
POST /api/taps
        │
        ▼
TapService.handleTap(input)
        │
        ├─ find media by token (404 / 403 if BLOCKED)
        ├─ find account (403 if SUSPENDED)
        ├─ find validator (404 / 503 if OFFLINE)
        ├─ infer tapType
        ├─ INSERT TapEvent (start as PENDING or insert ACCEPTED after journey step)
        └─ JourneyService.applyTap(tap, account, media)
```

Recommended: wrap tap insert + journey update in **one DB transaction**. If journey transition fails, still optionally keep a `REJECTED` TapEvent (product choice):

| Approach | Pros | Cons |
|----------|------|------|
| A: Rejected taps persisted | Full audit | More code |
| B: Only ACCEPTED taps written; errors throw before insert | Simpler | Weaker audit |

**Recommendation for v1:** Approach B for speed; add rejected-tap persistence in Phase 8 if time allows. Always log rejection reason in API error body.

### Step 2.5 — JourneyService.applyTap

```typescript
async applyTap(ctx: { accountId, mediaId, tapId, stationId, tapType, eventTime }) {
  const open = await findOpenJourney(accountId);

  if (ctx.tapType === 'ENTRY') {
    if (open) throw new AppError(409, 'Journey already open', 'JOURNEY_ALREADY_OPEN');
    // insert journey OPEN
    return { journeyId, status: 'OPEN' };
  }

  // EXIT
  if (!open) throw new AppError(409, 'No open journey', 'NO_OPEN_JOURNEY');
  // update journey → COMPLETED, set exitTapId, destinationStationId, completedAt
  return { journeyId, status: 'COMPLETED' };
}
```

**Same-station exit:** allow in v1 (fare engine can price Zone1→Zone1). Do not special-case reject.

**Exit at same validator as entry:** allowed; still COMPLETED.

### Step 2.6 — Read APIs

```text
GET /api/account/journeys
GET /api/account/journeys/:id
```

Return DTOs with station names joined (not only UUIDs) so Phase 7 UI is easy:

```typescript
interface JourneyView {
  id: string;
  status: string;
  originStation: { code: string; name: string };
  destinationStation: { code: string; name: string } | null;
  startedAt: string;
  completedAt: string | null;
}
```

Auth: JWT; scope journeys to `req.auth.accountId` only.

### Step 2.7 — Manual test script (acceptance)

1. Login as seeded demo user; note `mediaToken`.
2. `POST /api/taps` with Central ENTRY validator → journey OPEN.
3. `GET /api/account/journeys` → one OPEN row.
4. `POST /api/taps` with Riverside EXIT validator → COMPLETED.
5. Second EXIT without ENTRY → 409.
6. Two ENTRYs in a row → 409.

---

## 4. File map

```text
backend/src/
├── routes/tap.ts
├── routes/journey.ts          # or nest under account.ts
├── services/TapService.ts
├── services/JourneyService.ts
└── domain/journey/JourneyStateMachine.ts
```

Keep fare imports **out** of these files until Phase 3.

---

## 5. Response shape for validators

Fast gate response:

```json
{
  "tapId": "...",
  "tapType": "ENTRY",
  "status": "ACCEPTED",
  "journeyId": "...",
  "journeyStatus": "OPEN"
}
```

Do not include fare amounts yet (null/omit).

---

## 6. Reasoning: what not to do

1. **Do not deduct balance on ENTRY** — incomplete trips and caps need EXIT (or expiry) first.
2. **Do not store origin/destination only on User session** — persist on Journey.
3. **Do not let the client send `tapType` when using ENTRY/EXIT gates** — trust validator config; clients lie.
4. **Do not put journey history filters, paging, etc. in this phase** — simple list ordered by `startedAt DESC` is enough.

---

## 7. Acceptance criteria

- [ ] `tap_events` and `journeys` tables migrated
- [ ] Unique OPEN journey per account enforced in DB
- [ ] ENTRY creates OPEN journey linked to entry tap + origin station
- [ ] EXIT completes journey with exit tap + destination
- [ ] Illegal sequences return 409 with stable error codes
- [ ] Journey list/detail APIs work for authenticated account
- [ ] No fare/wallet code in the tap path yet

## 8. Handoff notes for Phase 3

On successful EXIT → `COMPLETED`, Phase 3 will call:

```typescript
await fareService.priceCompletedJourney(journeyId);
```

Design `JourneyService.complete(...)` to return the journey aggregate (stations, account, times) so FareService does not re-fetch blindly. Optionally emit an in-process hook / method call at end of EXIT transaction **after** journey row is committed — or call fare inside the same transaction starting Phase 3/4. Prefer **same transaction from Phase 4 onward** once wallet writes exist; for Phase 3 alone, same transaction as journey complete is fine.
