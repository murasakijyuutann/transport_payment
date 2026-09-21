import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import './integrationSetup.js';

const app = createApp();

async function register(email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Rider',
    })
    .expect(201);
  return {
    token: res.body.token as string,
    accountId: res.body.account.accountId as string,
    mediaToken: res.body.account.media[0].token as string,
    role: res.body.account.role as string,
  };
}

async function login(email: string, password = 'password123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    token: res.body.token as string,
    role: res.body.account.role as string,
  };
}

describe('S1 ownership & roles', () => {
  it('rejects register payloads that try to set riderCategoryId', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `strict-${Date.now()}@example.com`,
        password: 'password123',
        firstName: 'Hack',
        lastName: 'Attempt',
        riderCategoryId: '00000000-0000-0000-0000-000000000099',
      })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('always assigns ADULT on register (CUSTOMER role)', async () => {
    const user = await register(`adult-${Date.now()}@example.com`);
    expect(user.role).toBe('CUSTOMER');

    const account = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(account.body.riderCategory.name).toBe('ADULT');
    expect(account.body.role).toBe('CUSTOMER');
  });

  it('blocks user A from reading user B journey, fare, and does not leak B ledger', async () => {
    const a = await register(`owner-a-${Date.now()}@example.com`);
    const b = await register(`owner-b-${Date.now()}@example.com`);

    await request(app)
      .post('/api/wallet/topup')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ amount: 20 })
      .expect(200);

    const entry = await request(app)
      .post('/api/taps')
      .send({
        mediaToken: b.mediaToken,
        validatorId: 'VAL-CENTRAL-ENTRY-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    const exit = await request(app)
      .post('/api/taps')
      .send({
        mediaToken: b.mediaToken,
        validatorId: 'VAL-RIVERSIDE-EXIT-01',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    const bJourneyId = exit.body.journeyId as string;
    expect(entry.body.journeyId).toBe(bJourneyId);

    await request(app)
      .get(`/api/account/journeys/${bJourneyId}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(404);

    await request(app)
      .get(`/api/account/journeys/${bJourneyId}/fare`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(404);

    const aLedger = await request(app)
      .get('/api/account/wallet/ledger')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);

    expect(aLedger.body.entries).toEqual([]);

    const bLedger = await request(app)
      .get('/api/account/wallet/ledger')
      .set('Authorization', `Bearer ${b.token}`)
      .expect(200);

    expect(bLedger.body.entries.some((e: { type: string }) => e.type === 'FARE')).toBe(
      true,
    );
  });

  it('forbids CUSTOMER from running expire job; allows STAFF', async () => {
    const customer = await register(`cust-expire-${Date.now()}@example.com`);

    const denied = await request(app)
      .post('/api/admin/jobs/expire-journeys')
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(403);
    expect(denied.body.code).toBe('FORBIDDEN');

    // Ensure staff user exists in test DB (network seeded in beforeAll; create here)
    const { upsertDemoUser, seedNetworkAndRules } = await import('../db/seedCore.js');
    const { adultId } = await seedNetworkAndRules();
    await upsertDemoUser(
      'staff@example.com',
      'Ops',
      'Staff',
      adultId,
      'CARD-STAFF-001',
      '0.00',
      'STAFF',
    );

    const staff = await login('staff@example.com');
    expect(staff.role).toBe('STAFF');

    await request(app)
      .post('/api/admin/jobs/expire-journeys')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
  });

  it('rejects unauthenticated expire job', async () => {
    await request(app).post('/api/admin/jobs/expire-journeys').expect(401);
  });
});
