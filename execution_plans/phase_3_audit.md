# Phase 3 Audit — Fare Engine

**Date:** 2026-09-20  
**Plan:** [`phase_3_execution_plan.md`](phase_3_execution_plan.md)  
**Outcome:** Phase 3 accepted — COMPLETED journeys write `FareCalculation` + `FareCharge` (`PENDING`); fare breakdown API works for adult and student.

---

## 1. Summary

Pricing is a separate domain from travel:

```text
Journey COMPLETED → FareContext → FareEngine (rules) → FareCalculation + FareCharge PENDING
```

- Pure rules use **integer pence**; DB stores `NUMERIC(10,2)` strings
- Zone-pair tariffs seeded as data (`1→2 = £4.00`, etc.)
- Student 50% discount applied via `RiderCategoryRule`
- Incomplete penalty rule present (fires later in Phase 6)
- Wallet balance **not** mutated (Phase 4)

---

## 2. What was created / changed

### Schema & migration

| Item | Detail |
|------|--------|
| `fare_rules` | Zone-pair (and future filters) tariff rows |
| `fare_calculations` | Auditable breakdown per journey |
| `fare_charges` | Amount owed; status `PENDING` until Phase 4 |
| Migration | `0002_same_sunspot.sql` |

### Domain (`backend/src/domain/fare/`)

| File | Role |
|------|------|
| `money.ts` | `penceToDecimal` / `decimalToPence` |
| `types.ts` | `FareContext`, `FareBreakdown`, `FareRule` |
| `ZoneRule.ts` | Applies `zonePairAmountPence` as base |
| `RiderCategoryRule.ts` | Percent discount (positive = reduction) |
| `IncompleteJourneyRule.ts` | £5 penalty **replaces** zone fare |
| `FareEngine.ts` | Ordered rule pipeline + finalize |
| `FareEngine.test.ts` | Vitest unit tests (3 cases) |

### Services / config / seed

| Path | Role |
|------|------|
| `services/FareService.ts` | Load context from DB, run engine, persist calc+charge |
| `config/fareConfig.ts` | Penalty £5, daily cap £15, max journey 4h |
| `db/seed.ts` | Zone-pair fares + `student@example.com` |
| `TapService` | Calls `priceJourney` inside EXIT transaction |
| `GET /api/account/journeys/:id/fare` | Breakdown + charge status |

### Tooling note

Vitest **5.x** failed in this environment (`describe` → `config` undefined). Pinned **vitest@3.2.4** for Phase 3 unit tests.

---

## 3. Seed tariffs

| Origin → Dest | Amount |
|---------------|--------|
| 1 → 1 | £2.50 |
| 1 → 2 | £4.00 |
| 2 → 1 | £4.00 |
| 2 → 2 | £2.50 |

**Student demo:** `student@example.com` / `password123` · `CARD-STUDENT-001` · £20

---

## 4. Verification

| Check | Result |
|-------|--------|
| Migration + fare rule seed | **Met** |
| Adult Central→Riverside fare | base/final **£4.00**, charge `PENDING` |
| Student same trip | discount **£2.00**, final **£2.00** |
| Wallet unchanged after trip | adult still **£20.00** |
| `npm test` (FareEngine) | **3 passed** |
| `npx tsc --noEmit` | **Pass** |

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Zone-pair seed data | **Met** |
| COMPLETED → FareCalculation + FareCharge PENDING | **Met** |
| Student 50% discount populated | **Met** |
| `GET .../fare` breakdown | **Met** |
| FareEngine unit tests without DB | **Met** |
| No wallet mutation | **Met** |

---

## 6. Decisions

1. **Pence in domain** — avoid float money bugs.
2. **Zone pair amount → `baseFare`** (`zoneCharge` 0 for v1 table tariffs).
3. **Discount stored as positive reduction**; `final = original - discount + capAdjustment`.
4. **Incomplete penalty replaces** zone fare (clears base/zone/discount).
5. **Price inside same DB transaction as EXIT** — journey + fare atomic.
6. **Idempotent `priceJourney`** — if calculation exists, return it (no double insert).

---

## 7. Handoff to Phase 4

`FareCharge` rows are `PENDING` with `amount = finalFare`. Phase 4 should:

1. Debit wallet + append ledger in one transaction  
2. Mark charge `CHARGED`  
3. Reject EXIT settle on insufficient balance (Policy A)

Next: [`phase_4_execution_plan.md`](phase_4_execution_plan.md).
