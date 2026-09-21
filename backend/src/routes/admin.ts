import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AccountService } from '../services/AccountService.js';
import { JourneyService } from '../services/JourneyService.js';

export const adminRouter = Router();
const accountService = new AccountService();
const journeyService = new JourneyService();

/** Public catalog for tap simulator UI (no secrets). */
adminRouter.get('/admin/stations', async (_req, res, next) => {
  try {
    const stations = await accountService.listStations();
    res.json(stations);
  } catch (err) {
    next(err);
  }
});

/** Ops: run incomplete-journey expiry immediately (STAFF only). */
adminRouter.post(
  '/admin/jobs/expire-journeys',
  requireAuth,
  requireRole('STAFF'),
  async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      if (!auth) {
        throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
      }
      const result = await journeyService.expireOpenJourneys(new Date());
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
