import { CapService } from './CapService.js';
import { FareService } from './FareService.js';
import { WalletService } from './WalletService.js';
import { preCapPence } from '../domain/fare/CapRule.js';
import { AppError } from '../middleware/errorHandler.js';
import { db } from '../db/index.js';

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SettleResult {
  chargeId: string;
  charged: boolean;
  finalFarePence: number;
}

/**
 * Shared fare settle for EXIT completion and incomplete-journey expiry.
 * Lock order: accumulator → wallet.
 */
export class SettlementService {
  constructor(
    private readonly fares = new FareService(),
    private readonly wallet = new WalletService(),
    private readonly caps = new CapService(),
  ) {}

  async settleJourney(
    journeyId: string,
    accountId: string,
    at: Date,
    tx: DbTx,
    opts: { allowPendingOnInsufficient?: boolean } = {},
  ): Promise<SettleResult> {
    const { headroomPence, accumulatorId } = await this.caps.lockHeadroom(accountId, at, tx);
    const { breakdown, chargeId } = await this.fares.priceJourney(journeyId, tx, {
      capHeadroomPence: headroomPence,
    });

    try {
      await this.wallet.applyFareCharge(chargeId, tx);
      await this.caps.recordSpend(
        accumulatorId,
        preCapPence(breakdown),
        breakdown.finalFare,
        tx,
      );
      return { chargeId, charged: true, finalFarePence: breakdown.finalFare };
    } catch (err) {
      if (
        opts.allowPendingOnInsufficient &&
        err instanceof AppError &&
        err.code === 'INSUFFICIENT_BALANCE'
      ) {
        console.warn('INSUFFICIENT_BALANCE_ON_EXPIRE', {
          journeyId,
          chargeId,
          amountPence: breakdown.finalFare,
        });
        return { chargeId, charged: false, finalFarePence: breakdown.finalFare };
      }
      throw err;
    }
  }
}
