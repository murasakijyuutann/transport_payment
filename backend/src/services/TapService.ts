import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  fareMedia,
  tapEvents,
  transitAccounts,
  validators,
} from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import type { TapResult } from '../shared/types.js';
import { CapService } from './CapService.js';
import { FareService } from './FareService.js';
import { JourneyService } from './JourneyService.js';
import { WalletService } from './WalletService.js';
import { preCapPence } from '../domain/fare/CapRule.js';

export interface TapInput {
  mediaToken: string;
  validatorId: string; // validator code
  timestamp: string;
}

type ValidatorType =
  | 'ENTRY_GATE'
  | 'EXIT_GATE'
  | 'BIDIRECTIONAL_GATE'
  | 'BUS_READER'
  | 'INSPECTION_TERMINAL';

function inferTapType(validatorType: ValidatorType): 'ENTRY' | 'EXIT' {
  switch (validatorType) {
    case 'ENTRY_GATE':
      return 'ENTRY';
    case 'EXIT_GATE':
      return 'EXIT';
    case 'BIDIRECTIONAL_GATE':
      throw new AppError(
        400,
        'tapType required for bidirectional validator',
        'TAP_TYPE_REQUIRED',
      );
    default:
      throw new AppError(400, 'Unsupported validator for journey taps', 'VALIDATOR_TYPE');
  }
}

export class TapService {
  constructor(
    private readonly journeys = new JourneyService(),
    private readonly fares = new FareService(),
    private readonly wallet = new WalletService(),
    private readonly caps = new CapService(),
  ) {}

  async handleTap(input: TapInput): Promise<TapResult> {
    const media = await db.query.fareMedia.findFirst({
      where: eq(fareMedia.token, input.mediaToken.trim()),
    });
    if (!media) {
      throw new AppError(404, 'Fare media not found', 'MEDIA_NOT_FOUND');
    }
    if (media.status !== 'ACTIVE') {
      throw new AppError(403, 'Fare media is not active', 'MEDIA_BLOCKED');
    }

    const account = await db.query.transitAccounts.findFirst({
      where: eq(transitAccounts.id, media.transitAccountId),
    });
    if (!account) {
      throw new AppError(404, 'Transit account not found', 'ACCOUNT_NOT_FOUND');
    }
    if (account.status !== 'ACTIVE') {
      throw new AppError(403, 'Transit account is suspended', 'ACCOUNT_SUSPENDED');
    }

    const validator = await db.query.validators.findFirst({
      where: eq(validators.validatorCode, input.validatorId.trim()),
    });
    if (!validator) {
      throw new AppError(404, 'Validator not found', 'VALIDATOR_NOT_FOUND');
    }
    if (validator.status !== 'ONLINE') {
      throw new AppError(503, 'Validator is offline', 'VALIDATOR_OFFLINE');
    }

    const tapType = inferTapType(validator.type);
    const eventTime = parseEventTime(input.timestamp);
    const receivedAt = new Date();

    return db.transaction(async (tx) => {
      const [tap] = await tx
        .insert(tapEvents)
        .values({
          mediaId: media.id,
          validatorId: validator.id,
          stationId: validator.stationId,
          tapType,
          eventTime,
          receivedAt,
          status: 'ACCEPTED',
        })
        .returning();

      if (!tap) {
        throw new AppError(500, 'Failed to record tap', 'TAP_CREATE_FAILED');
      }

      await tx
        .update(fareMedia)
        .set({ lastUsedAt: receivedAt })
        .where(eq(fareMedia.id, media.id));

      const journey = await this.journeys.applyTap(
        {
          accountId: account.id,
          mediaId: media.id,
          tapId: tap.id,
          stationId: validator.stationId,
          tapType,
          eventTime,
        },
        tx,
      );

      if (journey.journeyStatus === 'COMPLETED') {
        // Lock order: accumulator → wallet (inside applyFareCharge)
        const { headroomPence, accumulatorId } = await this.caps.lockHeadroom(
          account.id,
          eventTime,
          tx,
        );
        const { breakdown, chargeId } = await this.fares.priceJourney(journey.journeyId, tx, {
          capHeadroomPence: headroomPence,
        });
        await this.wallet.applyFareCharge(chargeId, tx);
        await this.caps.recordSpend(
          accumulatorId,
          preCapPence(breakdown),
          breakdown.finalFare,
          tx,
        );
      }

      return {
        tapId: tap.id,
        tapType,
        status: 'ACCEPTED' as const,
        journeyId: journey.journeyId,
        journeyStatus: journey.journeyStatus,
      };
    });
  }
}

function parseEventTime(timestamp: string): Date {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'Invalid timestamp', 'VALIDATION_ERROR');
  }
  return d;
}
