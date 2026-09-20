CREATE TYPE "public"."fare_charge_status" AS ENUM('PENDING', 'CHARGED', 'WAIVED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "fare_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"base_fare" numeric(10, 2) NOT NULL,
	"zone_charge" numeric(10, 2) DEFAULT '0' NOT NULL,
	"time_adjustment" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cap_adjustment" numeric(10, 2) DEFAULT '0' NOT NULL,
	"penalty" numeric(10, 2) DEFAULT '0' NOT NULL,
	"original_fare" numeric(10, 2) NOT NULL,
	"final_fare" numeric(10, 2) NOT NULL,
	"fare_rule_id" uuid,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"fare_calculation_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "fare_charge_status" DEFAULT 'PENDING' NOT NULL,
	"charged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fare_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" varchar(32) NOT NULL,
	"origin_zone_id" uuid,
	"destination_zone_id" uuid,
	"transport_mode" varchar(32),
	"rider_category_id" uuid,
	"time_band_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fare_calculations" ADD CONSTRAINT "fare_calculations_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_calculations" ADD CONSTRAINT "fare_calculations_fare_rule_id_fare_rules_id_fk" FOREIGN KEY ("fare_rule_id") REFERENCES "public"."fare_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_charges" ADD CONSTRAINT "fare_charges_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_charges" ADD CONSTRAINT "fare_charges_fare_calculation_id_fare_calculations_id_fk" FOREIGN KEY ("fare_calculation_id") REFERENCES "public"."fare_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_charges" ADD CONSTRAINT "fare_charges_account_id_transit_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_rules" ADD CONSTRAINT "fare_rules_origin_zone_id_zones_id_fk" FOREIGN KEY ("origin_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_rules" ADD CONSTRAINT "fare_rules_destination_zone_id_zones_id_fk" FOREIGN KEY ("destination_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_rules" ADD CONSTRAINT "fare_rules_rider_category_id_rider_categories_id_fk" FOREIGN KEY ("rider_category_id") REFERENCES "public"."rider_categories"("id") ON DELETE no action ON UPDATE no action;