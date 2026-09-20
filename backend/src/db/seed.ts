import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  fareMedia,
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

async function seed() {
  console.log('Seeding transport_abt…');

  const adultId = await upsertRider('ADULT', '0.00');
  await upsertRider('STUDENT', '50.00');

  for (const zoneDef of NETWORK) {
    const zoneId = await upsertZone(zoneDef.zoneCode, zoneDef.zoneName);
    for (const stationDef of zoneDef.stations) {
      const stationId = await upsertStation(stationDef.code, stationDef.name, zoneId);
      await upsertValidator(stationId, `VAL-${stationDef.code}-ENTRY-01`, 'ENTRY_GATE');
      await upsertValidator(stationId, `VAL-${stationDef.code}-EXIT-01`, 'EXIT_GATE');
    }
  }

  await upsertDemoUser(adultId);

  console.log('Seed complete.');
  await pool.end();
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

async function upsertDemoUser(adultCategoryId: string): Promise<void> {
  const email = 'demo@example.com';
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    console.log('Demo user already exists — skipped');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName: 'Demo',
        lastName: 'Rider',
      })
      .returning();
    if (!user) throw new Error('Failed to create demo user');

    const [account] = await tx
      .insert(transitAccounts)
      .values({
        userId: user.id,
        riderCategoryId: adultCategoryId,
      })
      .returning();
    if (!account) throw new Error('Failed to create demo account');

    await tx.insert(wallets).values({
      accountId: account.id,
      balance: '20.00',
    });

    await tx.insert(fareMedia).values({
      transitAccountId: account.id,
      token: 'CARD-DEMO-001',
      mediaType: 'TRANSIT_CARD',
    });
  });

  console.log('Demo user: demo@example.com / password123 (CARD-DEMO-001, £20)');
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
