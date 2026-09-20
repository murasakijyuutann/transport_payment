CREATE TYPE "public"."journey_status" AS ENUM('OPEN', 'COMPLETED', 'INCOMPLETE_ENTRY', 'INCOMPLETE_EXIT', 'EXPIRED', 'CORRECTED');--> statement-breakpoint
CREATE TYPE "public"."tap_status" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."tap_type" AS ENUM('ENTRY', 'EXIT');--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transit_account_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"entry_tap_id" uuid NOT NULL,
	"exit_tap_id" uuid,
	"origin_station_id" uuid NOT NULL,
	"destination_station_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "journey_status" DEFAULT 'OPEN' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tap_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"validator_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"tap_type" "tap_type" NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "tap_status" DEFAULT 'ACCEPTED' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_transit_account_id_transit_accounts_id_fk" FOREIGN KEY ("transit_account_id") REFERENCES "public"."transit_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_media_id_fare_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."fare_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_entry_tap_id_tap_events_id_fk" FOREIGN KEY ("entry_tap_id") REFERENCES "public"."tap_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_exit_tap_id_tap_events_id_fk" FOREIGN KEY ("exit_tap_id") REFERENCES "public"."tap_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_origin_station_id_stations_id_fk" FOREIGN KEY ("origin_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_destination_station_id_stations_id_fk" FOREIGN KEY ("destination_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_events" ADD CONSTRAINT "tap_events_media_id_fare_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."fare_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_events" ADD CONSTRAINT "tap_events_validator_id_validators_id_fk" FOREIGN KEY ("validator_id") REFERENCES "public"."validators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_events" ADD CONSTRAINT "tap_events_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_journey_per_account" ON "journeys" USING btree ("transit_account_id") WHERE status = 'OPEN';