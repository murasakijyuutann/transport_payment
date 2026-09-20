import { Router } from 'express';
import { AccountService } from '../services/AccountService.js';

export const adminRouter = Router();
const accountService = new AccountService();

/** Public for tap-simulator demos; JWT optional later. */
adminRouter.get('/admin/stations', async (_req, res, next) => {
  try {
    const stations = await accountService.listStations();
    res.json(stations);
  } catch (err) {
    next(err);
  }
});
