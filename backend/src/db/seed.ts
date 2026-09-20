import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  fareCaps,
  fareMedia,
  fareRules,
  riderCategories,
  stations,
  transitAccounts,
  users,
  validators,
  wallets,
  zones,
} from './schema.js';

const NETWORK: Array<{
  zoneCode: string;
  zoneName: string;
  stations: Array<{ code: string; name: string }>;
}> = [
  {
    zoneCode: '1',
    zoneName: 'Zone 1',
    stations: [
      { code: 'CENTRAL', name: 'Central' },
      { code: 'CITYHALL', name: 'City Hall' },
      { code: 'MUSEUM', name: 'Museum' },
    ],
  },
  {
    zoneCode: '2',
    zoneName: 'Zone 2',
    stations: [
      { code: 'RIVERSIDE', name: 'Riverside' },
      { code: 'AIRPORT_EAST', name: 'Airport East' },
      { code: 'GREEN_PARK', name: 'Green Park' },
    ],
  },
];

/** Zone-pair tariffs (GBP). */
const ZONE_PAIR_FARES: Array<{ from: string; to: string; amount: string }> = [
  { from: '1', to: '1', amount: '2.50' },
  { from: '1', to: '2', amount: '4.00' },
  { from: '2', to: '1', amount: '4.00' },
  { from: '2', to: '2', amount: '2.50' },
];

async function seed() {
  console.log('Seeding transport_abt…');

  const adultId = await upsertRider('ADULT', '0.00');
  const studentId = await upsertRider('STUDENT', '50.00');

  const zoneIds = new Map<string, string>();
  for (const zoneDef of NETWORK) {
    const zoneId = await upsertZone(zoneDef.zoneCode, zoneDef.zoneName);
    zoneIds.set(zoneDef.zoneCode, zoneId);
    for (const stationDef of zoneDef.stations) {
      const stationId = await upsertStation(stationDef.code, stationDef.name, zoneId);
      await upsertValidator(stationId, `VAL-${stationDef.code}-ENTRY-01`, 'ENTRY_GATE');
      await upsertValidator(stationId, `VAL-${stationDef.code}-EXIT-01`, 'EXIT_GATE');
    }
  }

  await seedFareRules(zoneIds);
  await seedDailyCap();
  await upsertDemoUser('demo@example.com', 'Demo', 'Rider', adultId, 'CARD-DEMO-001', '20.00');
  await upsertDemoUser(
    'student@example.com',
    'Student',
    'Rider',
    studentId,
    'CARD-STUDENT-001',
    '20.00',
  );

  console.log('Seed complete.');
  await pool.end();
}

async function seedFareRules(zoneIds: Map<string, string>): Promise<void> {
  for (const pair of ZONE_PAIR_FARES) {
    const originZoneId = zoneIds.get(pair.from);
    const destinationZoneId = zoneIds.get(pair.to);
    if (!originZoneId || !destinationZoneId) {
      throw new Error(`Missing zone for fare pair ${pair.from}→${pair.to}`);
    }

    const existing = await db.query.fareRules.findFirst({
      where: and(
        eq(fareRules.ruleType, 'ZONE_PAIR'),
        eq(fareRules.originZoneId, originZoneId),
        eq(fareRules.destinationZoneId, destinationZoneId),
      ),
    });
    if (existing) continue;

    await db.insert(fareRules).values({
      ruleType: 'ZONE_PAIR',
      originZoneId,
      destinationZoneId,
      amount: pair.amount,
      priority: 100,
      validFrom: new Date('2020-01-01T00:00:00.000Z'),
    });
  }
  console.log('Fare rules: zone pairs seeded');
}

async function seedDailyCap(): Promise<void> {
  const existing = await db.query.fareCaps.findFirst({
    where: eq(fareCaps.capType, 'DAILY'),
  });
  if (existing) {
    console.log('Daily fare cap already exists — skipped');
    return;
  }
  await db.insert(fareCaps).values({
    capType: 'DAILY',
    amount: '15.00',
    scope: 'ALL_ZONES',
    validFrom: new Date('2020-01-01T00:00:00.000Z'),
  });
  console.log('Daily fare cap: £15.00');
}

async function upsertRider(name: string, discountPercent: string): Promise<string> {
  const existing = await db.query.riderCategories.findFirst({
    where: eq(riderCategories.name, name),
  });
  if (existing) return existing.id;

  const [row] = await db
    .insert(riderCategories)
    .values({ name, discountPercent })
    .returning();
  if (!row) throw new Error(`Failed to insert rider category ${name}`);
  return row.id;
}

async function upsertZone(code: string, name: string): Promise<string> {
  const existing = await db.query.zones.findFirst({
    where: eq(zones.code, code),
  });
  if (existing) return existing.id;

  const [row] = await db.insert(zones).values({ code, name }).returning();
  if (!row) throw new Error(`Failed to insert zone ${code}`);
  return row.id;
}

async function upsertStation(code: string, name: string, zoneId: string): Promise<string> {
  const existing = await db.query.stations.findFirst({
    where: eq(stations.code, code),
  });
  if (existing) return existing.id;

  const [row] = await db.insert(stations).values({ code, name, zoneId }).returning();
  if (!row) throw new Error(`Failed to insert station ${code}`);
  return row.id;
}

async function upsertValidator(
  stationId: string,
  validatorCode: string,
  type: 'ENTRY_GATE' | 'EXIT_GATE',
): Promise<void> {
  const existing = await db.query.validators.findFirst({
    where: eq(validators.validatorCode, validatorCode),
  });
  if (existing) return;

  await db.insert(validators).values({
    stationId,
    validatorCode,
    type,
    status: 'ONLINE',
  });
}

async function upsertDemoUser(
  email: string,
  firstName: string,
  lastName: string,
  riderCategoryId: string,
  mediaToken: string,
  balance: string,
): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    console.log(`User ${email} already exists — skipped`);
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName,
        lastName,
      })
      .returning();
    if (!user) throw new Error(`Failed to create user ${email}`);

    const [account] = await tx
      .insert(transitAccounts)
      .values({
        userId: user.id,
        riderCategoryId,
      })
      .returning();
    if (!account) throw new Error(`Failed to create account for ${email}`);

    await tx.insert(wallets).values({
      accountId: account.id,
      balance,
    });

    await tx.insert(fareMedia).values({
      transitAccountId: account.id,
      token: mediaToken,
      mediaType: 'TRANSIT_CARD',
    });
  });

  console.log(`User: ${email} / password123 (${mediaToken}, £${balance})`);
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
