import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { journeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { JourneyService } from '../services/JourneyService.js';
import './integrationSetup.js';

const app = createApp();

async function registerAndTopUp(email: string) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Rider',
    })
    .expect(201);

  const token = reg.body.token as string;
  const mediaToken = reg.body.account.media[0].token as string;

  await request(app)
    .post('/api/wallet/topup')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 20 })
    .expect(200);

  return { token, mediaToken };
}

describe('tap → journey → fare → ledger', () => {
  it('completes a round trip and debits the wallet', async () => {
    const { token, mediaToken } = await registerAndTopUp(
      `trip-${Date.now()}@example.com`,
    );

    const entry = await request(app)
      .post('/api/taps')
      .send({
        mediaToken,
        validatorId: 'VAL-CENTRAL-ENTRY-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    expect(entry.body.tapType).toBe('ENTRY');
    expect(entry.body.journeyStatus).toBe('OPEN');

    const exit = await request(app)
      .post('/api/taps')
      .send({
        mediaToken,
        validatorId: 'VAL-RIVERSIDE-EXIT-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    expect(exit.body.tapType).toBe('EXIT');
    expect(exit.body.journeyStatus).toBe('COMPLETED');
    const journeyId = exit.body.journeyId as string;

    const fare = await request(app)
      .get(`/api/account/journeys/${journeyId}/fare`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fare.body.finalFare).toBe('4.00');
    expect(fare.body.charge.status).toBe('CHARGED');

    const ledger = await request(app)
      .get('/api/account/wallet/ledger')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(ledger.body.balance).toBe('16.00');
    const types = (ledger.body.entries as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain('TOP_UP');
    expect(types).toContain('FARE');
  });

  it('rejects a second ENTRY while a journey is open', async () => {
    const { mediaToken } = await registerAndTopUp(`double-${Date.now()}@example.com`);

    await request(app)
      .post('/api/taps')
      .send({
        mediaToken,
        validatorId: 'VAL-CENTRAL-ENTRY-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    const second = await request(app)
      .post('/api/taps')
      .send({
        mediaToken,
        validatorId: 'VAL-CITYHALL-ENTRY-01',
        timestamp: new Date().toISOString(),
      })
      .expect(409);

    expect(second.body.code).toBe('JOURNEY_ALREADY_OPEN');
  });

  it('expires a backdated OPEN journey and charges the penalty', async () => {
    const { token, mediaToken } = await registerAndTopUp(
      `expire-${Date.now()}@example.com`,
    );

    const entry = await request(app)
      .post('/api/taps')
      .send({
        mediaToken,
        validatorId: 'VAL-MUSEUM-ENTRY-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    const journeyId = entry.body.journeyId as string;
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600_000);
    await db.update(journeys).set({ startedAt: fiveHoursAgo }).where(eq(journeys.id, journeyId));

    const result = await new JourneyService().expireOpenJourneys(new Date());
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(result.charged).toBeGreaterThanOrEqual(1);

    const fare = await request(app)
      .get(`/api/account/journeys/${journeyId}/fare`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fare.body.penalty).toBe('5.00');
    expect(fare.body.finalFare).toBe('5.00');
    expect(fare.body.charge.status).toBe('CHARGED');

    const account = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(account.body.wallet.balance).toBe('15.00');
  });
});
