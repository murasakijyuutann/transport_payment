CREATE TABLE "fare_accumulators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"period_type" varchar(16) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"eligible_spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"charged_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cap_amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_caps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cap_type" varchar(16) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"scope" varchar(32) DEFAULT 'ALL_ZONES' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fare_accumulators" ADD CONSTRAINT "fare_accumulators_account_id_transit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fare_acc_account_period_uidx" ON "fare_accumulators" USING btree ("account_id","period_type","period_start");