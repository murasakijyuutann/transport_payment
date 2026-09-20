import { createApp } from './app.js';
import { env } from './config/env.js';
import { startIncompleteJourneyJob } from './jobs/incompleteJourneyJob.js';
import { JourneyService } from './services/JourneyService.js';

const app = createApp();
const journeyService = new JourneyService();

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
  startIncompleteJourneyJob(journeyService);
});
