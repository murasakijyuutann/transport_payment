# Phase 4 — Wallet Deduction & Ledger

**Duration estimate:** 2–3 days  
**Depends on:** Phase 3 (`FareCharge` PENDING)  
**Unlocks:** Phase 5–6 (those phases must debit through the same path)  
**Deliverable:** after a trip, wallet balance drops; ledger shows TOP_UP credits and FARE debits with `balanceAfter`.

---

## 1. Why this phase exists

Updating `wallet.balance -= fare` alone (Java-style user balance) loses history and makes disputes impossible.

```text
FareCharge     → what is owed for travel
LedgerEntry    → how stored value changed
PaymentTransaction → external money (top-up mock)
```

**Why append-only ledger:** financial audit. Never UPDATE/DELETE ledger rows; reverse with a new `REFUND` / `ADJUSTMENT` entry later.

**Why one PostgreSQL transaction for charge + ledger + balance:** partial success (charge without debit, or debit without charge) corrupts the system of record.

---

## 2. Ordered work checklist

### Step 4.1 — Schema

```typescript
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'TOP_UP', 'FARE', 'REFUND', 'ADJUSTMENT',
]);

export const walletLedgerEntries = pgTable('wallet_ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  type: ledgerEntryTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), // + credit, - debit
  balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
  referenceType: varchar('reference_type', { length: 64 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Application rule: no repository method `updateLedgerEntry` / `deleteLedgerEntry`.

### Step 4.2 — WalletService core API

```typescript
// services/WalletService.ts

async applyFareCharge(chargeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const charge = await lockFareCharge(tx, chargeId); // FOR UPDATE
    if (charge.status === 'CHARGED') return; // idempotent

    const wallet = await lockWallet(tx, charge.accountId); // FOR UPDATE
    const amount = asPence(charge.amount);
    const balance = asPence(wallet.balance);

    if (balance < amount) {
      throw new AppError(402, 'Insufficient balance', 'INSUFFICIENT_BALANCE');
    }

    const newBalance = balance - amount;
    await tx.insert(walletLedgerEntries).values({
      walletId: wallet.id,
      type: 'FARE',
      amount: formatPence(-amount),
      balanceAfter: formatPence(newBalance),
      referenceType: 'FARE_CHARGE',
      referenceId: charge.id,
    });
    await tx.update(wallets).set({ balance: formatPence(newBalance) }).where(eq(wallets.id, wallet.id));
    await tx.update(fareCharges).set({ status: 'CHARGED', chargedAt: new Date() }).where(eq(fareCharges.id, charge.id));
  });
}
```

**Why `SELECT ... FOR UPDATE`:** concurrent tap-outs / top-ups must serialize on the wallet row.

**Why idempotent on CHARGED:** retries from job or double-submit must not double-debit.

### Step 4.3 — Wire into journey completion

Inside the EXIT success path (same outer transaction if possible):

```text
complete journey
  → FareService.priceJourney → FareCharge PENDING
  → WalletService.applyFareCharge
```

Ideal: **one** `db.transaction` spanning journey complete + fare calc + wallet. If that gets large, at minimum fare+wallet must be atomic; journey COMPLETED without charge is a worse inconsistency than the reverse — prefer all-or-nothing for EXIT.

### Step 4.4 — Refactor top-up to use ledger

Replace Phase 1 top-up:

```typescript
async topUp(accountId: string, amountPence: number) {
  await db.transaction(async (tx) => {
    const payment = await insertPaymentTransaction(...); // MOCK COMPLETED
    const wallet = await lockWallet(tx, accountId);
    const newBalance = asPence(wallet.balance) + amountPence;
    await tx.insert(walletLedgerEntries).values({
      type: 'TOP_UP',
      amount: formatPence(amountPence),
      balanceAfter: formatPence(newBalance),
      referenceType: 'PAYMENT_TRANSACTION',
      referenceId: payment.id,
    });
    await tx.update(wallets).set({ balance: formatPence(newBalance) });
  });
}
```

### Step 4.5 — Insufficient balance behavior

**Recommendation for v1:** fail EXIT pricing/debit with `402 INSUFFICIENT_BALANCE`.

Consequences:

- Journey should not stay COMPLETED without payment if you use one transaction — **roll back** journey completion too, OR complete journey but leave charge PENDING and block further travel.

**Pick one policy and document it:**

| Policy | Behavior |
|--------|----------|
| **A — Atomic fail (recommended)** | Entire EXIT transaction rolls back; journey stays OPEN; client must top up and tap out again |
| B — Complete + debt | Journey COMPLETED, charge PENDING, allow negative balance later |

Use **Policy A** for portfolio clarity.

Tap-in (ENTRY) does **not** check fare affordability (unknown destination). Optional: check minimum balance threshold on ENTRY (e.g. ≥ max single fare) — nice-to-have, not required.

### Step 4.6 — Ledger read API

```text
GET /api/account/wallet/ledger
```

Return newest-first:

```json
{
  "balance": "26.00",
  "entries": [
    { "type": "FARE", "amount": "-4.00", "balanceAfter": "26.00", "createdAt": "...", "referenceType": "FARE_CHARGE" },
    { "type": "TOP_UP", "amount": "30.00", "balanceAfter": "30.00", "referenceType": "PAYMENT_TRANSACTION" }
  ]
}
```

---

## 3. File map

```text
services/WalletService.ts   # topUp + applyFareCharge
routes/wallet.ts            # topup + ledger
```

Remove any direct `UPDATE wallets` from Auth/Fare paths except via WalletService.

---

## 4. Reasoning: balance is a cache

`wallets.balance` is a **materialized cache** of the sum of ledger amounts (or last `balanceAfter`). Ledger is source of truth for history; balance is for fast reads and locking.

Optionally add a Phase 8 reconciliation script: `SUM(entries.amount) == wallet.balance`.

---

## 5. Acceptance criteria

- [ ] Top-up creates PaymentTransaction + ledger TOP_UP + balance increase
- [ ] Completed journey creates CHARGED fare + ledger FARE + balance decrease
- [ ] Insufficient funds → EXIT fails cleanly (Policy A); no partial ledger row
- [ ] `GET .../ledger` shows chronological running balances
- [ ] Double-apply of same charge does not double-debit

## 6. Out of scope

- Stripe / real PSP
- Refunds / journey correction
- Negative balance debt recovery

## 7. Handoff notes for Phase 5–6

Both CapRule and incomplete-journey penalties must call `WalletService.applyFareCharge` (or a shared `settleFare(journeyId)` that prices + charges). Do not invent a second debit path in the cron job.
