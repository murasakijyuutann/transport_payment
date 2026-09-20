/**
 * One-off / EventBridge entrypoint for incomplete-journey expiry.
 * Usage: node dist/jobs/expireIncompleteJourneys.js
 * Do not run node-cron inside every API task when desiredCount > 1.
 */
import { pool } from '../db/index.js';
import { JourneyService } from '../services/JourneyService.js';

async function main(): Promise<void> {
  const result = await new JourneyService().expireOpenJourneys(new Date());
  console.log(
    JSON.stringify({
      event: 'expire_complete',
      expired: result.expired,
      charged: result.charged,
      at: new Date().toISOString(),
    }),
  );
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ event: 'expire_failed', error: String(err) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
