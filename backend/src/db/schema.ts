import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  pgEnum,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'SUSPENDED', 'CLOSED']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'SUSPENDED']);
export const mediaTypeEnum = pgEnum('media_type', [
  'TRANSIT_CARD',
  'CONTACTLESS_BANK_CARD',
  'MOBILE_WALLET',
  'QR_CODE',
]);
export const mediaStatusEnum = pgEnum('media_status', ['ACTIVE', 'BLOCKED', 'EXPIRED']);
export const validatorTypeEnum = pgEnum('validator_type', [
  'ENTRY_GATE',
  'EXIT_GATE',
  'BIDIRECTIONAL_GATE',
  'BUS_READER',
  'INSPECTION_TERMINAL',
]);
export const validatorStatusEnum = pgEnum('validator_status', [
  'ONLINE',
  'OFFLINE',
  'MAINTENANCE',
]);
export const paymentTransactionTypeEnum = pgEnum('payment_transaction_type', [
  'TOP_UP',
  'BANK_CHARGE',
  'REFUND',
  'DEBT_RECOVERY',
]);
export const paymentTransactionStatusEnum = pgEnum('payment_transaction_status', [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const riderCategories = pgTable('rider_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 32 }).notNull().unique(),
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
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  riderCategoryId: uuid('rider_category_id')
    .notNull()
    .references(() => riderCategories.id),
  status: accountStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => transitAccounts.id)
    .unique(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 3 }).notNull().default('GBP'),
});

export const fareMedia = pgTable(
  'fare_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transitAccountId: uuid('transit_account_id')
      .notNull()
      .references(() => transitAccounts.id),
    mediaType: mediaTypeEnum('media_type').notNull().default('TRANSIT_CARD'),
    token: varchar('token', { length: 64 }).notNull(),
    status: mediaStatusEnum('status').notNull().default('ACTIVE'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('fare_media_token_uidx').on(t.token)],
);

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 16 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  zoneId: uuid('zone_id')
    .notNull()
    .references(() => zones.id),
  code: varchar('code', { length: 32 }).notNull().unique(),
});

export const validators = pgTable('validators', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id')
    .notNull()
    .references(() => stations.id),
  validatorCode: varchar('validator_code', { length: 64 }).notNull().unique(),
  type: validatorTypeEnum('type').notNull(),
  status: validatorStatusEnum('status').notNull().default('ONLINE'),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => transitAccounts.id),
  type: paymentTransactionTypeEnum('type').notNull(),
  provider: varchar('provider', { length: 64 }).notNull().default('MOCK'),
  providerReference: varchar('provider_reference', { length: 128 }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('GBP'),
  status: paymentTransactionStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const tapTypeEnum = pgEnum('tap_type', ['ENTRY', 'EXIT']);
export const tapStatusEnum = pgEnum('tap_status', ['ACCEPTED', 'REJECTED', 'PENDING']);
export const journeyStatusEnum = pgEnum('journey_status', [
  'OPEN',
  'COMPLETED',
  'INCOMPLETE_ENTRY',
  'INCOMPLETE_EXIT',
  'EXPIRED',
  'CORRECTED',
]);

export const tapEvents = pgTable('tap_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaId: uuid('media_id')
    .notNull()
    .references(() => fareMedia.id),
  validatorId: uuid('validator_id')
    .notNull()
    .references(() => validators.id),
  stationId: uuid('station_id')
    .notNull()
    .references(() => stations.id),
  tapType: tapTypeEnum('tap_type').notNull(),
  eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  status: tapStatusEnum('status').notNull().default('ACCEPTED'),
});

export const journeys = pgTable(
  'journeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transitAccountId: uuid('transit_account_id')
      .notNull()
      .references(() => transitAccounts.id),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => fareMedia.id),
    entryTapId: uuid('entry_tap_id')
      .notNull()
      .references(() => tapEvents.id),
    exitTapId: uuid('exit_tap_id').references(() => tapEvents.id),
    originStationId: uuid('origin_station_id')
      .notNull()
      .references(() => stations.id),
    destinationStationId: uuid('destination_station_id').references(() => stations.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: journeyStatusEnum('status').notNull().default('OPEN'),
  },
  (t) => [
    uniqueIndex('one_open_journey_per_account')
      .on(t.transitAccountId)
      .where(sql`status = 'OPEN'`),
  ],
);

export const fareChargeStatusEnum = pgEnum('fare_charge_status', [
  'PENDING',
  'CHARGED',
  'WAIVED',
  'REFUNDED',
]);

export const fareRules = pgTable('fare_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleType: varchar('rule_type', { length: 32 }).notNull(),
  originZoneId: uuid('origin_zone_id').references(() => zones.id),
  destinationZoneId: uuid('destination_zone_id').references(() => zones.id),
  transportMode: varchar('transport_mode', { length: 32 }),
  riderCategoryId: uuid('rider_category_id').references(() => riderCategories.id),
  timeBandId: uuid('time_band_id'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  priority: integer('priority').notNull().default(100),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
});

export const fareCalculations = pgTable('fare_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id')
    .notNull()
    .references(() => journeys.id),
  baseFare: numeric('base_fare', { precision: 10, scale: 2 }).notNull(),
  zoneCharge: numeric('zone_charge', { precision: 10, scale: 2 }).notNull().default('0'),
  timeAdjustment: numeric('time_adjustment', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  capAdjustment: numeric('cap_adjustment', { precision: 10, scale: 2 }).notNull().default('0'),
  penalty: numeric('penalty', { precision: 10, scale: 2 }).notNull().default('0'),
  originalFare: numeric('original_fare', { precision: 10, scale: 2 }).notNull(),
  finalFare: numeric('final_fare', { precision: 10, scale: 2 }).notNull(),
  fareRuleId: uuid('fare_rule_id').references(() => fareRules.id),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export const fareCharges = pgTable('fare_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id')
    .notNull()
    .references(() => journeys.id),
  fareCalculationId: uuid('fare_calculation_id')
    .notNull()
    .references(() => fareCalculations.id),
  accountId: uuid('account_id')
    .notNull()
    .references(() => transitAccounts.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: fareChargeStatusEnum('status').notNull().default('PENDING'),
  chargedAt: timestamp('charged_at', { withTimezone: true }),
});
