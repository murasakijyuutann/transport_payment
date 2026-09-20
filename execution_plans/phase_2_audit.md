# Phase 2 Audit — Tap & Journey Core

**Date:** 2026-09-20  
**Plan:** [`phase_2_execution_plan.md`](phase_2_execution_plan.md)  
**Outcome:** Phase 2 accepted — Central ENTRY → Riverside EXIT produces `COMPLETED` journey; illegal sequences return 409.

---

## 1. Summary

Implemented the primary ABT travel milestone:

- `TapEvent` records gate facts; `Journey` interprets them into OPEN / COMPLETED trips
- `POST /api/taps` resolves media + validator, infers ENTRY/EXIT from gate type
- Unique partial index enforces one OPEN journey per transit account
- Journey list/detail APIs for the authenticated account
- No fare or wallet logic on the tap path (deferred to Phase 3–4)

---

## 2. What was created / changed

### Schema & migration

| Item | Detail |
|------|--------|
| [`backend/src/db/schema.ts`](../backend/src/db/schema.ts) | `tap_events`, `journeys` + enums |
| [`0001_wealthy_aqueduct.sql`](../backend/src/db/migrations/0001_wealthy_aqueduct.sql) | Applied migration |
| Index | `one_open_journey_per_account` on `transit_account_id` WHERE `status = 'OPEN'` |

### Domain / services / routes

| Path | Role |
|------|------|
| `domain/journey/JourneyStateMachine.ts` | Pure status transitions (ENTRY→OPEN, EXIT→COMPLETED, EXPIRE→INCOMPLETE_ENTRY) |
| `services/TapService.ts` | Resolve media/account/validator, insert tap, orchestrate journey |
| `services/JourneyService.ts` | `applyTap` in transaction; list/get journey views |
| `routes/tap.ts` | `POST /api/taps` |
| `routes/journey.ts` | `GET /api/account/journeys`, `GET /api/account/journeys/:id` |
| `shared/types.ts` | `JourneyView`, `TapResult`, `StationRef` |

### API contract

**Tap request**

```json
{
  "mediaToken": "CARD-DEMO-001",
  "validatorId": "VAL-CENTRAL-ENTRY-01",
  "timestamp": "2026-09-20T08:13:42.000Z"
}
```

`validatorId` is the **validator code** (not UUID). Tap type is inferred from `ENTRY_GATE` / `EXIT_GATE`.

**Tap response**

```json
{
  "tapId": "...",
  "tapType": "ENTRY",
  "status": "ACCEPTED",
  "journeyId": "...",
  "journeyStatus": "OPEN"
}
```

**Error codes**

| Code | HTTP | When |
|------|------|------|
| `JOURNEY_ALREADY_OPEN` | 409 | Second ENTRY while OPEN |
| `NO_OPEN_JOURNEY` | 409 | EXIT with no OPEN journey |
| `MEDIA_NOT_FOUND` / `MEDIA_BLOCKED` | 404 / 403 | Bad or inactive media |
| `VALIDATOR_NOT_FOUND` / `VALIDATOR_OFFLINE` | 404 / 503 | Bad or offline validator |
| `ACCOUNT_SUSPENDED` | 403 | Suspended transit account |

---

## 3. Verification

| Check | Result |
|-------|--------|
| Migration applied; unique OPEN index present | **Met** |
| Demo ENTRY at `VAL-CENTRAL-ENTRY-01` → OPEN | **Met** |
| `GET /api/account/journeys` shows OPEN with Central | **Met** |
| Double ENTRY → 409 `JOURNEY_ALREADY_OPEN` | **Met** |
| EXIT at `VAL-RIVERSIDE-EXIT-01` → COMPLETED | **Met** |
| Journey detail shows Central → Riverside | **Met** |
| EXIT with no open → 409 `NO_OPEN_JOURNEY` | **Met** |
| `npx tsc --noEmit` | **Pass** |
| No fare/wallet in tap path | **Met** |

---

## 4. Decisions

1. **Approach B** — only ACCEPTED taps written; invalid sequences throw before insert (simpler v1).
2. **Taps unauthenticated by JWT** — identity is `mediaToken` (gate simulator). Journey reads still require JWT.
3. **Same-station / same-validator EXIT allowed** — fare engine will price later.
4. **Tap + journey writes in one DB transaction** — no orphan ACCEPTED tap without journey update.
5. **Unique violation mapped to `JOURNEY_ALREADY_OPEN`** — handles ENTRY races.

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| `tap_events` and `journeys` migrated | **Met** |
| Unique OPEN journey per account in DB | **Met** |
| ENTRY creates OPEN journey | **Met** |
| EXIT completes with destination | **Met** |
| Illegal sequences → 409 with stable codes | **Met** |
| Journey list/detail for account | **Met** |
| No fare/wallet on tap path | **Met** |

---

## 6. Handoff to Phase 3

On EXIT → `COMPLETED`, Phase 3 should call fare pricing after journey completion (same transaction preferred once wallet exists in Phase 4).

Hook point: end of `JourneyService.applyTap` EXIT branch / `TapService.handleTap` after COMPLETED — introduce `FareService.priceJourney(journeyId)` without putting rule math in `TapService`.

Next: [`phase_3_execution_plan.md`](phase_3_execution_plan.md).
