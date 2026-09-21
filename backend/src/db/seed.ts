import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import { journeys } from './schema.js';
import { seedNetworkAndRules, upsertDemoUser } from './seedCore.js';
import { TapService } from '../services/TapService.js';
import { WalletService } from '../services/WalletService.js';

async function seed() {
  console.log('Seeding transport_abt…');

  const { adultId, studentId } = await seedNetworkAndRules();
  console.log('Network, fare rules, and daily cap ready');

  const demo = await upsertDemoUser(
    'demo@example.com',
    'Demo',
    'Rider',
    adultId,
    'CARD-DEMO-001',
    '0.00',
  );
  if (demo.created) {
    await new WalletService().topUp(demo.accountId, 20);
    console.log('User: demo@example.com / password123 (CARD-DEMO-001, £20)');
  } else {
    console.log('User demo@example.com already exists — skipped create');
  }

  const student = await upsertDemoUser(
    'student@example.com',
    'Student',
    'Rider',
    studentId,
    'CARD-STUDENT-001',
    '0.00',
  );
  if (student.created) {
    await new WalletService().topUp(student.accountId, 20);
    console.log('User: student@example.com / password123 (CARD-STUDENT-001, £20)');
  } else {
    console.log('User student@example.com already exists — skipped create');
  }

  await seedDemoStory(student.accountId);

  const staff = await upsertDemoUser(
    'staff@example.com',
    'Ops',
    'Staff',
    adultId,
    'CARD-STAFF-001',
    '0.00',
    'STAFF',
  );
  if (staff.created) {
    console.log('User: staff@example.com / password123 (STAFF, CARD-STAFF-001)');
  } else {
    console.log('User staff@example.com already exists — role ensured STAFF');
  }

  console.log('Seed complete.');
  await pool.end();
}

/**
 * Rich demo state on the student account:
 * - 2 completed zone 1→2 trips (discounted)
 * - 1 OPEN journey started 5h ago (expire-job demo)
 */
export async function seedDemoStory(accountId: string): Promise<void> {
  const existing = await db.query.journeys.findFirst({
    where: eq(journeys.transitAccountId, accountId),
  });
  if (existing) {
    console.log('Demo story journeys already present — skipped');
    return;
  }

  const taps = new TapService();
  const mediaToken = 'CARD-STUDENT-001';

  const trip1Start = new Date(Date.now() - 3 * 3600_000);
  await taps.handleTap({
    mediaToken,
    validatorId: 'VAL-CENTRAL-ENTRY-01',
    timestamp: trip1Start.toISOString(),
  });
  await taps.handleTap({
    mediaToken,
    validatorId: 'VAL-RIVERSIDE-EXIT-01',
    timestamp: new Date(trip1Start.getTime() + 20 * 60_000).toISOString(),
  });

  const trip2Start = new Date(Date.now() - 90 * 60_000);
  await taps.handleTap({
    mediaToken,
    validatorId: 'VAL-CITYHALL-ENTRY-01',
    timestamp: trip2Start.toISOString(),
  });
  await taps.handleTap({
    mediaToken,
    validatorId: 'VAL-AIRPORT_EAST-EXIT-01',
    timestamp: new Date(trip2Start.getTime() + 25 * 60_000).toISOString(),
  });

  const openStart = new Date(Date.now() - 5 * 3600_000);
  const open = await taps.handleTap({
    mediaToken,
    validatorId: 'VAL-MUSEUM-ENTRY-01',
    timestamp: new Date().toISOString(),
  });
  await db
    .update(journeys)
    .set({ startedAt: openStart })
    .where(eq(journeys.id, open.journeyId));

  console.log(
    'Demo story: 2 completed student trips + 1 OPEN journey (5h old) for expire demo',
  );
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
