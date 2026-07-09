-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('wedding', 'baptism', 'dinner', 'monthly_cheat', 'vacation', 'other');

-- CreateEnum
CREATE TYPE "EventMode" AS ENUM ('single_event', 'pause_period');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('inapp', 'email', 'push');

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "label" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "mode" "EventMode" NOT NULL,
    "plan_phase_state" TEXT,
    "start_weight_kg" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'inapp',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_client_id_start_date_idx" ON "event"("client_id", "start_date");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_user_id_type_scheduled_for_idx" ON "notification"("user_id", "type", "scheduled_for");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
