CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'STAFF', 'DEVICE');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'CUSTOMER' NOT NULL;