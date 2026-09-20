import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { fareConfig } from '../config/fareConfig.js';
import { db } from '../db/index.js';
import {
  fareCalculations,
  fareCharges,
  fareRules,
  journeys,
  riderCategories,
  stations,
  transitAccounts,
  zones,
} from '../db/schema.js';
import { FareEngine } from '../domain/fare/FareEngine.js';
import { IncompleteJourneyRule } from '../domain/fare/IncompleteJourneyRule.js';
import { penceToDecimal } from '../domain/fare/money.js';
import { RiderCategoryRule } from '../domain/fare/RiderCategoryRule.js';
import type { FareBreakdown, FareContext, FareJourneyStatus } from '../domain/fare/types.js';
import { ZoneRule } from '../domain/fare/ZoneRule.js';
import { AppError } from '../middleware/errorHandler.js';
import type { FareView } from '../shared/types.js';

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const engine = new FareEngine([
  new ZoneRule(),
  new RiderCategoryRule(),
  new IncompleteJourneyRule(),
]);

export class FareService {
  async priceJourney(
    journeyId: string,
    tx: DbTx,
  ): Promise<{ breakdown: FareBreakdown; chargeId: string }> {
    const existingCalc = await tx
      .select()
      .from(fareCalculations)
      .where(eq(fareCalculations.journeyId, journeyId))
      .limit(1);

    if (existingCalc[0]) {
      const [existingCharge] = await tx
        .select()
        .from(fareCharges)
        .where(eq(fareCharges.journeyId, journeyId))
        .limit(1);
      if (!existingCharge) {
        throw new AppError(500, 'Fare charge missing for calculation', 'CHARGE_MISSING');
      }
      return {
        breakdown: {
          baseFare: decimalPence(existingCalc[0].baseFare),
          zoneCharge: decimalPence(existingCalc[0].zoneCharge),
          timeAdjustment: decimalPence(existingCalc[0].timeAdjustment),
          discount: decimalPence(existingCalc[0].discount),
          capAdjustment: decimalPence(existingCalc[0].capAdjustment),
          penalty: decimalPence(existingCalc[0].penalty),
          originalFare: decimalPence(existingCalc[0].originalFare),
          finalFare: decimalPence(existingCalc[0].finalFare),
          fareRuleId: existingCalc[0].fareRuleId ?? undefined,
        },
        chargeId: existingCharge.id,
      };
    }

    const context = await this.buildContext(journeyId, tx);
    const breakdown = engine.calculate(context);

    const [calc] = await tx
      .insert(fareCalculations)
      .values({
        journeyId,
        baseFare: penceToDecimal(breakdown.baseFare),
        zoneCharge: penceToDecimal(breakdown.zoneCharge),
        timeAdjustment: penceToDecimal(breakdown.timeAdjustment),
        discount: penceToDecimal(breakdown.discount),
        capAdjustment: penceToDecimal(breakdown.capAdjustment),
        penalty: penceToDecimal(breakdown.penalty),
        originalFare: penceToDecimal(breakdown.originalFare),
        finalFare: penceToDecimal(breakdown.finalFare),
        fareRuleId: breakdown.fareRuleId,
        version: 1,
      })
      .returning();

    if (!calc) {
      throw new AppError(500, 'Failed to store fare calculation', 'FARE_CALC_FAILED');
    }

    const [charge] = await tx
      .insert(fareCharges)
      .values({
        journeyId,
        fareCalculationId: calc.id,
        accountId: context.accountId,
        amount: penceToDecimal(breakdown.finalFare),
        status: 'PENDING',
      })
      .returning();

    if (!charge) {
      throw new AppError(500, 'Failed to store fare charge', 'CHARGE_CREATE_FAILED');
    }

    return { breakdown, chargeId: charge.id };
  }

  async getFareForAccount(accountId: string, journeyId: string): Promise<FareView> {
    const journey = await db.query.journeys.findFirst({
      where: and(eq(journeys.id, journeyId), eq(journeys.transitAccountId, accountId)),
    });
    if (!journey) {
      throw new AppError(404, 'Journey not found', 'JOURNEY_NOT_FOUND');
    }

    const [calc] = await db
      .select()
      .from(fareCalculations)
      .where(eq(fareCalculations.journeyId, journeyId))
      .limit(1);
    if (!calc) {
      throw new AppError(404, 'Fare not calculated yet', 'FARE_NOT_FOUND');
    }

    const [charge] = await db
      .select()
      .from(fareCharges)
      .where(eq(fareCharges.journeyId, journeyId))
      .limit(1);

    return {
      journeyId,
      baseFare: calc.baseFare,
      zoneCharge: calc.zoneCharge,
      timeAdjustment: calc.timeAdjustment,
      discount: calc.discount,
      capAdjustment: calc.capAdjustment,
      penalty: calc.penalty,
      originalFare: calc.originalFare,
      finalFare: calc.finalFare,
      fareRuleId: calc.fareRuleId,
      calculatedAt: calc.calculatedAt.toISOString(),
      charge: charge
        ? { id: charge.id, amount: charge.amount, status: charge.status }
        : null,
    };
  }

  private async buildContext(
    journeyId: string,
    tx: DbTx,
  ): Promise<FareContext & { accountId: string }> {
    const [journey] = await tx.select().from(journeys).where(eq(journeys.id, journeyId)).limit(1);
    if (!journey) {
      throw new AppError(404, 'Journey not found', 'JOURNEY_NOT_FOUND');
    }

    const [account] = await tx
      .select()
      .from(transitAccounts)
      .where(eq(transitAccounts.id, journey.transitAccountId))
      .limit(1);
    if (!account) {
      throw new AppError(404, 'Account not found', 'ACCOUNT_NOT_FOUND');
    }

    const [rider] = await tx
      .select()
      .from(riderCategories)
      .where(eq(riderCategories.id, account.riderCategoryId))
      .limit(1);
    if (!rider) {
      throw new AppError(500, 'Rider category missing', 'RIDER_CATEGORY_MISSING');
    }

    const originZone = await zoneForStation(tx, journey.originStationId);
    const destZone = journey.destinationStationId
      ? await zoneForStation(tx, journey.destinationStationId)
      : null;

    let zonePairAmountPence = 0;
    let fareRuleId: string | undefined;

    if (destZone && journey.status === 'COMPLETED') {
      const rule = await findZonePairRule(tx, originZone.id, destZone.id);
      if (!rule) {
        throw new AppError(500, 'No fare rule for zone pair', 'FARE_RULE_MISSING');
      }
      zonePairAmountPence = decimalPence(rule.amount);
      fareRuleId = rule.id;
    }

    return {
      accountId: account.id,
      journeyStatus: journey.status as FareJourneyStatus,
      originZoneCode: originZone.code,
      destinationZoneCode: destZone?.code ?? null,
      riderDiscountPercent: Number(rider.discountPercent),
      zonePairAmountPence,
      fareRuleId,
      incompletePenaltyPence: fareConfig.incompleteJourneyPenaltyPence,
    };
  }
}

async function zoneForStation(tx: DbTx, stationId: string) {
  const [station] = await tx.select().from(stations).where(eq(stations.id, stationId)).limit(1);
  if (!station) {
    throw new AppError(500, 'Station missing', 'STATION_MISSING');
  }
  const [zone] = await tx.select().from(zones).where(eq(zones.id, station.zoneId)).limit(1);
  if (!zone) {
    throw new AppError(500, 'Zone missing', 'ZONE_MISSING');
  }
  return zone;
}

async function findZonePairRule(tx: DbTx, originZoneId: string, destinationZoneId: string) {
  const now = new Date();
  const [rule] = await tx
    .select()
    .from(fareRules)
    .where(
      and(
        eq(fareRules.ruleType, 'ZONE_PAIR'),
        eq(fareRules.originZoneId, originZoneId),
        eq(fareRules.destinationZoneId, destinationZoneId),
        lte(fareRules.validFrom, now),
        or(isNull(fareRules.validUntil), gte(fareRules.validUntil, now)),
      ),
    )
    .orderBy(asc(fareRules.priority))
    .limit(1);
  return rule ?? null;
}

function decimalPence(amount: string): number {
  return Math.round(Number(amount) * 100);
}
