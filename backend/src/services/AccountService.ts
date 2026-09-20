import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  fareMedia,
  riderCategories,
  stations,
  transitAccounts,
  users,
  validators,
  wallets,
  zones,
} from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccountView, StationView } from '../shared/types.js';

export class AccountService {
  async getAccountView(accountId: string): Promise<AccountView> {
    const account = await db.query.transitAccounts.findFirst({
      where: eq(transitAccounts.id, accountId),
    });
    if (!account) {
      throw new AppError(404, 'Account not found', 'ACCOUNT_NOT_FOUND');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, account.userId),
    });
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const rider = await db.query.riderCategories.findFirst({
      where: eq(riderCategories.id, account.riderCategoryId),
    });
    if (!rider) {
      throw new AppError(500, 'Rider category missing', 'RIDER_CATEGORY_MISSING');
    }

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.accountId, accountId),
    });
    if (!wallet) {
      throw new AppError(500, 'Wallet missing', 'WALLET_MISSING');
    }

    const mediaRows = await db
      .select()
      .from(fareMedia)
      .where(eq(fareMedia.transitAccountId, accountId));

    return {
      accountId: account.id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      riderCategory: {
        name: rider.name,
        discountPercent: rider.discountPercent,
      },
      media: mediaRows.map((m) => ({
        token: m.token,
        mediaType: m.mediaType,
        status: m.status,
      })),
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency,
      },
    };
  }

  async listStations(): Promise<StationView[]> {
    const stationRows = await db.select().from(stations);
    const zoneRows = await db.select().from(zones);
    const validatorRows = await db.select().from(validators);

    const zoneById = new Map(zoneRows.map((z) => [z.id, z]));

    return stationRows.map((s) => {
      const zone = zoneById.get(s.zoneId);
      if (!zone) {
        throw new AppError(500, `Station ${s.code} missing zone`, 'ZONE_MISSING');
      }
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        zone: { id: zone.id, code: zone.code, name: zone.name },
        validators: validatorRows
          .filter((v) => v.stationId === s.id)
          .map((v) => ({
            id: v.id,
            validatorCode: v.validatorCode,
            type: v.type,
            status: v.status,
          })),
      };
    });
  }
}

/** Phase 2 helpers */
export async function findMediaByToken(token: string) {
  return db.query.fareMedia.findFirst({
    where: eq(fareMedia.token, token),
  });
}

export async function findValidatorByCode(code: string) {
  return db.query.validators.findFirst({
    where: eq(validators.validatorCode, code),
  });
}
