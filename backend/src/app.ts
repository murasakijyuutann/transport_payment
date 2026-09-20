import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { walletRouter } from './routes/wallet.js';
import { adminRouter } from './routes/admin.js';
import { tapRouter } from './routes/tap.js';
import { journeyRouter } from './routes/journey.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', accountRouter);
  app.use('/api', walletRouter);
  app.use('/api', adminRouter);
  app.use('/api', tapRouter);
  app.use('/api', journeyRouter);
  app.use(errorHandler);
  return app;
}
