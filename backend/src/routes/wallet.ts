import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { WalletService } from '../services/WalletService.js';

export const walletRouter = Router();
const walletService = new WalletService();

const topUpSchema = z.object({
  amount: z.number().positive(),
});

walletRouter.post('/wallet/topup', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const parsed = topUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid top-up payload', 'VALIDATION_ERROR');
    }
    const account = await walletService.topUp(auth.accountId, parsed.data.amount);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

walletRouter.get('/account/wallet/ledger', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const ledger = await walletService.getLedger(auth.accountId);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});
