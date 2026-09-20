import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AccountService } from '../services/AccountService.js';
import { CapService } from '../services/CapService.js';

export const accountRouter = Router();
const accountService = new AccountService();
const capService = new CapService();

accountRouter.get('/account', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const account = await accountService.getAccountView(auth.accountId);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

accountRouter.get('/account/cap-status', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const status = await capService.getCapStatus(auth.accountId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});
