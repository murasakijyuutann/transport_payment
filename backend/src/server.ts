import { createApp } from './app.js';
import { env } from './config/env.js';
import { startIncompleteJourneyJob } from './jobs/incompleteJourneyJob.js';
import { JourneyService } from './services/JourneyService.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
  if (env.ENABLE_CRON) {
    startIncompleteJourneyJob(new JourneyService());
  } else {
    console.log('incompleteJourneyJob skipped (ENABLE_CRON=false)');
  }
});
