import { and, desc, eq, lt } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { journeys, stations } from '../db/schema.js';
import { nextJourneyStatus } from '../domain/journey/JourneyStateMachine.js';
import { AppError } from '../middleware/errorHandler.js';
import type { JourneyView, StationRef } from '../shared/types.js';
import { SettlementService } from './SettlementService.js';

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ApplyTapContext {
  accountId: string;
  mediaId: string;
  tapId: string;
  stationId: string;
  tapType: 'ENTRY' | 'EXIT';
  eventTime: Date;
}

export interface ApplyTapResult {
  journeyId: string;
  journeyStatus: 'OPEN' | 'COMPLETED';
}

async function toStationRef(stationId: string): Promise<StationRef> {
  const station = await db.query.stations.findFirst({
    where: eq(stations.id, stationId),
  });
  if (!station) {
    throw new AppError(500, 'Station missing', 'STATION_MISSING');
  }
  return { code: station.code, name: station.name };
}

export class JourneyService {
  constructor(private readonly settlement = new SettlementService()) {}

  async applyTap(ctx: ApplyTapContext, tx: DbTx): Promise<ApplyTapResult> {
    const [open] = await tx
      .select()
      .from(journeys)
      .where(
        and(eq(journeys.transitAccountId, ctx.accountId), eq(journeys.status, 'OPEN')),
      )
      .limit(1);

    if (ctx.tapType === 'ENTRY') {
      if (open) {
        throw new AppError(409, 'Journey already open', 'JOURNEY_ALREADY_OPEN');
      }

      const status = nextJourneyStatus(null, { type: 'ENTRY_ACCEPTED' });
      try {
        const [created] = await tx
          .insert(journeys)
          .values({
            transitAccountId: ctx.accountId,
            mediaId: ctx.mediaId,
            entryTapId: ctx.tapId,
            originStationId: ctx.stationId,
            startedAt: ctx.eventTime,
            status,
          })
          .returning();

        if (!created) {
          throw new AppError(500, 'Failed to create journey', 'JOURNEY_CREATE_FAILED');
        }

        return { journeyId: created.id, journeyStatus: 'OPEN' };
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AppError(409, 'Journey already open', 'JOURNEY_ALREADY_OPEN');
        }
        throw err;
      }
    }

    // EXIT
    if (!open) {
      throw new AppError(409, 'No open journey', 'NO_OPEN_JOURNEY');
    }

    const status = nextJourneyStatus('OPEN', { type: 'EXIT_ACCEPTED' });
    const [updated] = await tx
      .update(journeys)
      .set({
        exitTapId: ctx.tapId,
        destinationStationId: ctx.stationId,
        completedAt: ctx.eventTime,
        status,
      })
      .where(eq(journeys.id, open.id))
      .returning();

    if (!updated) {
      throw new AppError(500, 'Failed to complete journey', 'JOURNEY_UPDATE_FAILED');
    }

    return { journeyId: updated.id, journeyStatus: 'COMPLETED' };
  }

  /**
   * Close OPEN journeys older than max duration as INCOMPLETE_ENTRY and settle penalty.
   * On insufficient funds: journey still expires, charge left PENDING (no infinite cron retry).
   */
  async expireOpenJourneys(now = new Date()): Promise<{ expired: number; charged: number }> {
    const cutoff = new Date(
      now.getTime() - env.MAX_JOURNEY_DURATION_HOURS * 3600_000,
    );

    const stale = await db
      .select()
      .from(journeys)
      .where(and(eq(journeys.status, 'OPEN'), lt(journeys.startedAt, cutoff)));

    let expired = 0;
    let charged = 0;

    for (const j of stale) {
      const result = await this.expireOne(j.id, now);
      if (result.expired) {
        expired += 1;
        if (result.charged) charged += 1;
      }
    }

    return { expired, charged };
  }

  private async expireOne(
    journeyId: string,
    now: Date,
  ): Promise<{ expired: boolean; charged: boolean }> {
    return db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(journeys)
        .where(eq(journeys.id, journeyId))
        .for('update')
        .limit(1);

      if (!locked || locked.status !== 'OPEN') {
        return { expired: false, charged: false };
      }

      const status = nextJourneyStatus('OPEN', { type: 'EXPIRE' });
      await tx
        .update(journeys)
        .set({
          status,
          completedAt: now,
        })
        .where(eq(journeys.id, journeyId));

      const settle = await this.settlement.settleJourney(
        journeyId,
        locked.transitAccountId,
        now,
        tx,
        { allowPendingOnInsufficient: true },
      );

      return { expired: true, charged: settle.charged };
    });
  }

  async listForAccount(accountId: string): Promise<JourneyView[]> {
    const rows = await db
      .select()
      .from(journeys)
      .where(eq(journeys.transitAccountId, accountId))
      .orderBy(desc(journeys.startedAt));

    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async getForAccount(accountId: string, journeyId: string): Promise<JourneyView> {
    const row = await db.query.journeys.findFirst({
      where: and(eq(journeys.id, journeyId), eq(journeys.transitAccountId, accountId)),
    });
    if (!row) {
      throw new AppError(404, 'Journey not found', 'JOURNEY_NOT_FOUND');
    }
    return this.toView(row);
  }

  private async toView(row: typeof journeys.$inferSelect): Promise<JourneyView> {
    const originStation = await toStationRef(row.originStationId);
    const destinationStation = row.destinationStationId
      ? await toStationRef(row.destinationStationId)
      : null;

    return {
      id: row.id,
      status: row.status,
      originStation,
      destinationStation,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
