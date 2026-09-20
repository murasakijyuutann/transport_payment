# Phase 4 Audit — Wallet Deduction & Ledger

**Date:** 2026-09-20  
**Plan:** [`phase_4_execution_plan.md`](phase_4_execution_plan.md)  
**Outcome:** Phase 4 accepted — EXIT settles fare into wallet with append-only ledger; insufficient funds uses Policy A (full EXIT rollback).

---

## 1. Summary

```text
EXIT → priceJourney (PENDING charge) → applyFareCharge (ledger FARE + balance + CHARGED)
```

All three steps run in **one DB transaction** with the journey completion. If balance is too low, nothing commits — journey stays `OPEN`.

Top-up now writes `PaymentTransaction` + ledger `TOP_UP` + balance update.

---

## 2. What was created / changed

| Path | Change |
|------|--------|
| `db/schema.ts` | `wallet_ledger_entries` + `ledger_entry_type` enum |
| Migration | `0003_chubby_jocasta.sql` |
| `services/WalletService.ts` | `topUp` (with ledger), `applyFareCharge` (FOR UPDATE locks), `getLedger` |
| `services/FareService.ts` | `priceJourney` returns `{ breakdown, chargeId }` |
| `services/TapService.ts` | After COMPLETED: price + `applyFareCharge` in same tx |
| `routes/wallet.ts` | `GET /api/account/wallet/ledger` |
| `shared/types.ts` | `LedgerView` / `LedgerEntryView` |

---

## 3. Behaviour

### Policy A (insufficient balance)

- HTTP **402** `INSUFFICIENT_BALANCE`
- EXIT transaction rolls back
- Journey remains **OPEN** (passenger tops up and taps out again)

### Ledger conventions

- Credits positive (`TOP_UP` +£20.00)
- Debits negative (`FARE` -£4.00)
- `balanceAfter` snapshot on every row
- Append-only — no update/delete APIs
- Zero-amount fares: mark `CHARGED`, skip ledger row

### Locking

- `SELECT … FOR UPDATE` on wallet and fare charge rows before mutating

---

## 4. Verification

| Check | Result |
|-------|--------|
| Top-up £1 → ledger TOP_UP, balance 1.00 | **Met** |
| EXIT with £1 vs £4 fare → 402, journey still OPEN | **Met** |
| Top-up £20 then EXIT → COMPLETED, charge **CHARGED** | **Met** |
| Balance 21 − 4 = **17.00** | **Met** |
| Ledger: TOP_UP 1, TOP_UP 20, FARE -4 with balanceAfter | **Met** |
| Unit tests / `tsc` | **Pass** |

---

## 5. Acceptance criteria scorecard

| Criterion | Status |
|-----------|--------|
| Top-up → PaymentTransaction + ledger TOP_UP + balance | **Met** |
| Completed journey → CHARGED + ledger FARE + balance down | **Met** |
| Insufficient funds → clean fail, no partial ledger | **Met** |
| `GET .../ledger` with running balances | **Met** |
| Idempotent CHARGED re-apply | Implemented (early return) |

---

## 6. API

```text
POST /api/wallet/topup          { "amount": 20 }
GET  /api/account/wallet/ledger
```

Ledger response shape:

```json
{
  "balance": "17.00",
  "currency": "GBP",
  "entries": [
    { "type": "FARE", "amount": "-4.00", "balanceAfter": "17.00", "referenceType": "FARE_CHARGE", ... }
  ]
}
```

---

## 7. Handoff to Phase 5–6

Reuse **only** `WalletService.applyFareCharge` (or a thin `settleFare` wrapper) for:

- Cap-adjusted charges (Phase 5)
- Incomplete-journey penalties (Phase 6)

Do not add a second debit path in the cron job.

Next: [`phase_5_execution_plan.md`](phase_5_execution_plan.md).
