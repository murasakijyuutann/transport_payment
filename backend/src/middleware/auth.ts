import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import type { AuthPayload } from '../shared/types.js';

export type AuthedRequest = Parameters<RequestHandler>[0] & {
  auth?: AuthPayload;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.replace(/^Bearer\s+/i, '');
  if (!token) {
    next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    if (!payload.sub || !payload.accountId) {
      next(new AppError(401, 'Invalid token', 'UNAUTHORIZED'));
      return;
    }
    (req as AuthedRequest).auth = payload;
    next();
  } catch {
    next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }
};

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}
