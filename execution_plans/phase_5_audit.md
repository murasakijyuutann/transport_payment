# Phase 5 Audit — Daily Cap

**Date:** 2026-09-20  
**Plan:** [`phase_5_execution_plan.md`](phase_5_execution_plan.md)  
**Outcome:** Phase 5 accepted — £15 UTC daily cap trims then zeros fares; `GET /api/account/cap-status` matches accumulator.

---

## 1. Summary

```text
EXIT → lock daily accumulator → FareEngine (+ CapRule) → charge/ledger → recordSpend
```

- `FareCap` policy: DAILY £15 ALL_ZONES  
- `FareAccumulator` per account per UTC day  
- `CapRule` last in the fare pipeline sets `capAdjustment` ≤ 0  

---

## 2. What was created / changed

| Path | Role |
|------|------|
| `fare_caps` / `fare_accumulators` | Schema + migration `0004_left_frightful_four.sql` |
| `domain/fare/CapRule.ts` | Trim to headroom |
| `domain/fare/utcDay.ts` | UTC midnight period start |
| `services/CapService.ts` | lockHeadroom, recordSpend, getCapStatus |
| `FareService` | CapRule in engine; accepts `capHeadroomPence` |
| `TapService` | Lock accumulator → price → wallet → recordSpend |
| `GET /api/account/cap-status` | Dashboard-ready status |
| Seed | Daily cap £15.00 |

**Lock order:** accumulator → wallet (avoids deadlock with top-up which only locks wallet).

---

## 3. Semantics

| Field | Meaning |
|-------|---------|
| `eligibleSpend` | Sum of pre-cap fares (after discount) |
| `chargedAmount` | Sum actually charged after trim |
| `capAdjustment` | `final − preCap` (≤ 0) on FareCalculation |
| Zero fare | `CHARGED` with amount 0; **no** ledger row |

Period key: `periodStart = UTC 00:00:00.000Z` for the journey `eventTime` day.

---

## 4. Verification

Multi-trip smoke (zone 1→2 = £4, wallet £50):

| Trip | final | capAdjustment |
|------|-------|---------------|
| 1 | £4.00 | 0 |
| 2 | £4.00 | 0 |
| 3 | £4.00 | 0 |
| 4 | £3.00 | -1.00 |
| 5 | £0.00 | -4.00 |

Cap status after:

```json
{
  "periodType": "DAILY",
  "periodStart": "2026-09-20T00:00:00.000Z",
  "capAmount": "15.00",
  "chargedAmount": "15.00",
  "eligibleSpend": "20.00",
  "remainingHeadroom": "0.00"
}
```

Wallet: £50 − £15 = **£35.00**

Unit tests: **7 passed** (zone, student, incomplete, cap trim, cap zero, incomplete+cap, UTC midnight boundary).

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Daily cap seeded at £15 | **Met** |
| Multi-journey trim then zero | **Met** |
| `capAdjustment` on fare breakdown | **Met** |
| Cap status matches accumulator | **Met** |
| UTC midnight boundary unit-tested | **Met** |
| Incomplete penalties use CapRule | **Met** (engine path; Phase 6 will call it) |

---

## 6. Handoff to Phase 6

Incomplete expiry must:

1. Lock accumulator + build context with `INCOMPLETE_ENTRY`  
2. Run full engine (includes CapRule)  
3. Settle via `WalletService.applyFareCharge`  
4. `CapService.recordSpend`  

Next: [`phase_6_execution_plan.md`](phase_6_execution_plan.md).
