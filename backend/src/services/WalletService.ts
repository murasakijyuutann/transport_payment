import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  fareCharges,
  paymentTransactions,
  walletLedgerEntries,
  wallets,
} from '../db/schema.js';
import { decimalToPence, penceToDecimal } from '../domain/fare/money.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccountView, LedgerView } from '../shared/types.js';
import { AccountService } from './AccountService.js';

const MAX_TOP_UP = 100;

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class WalletService {
  constructor(private readonly accounts = new AccountService()) {}

  async topUp(accountId: string, amount: number): Promise<AccountView> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'Amount must be greater than zero', 'VALIDATION_ERROR');
    }
    if (amount > MAX_TOP_UP) {
      throw new AppError(400, `Amount cannot exceed £${MAX_TOP_UP}`, 'VALIDATION_ERROR');
    }

    const amountPence = Math.round(amount * 100);

    await db.transaction(async (tx) => {
      const wallet = await lockWalletByAccount(tx, accountId);

      const [payment] = await tx
        .insert(paymentTransactions)
        .values({
          accountId,
          type: 'TOP_UP',
          provider: 'MOCK',
          providerReference: `MOCK-${Date.now()}`,
          amount: penceToDecimal(amountPence),
          currency: wallet.currency,
          status: 'COMPLETED',
          completedAt: new Date(),
        })
        .returning();

      if (!payment) {
        throw new AppError(500, 'Failed to record payment', 'PAYMENT_CREATE_FAILED');
      }

      const newBalance = decimalToPence(wallet.balance) + amountPence;

      await tx.insert(walletLedgerEntries).values({
        walletId: wallet.id,
        type: 'TOP_UP',
        amount: penceToDecimal(amountPence),
        balanceAfter: penceToDecimal(newBalance),
        referenceType: 'PAYMENT_TRANSACTION',
        referenceId: payment.id,
      });

      await tx
        .update(wallets)
        .set({ balance: penceToDecimal(newBalance) })
        .where(eq(wallets.id, wallet.id));
    });

    return this.accounts.getAccountView(accountId);
  }

  /**
   * Debit wallet for a PENDING fare charge. Idempotent if already CHARGED.
   * When called inside an EXIT transaction, insufficient funds rolls back the whole EXIT (Policy A).
   */
  async applyFareCharge(chargeId: string, outerTx?: DbTx): Promise<void> {
    const run = async (tx: DbTx) => {
      const charge = await lockFareCharge(tx, chargeId);
      if (charge.status === 'CHARGED') {
        return;
      }
      if (charge.status !== 'PENDING') {
        throw new AppError(409, `Charge not payable (${charge.status})`, 'CHARGE_NOT_PENDING');
      }

      const wallet = await lockWalletByAccount(tx, charge.accountId);
      const amountPence = decimalToPence(charge.amount);
      const balancePence = decimalToPence(wallet.balance);

      if (balancePence < amountPence) {
        throw new AppError(402, 'Insufficient balance', 'INSUFFICIENT_BALANCE');
      }

      const newBalance = balancePence - amountPence;

      if (amountPence > 0) {
        await tx.insert(walletLedgerEntries).values({
          walletId: wallet.id,
          type: 'FARE',
          amount: penceToDecimal(-amountPence),
          balanceAfter: penceToDecimal(newBalance),
          referenceType: 'FARE_CHARGE',
          referenceId: charge.id,
        });
      }

      await tx
        .update(wallets)
        .set({ balance: penceToDecimal(newBalance) })
        .where(eq(wallets.id, wallet.id));

      await tx
        .update(fareCharges)
        .set({ status: 'CHARGED', chargedAt: new Date() })
        .where(eq(fareCharges.id, charge.id));
    };

    if (outerTx) {
      await run(outerTx);
      return;
    }
    await db.transaction(run);
  }

  async getLedger(accountId: string): Promise<LedgerView> {
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.accountId, accountId),
    });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found', 'WALLET_MISSING');
    }

    const entries = await db
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.walletId, wallet.id))
      .orderBy(desc(walletLedgerEntries.createdAt));

    return {
      balance: wallet.balance,
      currency: wallet.currency,
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

async function lockWalletByAccount(tx: DbTx, accountId: string) {
  const [wallet] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, accountId))
    .for('update')
    .limit(1);

  if (!wallet) {
    throw new AppError(404, 'Wallet not found', 'WALLET_MISSING');
  }
  return wallet;
}

async function lockFareCharge(tx: DbTx, chargeId: string) {
  const [charge] = await tx
    .select()
    .from(fareCharges)
    .where(eq(fareCharges.id, chargeId))
    .for('update')
    .limit(1);

  if (!charge) {
    throw new AppError(404, 'Fare charge not found', 'CHARGE_NOT_FOUND');
  }
  return charge;
}
