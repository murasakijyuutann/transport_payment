import cron from 'node-cron';
import { JourneyService } from '../services/JourneyService.js';

export function startIncompleteJourneyJob(journeyService: JourneyService): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { expired, charged } = await journeyService.expireOpenJourneys();
      if (expired > 0) {
        console.log(
          `incompleteJourneyJob: expired=${expired} charged=${charged}`,
        );
      }
    } catch (err) {
      console.error('incompleteJourneyJob failed', err);
    }
  });
  console.log('incompleteJourneyJob scheduled (every 5 minutes)');
}
