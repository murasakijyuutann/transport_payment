# Phase 1 — Account + Network Data

**Duration estimate:** 3–4 days  
**Depends on:** Phase 0 complete  
**Unlocks:** Phase 2 (taps need media + validators)  
**Deliverable:** register → login → top up wallet → see balance; stations listable.

---

## 1. Why this phase exists

Account-Based Ticketing separates:

| Concept | Entity | Role |
|---------|--------|------|
| Login identity | `User` | email/password, JWT subject |
| Travel identity | `TransitAccount` | rider category, owns media + wallet |
| Token presented at gate | `FareMedia` | token string validators read |
| Stored value | `Wallet` | balance (ledger details in Phase 4) |
| Network | `Zone` → `Station` → `Validator` | where taps happen |

**Why not put balance on `User` (as the Java prototype does):** admins can be users without wallets; future parent/child accounts share one login with multiple transit accounts; journeys should hang off `TransitAccount`, not `User`.

**Why `FareMedia` instead of payment `Card`:** the Java `Card` models Visa/Mastercard for top-up. Transit tokens are a different domain concept. Keep `PaymentTransaction` for external money later; media is only an identifier.

---

## 2. Ordered work checklist

### Step 1.1 — Drizzle schema (account + network)

Add tables in `backend/src/db/schema.ts` in dependency order:

```text
rider_categories
users
transit_accounts          → users, rider_categories
wallets                   → transit_accounts (1:1)
fare_media                → transit_accounts
zones
stations                  → zones
validators                → stations
payment_transactions      → transit_accounts  (optional but useful for mock top-up audit)
```

#### Scaffold: enums + core tables

```typescript
// backend/src/db/schema.ts (excerpt)
import {
  pgTable, uuid, varchar, text, timestamp, numeric,
  pgEnum, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'SUSPENDED', 'CLOSED']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'SUSPENDED']);
export const mediaTypeEnum = pgEnum('media_type', [
  'TRANSIT_CARD', 'CONTACTLESS_BANK_CARD', 'MOBILE_WALLET', 'QR_CODE',
]);
export const mediaStatusEnum = pgEnum('media_status', ['ACTIVE', 'BLOCKED', 'EXPIRED']);
export const validatorTypeEnum = pgEnum('validator_type', [
  'ENTRY_GATE', 'EXIT_GATE', 'BIDIRECTIONAL_GATE', 'BUS_READER', 'INSPECTION_TERMINAL',
]);
export const validatorStatusEnum = pgEnum('validator_status', ['ONLINE', 'OFFLINE', 'MAINTENANCE']);

export const riderCategories = pgTable('rider_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 32 }).notNull(), // ADULT | STUDENT | ...
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transitAccounts = pgTable('transit_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  riderCategoryId: uuid('rider_category_id').notNull().references(() => riderCategories.id),
  status: accountStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => transitAccounts.id).unique(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 3 }).notNull().default('GBP'),
});

export const fareMedia = pgTable('fare_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  transitAccountId: uuid('transit_account_id').notNull().references(() => transitAccounts.id),
  mediaType: mediaTypeEnum('media_type').notNull().default('TRANSIT_CARD'),
  token: varchar('token', { length: 64 }).notNull(),
  status: mediaStatusEnum('status').notNull().default('ACTIVE'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => ({
  tokenIdx: uniqueIndex('fare_media_token_uidx').on(t.token),
}));

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 16 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  zoneId: uuid('zone_id').notNull().references(() => zones.id),
  code: varchar('code', { length: 32 }).notNull().unique(),
});

export const validators = pgTable('validators', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  validatorCode: varchar('validator_code', { length: 64 }).notNull().unique(),
  type: validatorTypeEnum('type').notNull(),
  status: validatorStatusEnum('status').notNull().default('ONLINE'),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
});
```

**Why `numeric(10,2)` not float:** money rounding. **Why `timestamptz`:** daily cap midnight (Phase 5) must not drift across local TZ.

**Why unique `fare_media.token`:** taps resolve by token; duplicates would create ambiguous account selection.

Generate migration:

```bash
npm run db:generate && npm run db:migrate
```

### Step 1.2 — Seed script

`backend/src/db/seed.ts` (run via `tsx src/db/seed.ts`):

| Data | Count / values |
|------|----------------|
| Rider categories | ADULT 0%, STUDENT 50% |
| Zones | Zone 1, Zone 2 |
| Stations | 3 per zone (6 total), stable `code`s |
| Validators | Per station: one `ENTRY_GATE` + one `EXIT_GATE` (or one `BIDIRECTIONAL_GATE`) |
| Demo user (optional) | `demo@example.com` / known password, ADULT, media token `CARD-DEMO-001`, wallet £20 |

**Why entry + exit validators:** Phase 2 can infer tap direction from validator type without trusting the client.

Suggested station set (align names with portfolio story):

```text
Zone 1: Central, City Hall, Museum
Zone 2: Riverside, Airport East, Green Park
```

Validator codes like `VAL-CENTRAL-ENTRY-01`, `VAL-CENTRAL-EXIT-01`.

### Step 1.3 — Auth service + routes

```text
POST /api/auth/register
POST /api/auth/login
```

#### Register orchestration (single DB transaction)

```typescript
// Pseudocode — AuthService.register
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values({ email, passwordHash, firstName, lastName }).returning();
  const account = await tx.insert(transitAccounts).values({
    userId: user.id,
    riderCategoryId: adultCategoryId, // default ADULT; allow query param later
  }).returning();
  await tx.insert(wallets).values({ accountId: account.id, balance: '0.00' });
  await tx.insert(fareMedia).values({
    transitAccountId: account.id,
    token: generateToken(), // e.g. CARD- + random
    mediaType: 'TRANSIT_CARD',
  });
});
```

**Why create wallet + media at register:** Phase 2 taps need a token immediately; Phase 4 top-ups need a wallet. Avoid “register then separately create card” UX for v1.

Hash passwords with `bcrypt` (or `argon2`). Issue JWT with payload `{ sub: userId, accountId }` so account routes do not re-query user→account every time (still verify account exists on sensitive ops).

```typescript
// middleware/auth.ts
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError(401, 'Unauthorized');
  req.auth = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  next();
}
```

### Step 1.4 — Account + wallet + admin routes

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | `/api/account` | yes | account, rider category, media tokens, wallet balance |
| POST | `/api/wallet/topup` | yes | body `{ amount }` → mock credit balance |
| GET | `/api/admin/stations` | yes (or public for demo) | stations + zone codes |

#### Top-up in Phase 1 (intentionally incomplete ledger)

```typescript
await db.transaction(async (tx) => {
  // 1. INSERT payment_transactions (type TOP_UP, status COMPLETED, provider MOCK)
  // 2. UPDATE wallets SET balance = balance + amount
});
```

**Why not full ledger yet:** Phase 4 owns `wallet_ledger_entries` and the append-only rules. Phase 1 only needs a visible balance so you can demo money before travel. When Phase 4 lands, **migrate top-up** to also write a `TOP_UP` ledger row (and backfill if needed).

Validate `amount > 0` and cap a max top-up (e.g. £100) to avoid absurd balances in demos.

### Step 1.5 — Shared response types

```typescript
// backend/src/shared/types.ts
export interface AccountView {
  accountId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  riderCategory: { name: string; discountPercent: string };
  media: Array<{ token: string; mediaType: string; status: string }>;
  wallet: { balance: string; currency: string };
}
```

Frontend will copy/mirror these in Phase 7; keep field names stable now.

---

## 3. Suggested file map

```text
backend/src/
├── routes/
│   ├── auth.ts
│   ├── account.ts
│   ├── wallet.ts
│   └── admin.ts
├── services/
│   ├── AuthService.ts
│   ├── AccountService.ts
│   └── WalletService.ts      # top-up only for now
├── middleware/
│   └── auth.ts
└── db/
    ├── schema.ts
    ├── seed.ts
    └── migrations/...
```

---

## 4. Reasoning: design choices to stick with

1. **Default rider category ADULT on register** — student can be switched later via admin or seed; don’t build category UI in Phase 1.
2. **One transit account per user in v1** — schema allows 1:N later; service assumes 1:1 for simplicity.
3. **Only `TRANSIT_CARD` media type issued** — enum still lists others for portfolio narrative.
4. **Admin stations can be loosely protected** — for portfolio, JWT on all `/api/account*` and `/api/wallet*` is enough; open stations list is OK for tap simulator.

---

## 5. Acceptance criteria

- [ ] Migrations apply cleanly on empty `transport_abt`
- [ ] Seed creates zones, stations, validators, rider categories
- [ ] Register creates user + account + wallet + media token
- [ ] Login returns JWT
- [ ] `GET /api/account` returns balance and token
- [ ] Top-up increases balance (verify with second GET)
- [ ] `GET /api/admin/stations` returns 6 stations with zone info
- [ ] Duplicate email register returns 409

## 6. Out of scope

- Tap events, journeys, fare rules
- Ledger entries
- Frontend pages (curl/Postman is fine)
- Changing Java Flyway schema

## 7. Handoff notes for Phase 2

You will need:

- Lookup `fare_media` by `token`
- Lookup `validators` by `validatorCode` (or UUID) including `stationId` + `type`
- Account status checks

Export small repo helpers now if useful:

```typescript
findMediaByToken(token: string)
findValidatorByCode(code: string)
```
