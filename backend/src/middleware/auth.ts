import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { transitAccounts, users } from '../db/schema.js';
import { AppError } from './errorHandler.js';
import type { AuthPayload, UserRole } from '../shared/types.js';

export type AuthedRequest = Parameters<RequestHandler>[0] & {
  auth?: AuthPayload;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
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

      const user = await db.query.users.findFirst({
        where: eq(users.id, payload.sub),
      });
      if (!user || user.status !== 'ACTIVE') {
        next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
        return;
      }

      const account = await db.query.transitAccounts.findFirst({
        where: eq(transitAccounts.id, payload.accountId),
      });
      if (!account || account.userId !== user.id || account.status !== 'ACTIVE') {
        next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
        return;
      }

      (req as AuthedRequest).auth = {
        sub: user.id,
        accountId: account.id,
        role: user.role,
      };
      next();
    } catch (err) {
      if (err instanceof AppError) {
        next(err);
        return;
      }
      next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }
  })();
};

export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
      return;
    }
    if (!allowed.includes(auth.role)) {
      next(new AppError(403, 'Forbidden', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(
    { sub: payload.sub, accountId: payload.accountId, role: payload.role },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}
