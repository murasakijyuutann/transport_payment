CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('ACTIVE', 'BLOCKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('TRANSIT_CARD', 'CONTACTLESS_BANK_CARD', 'MOBILE_WALLET', 'QR_CODE');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_type" AS ENUM('TOP_UP', 'BANK_CHARGE', 'REFUND', 'DEBT_RECOVERY');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."validator_status" AS ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."validator_type" AS ENUM('ENTRY_GATE', 'EXIT_GATE', 'BIDIRECTIONAL_GATE', 'BUS_READER', 'INSPECTION_TERMINAL');--> statement-breakpoint
CREATE TABLE "fare_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transit_account_id" uuid NOT NULL,
	"media_type" "media_type" DEFAULT 'TRANSIT_CARD' NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" "media_status" DEFAULT 'ACTIVE' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "payment_transaction_type" NOT NULL,
	"provider" varchar(64) DEFAULT 'MOCK' NOT NULL,
	"provider_reference" varchar(128),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"status" "payment_transaction_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rider_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(32) NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	CONSTRAINT "rider_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"zone_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	CONSTRAINT "stations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rider_category_id" uuid NOT NULL,
	"status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"validator_code" varchar(64) NOT NULL,
	"type" "validator_type" NOT NULL,
	"status" "validator_status" DEFAULT 'ONLINE' NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	CONSTRAINT "validators_validator_code_unique" UNIQUE("validator_code")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	CONSTRAINT "wallets_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "zones_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "fare_media" ADD CONSTRAINT "fare_media_transit_account_id_transit_accounts_id_fk" FOREIGN KEY ("transit_account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_account_id_transit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_accounts" ADD CONSTRAINT "transit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transit_accounts" ADD CONSTRAINT "transit_accounts_rider_category_id_rider_categories_id_fk" FOREIGN KEY ("rider_category_id") REFERENCES "public"."rider_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validators" ADD CONSTRAINT "validators_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_account_id_transit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fare_media_token_uidx" ON "fare_media" USING btree ("token");