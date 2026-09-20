import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { fareConfig } from '../config/fareConfig.js';
import { db } from '../db/index.js';
import { fareAccumulators, fareCaps } from '../db/schema.js';
import { decimalToPence, penceToDecimal } from '../domain/fare/money.js';
import { utcDayStart } from '../domain/fare/utcDay.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CapStatusView } from '../shared/types.js';

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class CapService {
  /** Lock today's accumulator (FOR UPDATE) and return remaining headroom in pence. */
  async lockHeadroom(
    accountId: string,
    at: Date,
    tx: DbTx,
  ): Promise<{ headroomPence: number; accumulatorId: string }> {
    const acc = await this.getOrCreateDailyAccumulator(accountId, at, tx, true);
    const headroomPence = Math.max(
      0,
      decimalToPence(acc.capAmount) - decimalToPence(acc.chargedAmount),
    );
    return { headroomPence, accumulatorId: acc.id };
  }

  async recordSpend(
    accumulatorId: string,
    eligiblePence: number,
    chargedPence: number,
    tx: DbTx,
  ): Promise<void> {
    await tx
      .update(fareAccumulators)
      .set({
        eligibleSpend: sql`${fareAccumulators.eligibleSpend} + ${penceToDecimal(eligiblePence)}::numeric`,
        chargedAmount: sql`${fareAccumulators.chargedAmount} + ${penceToDecimal(chargedPence)}::numeric`,
      })
      .where(eq(fareAccumulators.id, accumulatorId));
  }

  async getCapStatus(accountId: string, at: Date = new Date()): Promise<CapStatusView> {
    const acc = await db.transaction(async (tx) => {
      return this.getOrCreateDailyAccumulator(accountId, at, tx, false);
    });

    const capPence = decimalToPence(acc.capAmount);
    const chargedPence = decimalToPence(acc.chargedAmount);
    const headroom = Math.max(0, capPence - chargedPence);

    return {
      periodType: 'DAILY',
      periodStart: acc.periodStart.toISOString(),
      capAmount: acc.capAmount,
      chargedAmount: acc.chargedAmount,
      eligibleSpend: acc.eligibleSpend,
      remainingHeadroom: penceToDecimal(headroom),
    };
  }

  private async getOrCreateDailyAccumulator(
    accountId: string,
    at: Date,
    tx: DbTx,
    forUpdate: boolean,
  ) {
    const periodStart = utcDayStart(at);
    const capAmount = await this.activeDailyCapAmount(tx, at);

    await tx
      .insert(fareAccumulators)
      .values({
        accountId,
        periodType: 'DAILY',
        periodStart,
        eligibleSpend: '0.00',
        chargedAmount: '0.00',
        capAmount,
      })
      .onConflictDoNothing();

    const [acc] = forUpdate
      ? await tx
          .select()
          .from(fareAccumulators)
          .where(
            and(
              eq(fareAccumulators.accountId, accountId),
              eq(fareAccumulators.periodType, 'DAILY'),
              eq(fareAccumulators.periodStart, periodStart),
            ),
          )
          .for('update')
          .limit(1)
      : await tx
          .select()
          .from(fareAccumulators)
          .where(
            and(
              eq(fareAccumulators.accountId, accountId),
              eq(fareAccumulators.periodType, 'DAILY'),
              eq(fareAccumulators.periodStart, periodStart),
            ),
          )
          .limit(1);
    if (!acc) {
      throw new AppError(500, 'Failed to load fare accumulator', 'ACCUMULATOR_MISSING');
    }
    return acc;
  }

  private async activeDailyCapAmount(tx: DbTx, at: Date): Promise<string> {
    const [cap] = await tx
      .select()
      .from(fareCaps)
      .where(
        and(
          eq(fareCaps.capType, 'DAILY'),
          lte(fareCaps.validFrom, at),
          or(isNull(fareCaps.validTo), gte(fareCaps.validTo, at)),
        ),
      )
      .limit(1);

    if (cap) {
      return cap.amount;
    }
    return penceToDecimal(fareConfig.dailyCapPence);
  }
}
