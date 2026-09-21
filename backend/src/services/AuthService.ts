import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  fareMedia,
  riderCategories,
  transitAccounts,
  users,
  wallets,
} from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { signToken } from '../middleware/auth.js';
import type { AccountView, UserRole } from '../shared/types.js';
import { AccountService } from './AccountService.js';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  token: string;
  account: AccountView;
}

function generateMediaToken(): string {
  return `CARD-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export class AuthService {
  constructor(private readonly accounts = new AccountService()) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || input.password.length < 8) {
      throw new AppError(400, 'Invalid registration payload', 'VALIDATION_ERROR');
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');
    }

    const adult = await db.query.riderCategories.findFirst({
      where: eq(riderCategories.name, 'ADULT'),
    });
    if (!adult) {
      throw new AppError(500, 'Rider categories not seeded', 'SEED_MISSING');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const { userId, accountId } = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          role: 'CUSTOMER',
        })
        .returning();

      if (!user) {
        throw new AppError(500, 'Failed to create user', 'USER_CREATE_FAILED');
      }

      const [account] = await tx
        .insert(transitAccounts)
        .values({
          userId: user.id,
          riderCategoryId: adult.id,
        })
        .returning();

      if (!account) {
        throw new AppError(500, 'Failed to create transit account', 'ACCOUNT_CREATE_FAILED');
      }

      await tx.insert(wallets).values({
        accountId: account.id,
        balance: '0.00',
      });

      await tx.insert(fareMedia).values({
        transitAccountId: account.id,
        token: generateMediaToken(),
        mediaType: 'TRANSIT_CARD',
      });

      return { userId: user.id, accountId: account.id };
    });

    return this.issueAuth(userId, accountId);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalized = email.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalized),
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const account = await db.query.transitAccounts.findFirst({
      where: eq(transitAccounts.userId, user.id),
    });
    if (!account) {
      throw new AppError(500, 'Transit account missing', 'ACCOUNT_MISSING');
    }
    if (account.status !== 'ACTIVE') {
      throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    return this.issueAuth(user.id, account.id, user.role);
  }

  private async issueAuth(
    userId: string,
    accountId: string,
    role?: UserRole,
  ): Promise<AuthResult> {
    const account = await this.accounts.getAccountView(accountId);
    const resolvedRole = role ?? account.role;
    const token = signToken({ sub: userId, accountId, role: resolvedRole });
    return { token, account };
  }
}
