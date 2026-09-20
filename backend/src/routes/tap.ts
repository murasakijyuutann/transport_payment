import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { TapService } from '../services/TapService.js';

export const tapRouter = Router();
const tapService = new TapService();

const tapSchema = z.object({
  mediaToken: z.string().min(1),
  validatorId: z.string().min(1),
  timestamp: z.string().min(1),
});

/** Gate taps identified by media token (validator simulator). */
tapRouter.post('/taps', async (req, res, next) => {
  try {
    const parsed = tapSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid tap payload', 'VALIDATION_ERROR');
    }
    const result = await tapService.handleTap(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
