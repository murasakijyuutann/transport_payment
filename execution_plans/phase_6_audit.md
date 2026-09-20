# Phase 6 Audit — Incomplete Journey Job

**Date:** 2026-09-20  
**Plan:** [`phase_6_execution_plan.md`](phase_6_execution_plan.md)  
**Outcome:** Phase 6 accepted — stale OPEN journeys expire to `INCOMPLETE_ENTRY` with £5 penalty; cron + admin trigger; insufficient funds leaves charge `PENDING`.

---

## 1. Summary

```text
OPEN + startedAt < now − 4h
  → INCOMPLETE_ENTRY
  → SettlementService (CapRule + IncompleteJourneyRule)
  → wallet debit if funded, else PENDING charge
```

Cron every 5 minutes from `server.ts` only (not `createApp()`).

---

## 2. What was created / changed

| Path | Role |
|------|------|
| `services/SettlementService.ts` | Shared settle for EXIT + expire |
| `services/JourneyService.ts` | `expireOpenJourneys` / `expireOne` |
| `services/TapService.ts` | Uses `SettlementService` on COMPLETED |
| `jobs/incompleteJourneyJob.ts` | `node-cron` `*/5 * * * *` |
| `server.ts` | Starts cron after listen |
| `POST /api/admin/jobs/expire-journeys` | Immediate run for demos/tests |
| `env.MAX_JOURNEY_DURATION_HOURS` | Default 4; overridable |

**Dependency:** `node-cron` (+ types).

---

## 3. Behaviour decisions

| Case | Behaviour |
|------|-----------|
| Funded wallet | Penalty charged, ledger FARE, cap accumulator updated |
| Insufficient funds | Journey still expires; charge stays **PENDING**; log `INSUFFICIENT_BALANCE_ON_EXPIRE`; no infinite OPEN retries |
| Race with late EXIT | `FOR UPDATE` + status re-check; expire no-ops if no longer OPEN |
| EXIT insufficient funds | Unchanged Policy A (full rollback) via `allowPendingOnInsufficient: false` |

---

## 4. Verification

**Funded expire**

- ENTRY → backdate `started_at` −5h → `POST /admin/jobs/expire-journeys`
- Result: `{ expired: 1, charged: 1 }`
- Journey: `INCOMPLETE_ENTRY`
- Fare: penalty **£5.00**, charge **CHARGED**
- Wallet: £20 → **£15**, ledger FARE −5.00

**Unfunded expire**

- ENTRY with £0 wallet → backdate → expire
- Result: `{ expired: 1, charged: 0 }`
- Journey: `INCOMPLETE_ENTRY`
- Charge: **PENDING** £5
- Balance still £0

**Cron:** server log `incompleteJourneyJob scheduled (every 5 minutes)`

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Cron registered on server start | **Met** |
| Stale OPEN → `INCOMPLETE_ENTRY` | **Met** |
| Penalty FareCalculation + charge path | **Met** |
| Ledger/wallet when funded | **Met** |
| Status guard vs late EXIT | **Met** (lock + re-check) |
| Test without waiting 4 hours | **Met** (backdate + admin job) |

---

## 6. Handoff to Phase 7

UI should badge `INCOMPLETE_ENTRY` and show penalty on fare detail. Optional demo control: call `POST /api/admin/jobs/expire-journeys` after leaving a journey open (or backdating in DB).

Next: [`phase_7_execution_plan.md`](phase_7_execution_plan.md).
