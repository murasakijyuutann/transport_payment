import { Router } from 'express';
import { AccountService } from '../services/AccountService.js';
import { JourneyService } from '../services/JourneyService.js';

export const adminRouter = Router();
const accountService = new AccountService();
const journeyService = new JourneyService();

/** Public for tap-simulator demos; JWT optional later. */
adminRouter.get('/admin/stations', async (_req, res, next) => {
  try {
    const stations = await accountService.listStations();
    res.json(stations);
  } catch (err) {
    next(err);
  }
});

/** Demo/ops: run incomplete-journey expiry immediately (no wait for cron). */
adminRouter.post('/admin/jobs/expire-journeys', async (_req, res, next) => {
  try {
    const result = await journeyService.expireOpenJourneys(new Date());
    res.json(result);
  } catch (err) {
    next(err);
  }
});
