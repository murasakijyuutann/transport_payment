import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { FareService } from '../services/FareService.js';
import { JourneyService } from '../services/JourneyService.js';

export const journeyRouter = Router();
const journeyService = new JourneyService();
const fareService = new FareService();

journeyRouter.get('/account/journeys', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const list = await journeyService.listForAccount(auth.accountId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

journeyRouter.get('/account/journeys/:id/fare', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
    if (!id) {
      throw new AppError(400, 'Journey id required', 'VALIDATION_ERROR');
    }
    const fare = await fareService.getFareForAccount(auth.accountId, id);
    res.json(fare);
  } catch (err) {
    next(err);
  }
});

journeyRouter.get('/account/journeys/:id', requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
    if (!id) {
      throw new AppError(400, 'Journey id required', 'VALIDATION_ERROR');
    }
    const journey = await journeyService.getForAccount(auth.accountId, id);
    res.json(journey);
  } catch (err) {
    next(err);
  }
});
