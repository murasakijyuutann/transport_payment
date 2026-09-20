import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { paymentTransactions, wallets } from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { AccountService } from './AccountService.js';
import type { AccountView } from '../shared/types.js';

const MAX_TOP_UP = 100;

export class WalletService {
  constructor(private readonly accounts = new AccountService()) {}

  async topUp(accountId: string, amount: number): Promise<AccountView> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'Amount must be greater than zero', 'VALIDATION_ERROR');
    }
    if (amount > MAX_TOP_UP) {
      throw new AppError(400, `Amount cannot exceed £${MAX_TOP_UP}`, 'VALIDATION_ERROR');
    }

    const amountStr = amount.toFixed(2);

    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.accountId, accountId));

      if (!wallet) {
        throw new AppError(404, 'Wallet not found', 'WALLET_MISSING');
      }

      await tx.insert(paymentTransactions).values({
        accountId,
        type: 'TOP_UP',
        provider: 'MOCK',
        providerReference: `MOCK-${Date.now()}`,
        amount: amountStr,
        currency: wallet.currency,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amountStr}::numeric`,
        })
        .where(eq(wallets.id, wallet.id));
    });

    return this.accounts.getAccountView(accountId);
  }
}
