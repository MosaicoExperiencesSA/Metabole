-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('great', 'good', 'ok', 'hard', 'stressed');

-- CreateTable
CREATE TABLE "measurement" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "waist_cm" DOUBLE PRECISION,
    "hips_cm" DOUBLE PRECISION,
    "thighs_cm" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkin" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" "Mood" NOT NULL,
    "energy" INTEGER,
    "hunger" INTEGER,
    "stress" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_log" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "glasses" INTEGER NOT NULL,
    "goal" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_log" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "goal" INTEGER NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "measurement_client_id_date_key" ON "measurement"("client_id", "date");

-- CreateIndex
CREATE INDEX "measurement_client_id_date_idx" ON "measurement"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkin_client_id_date_key" ON "daily_checkin"("client_id", "date");

-- CreateIndex
CREATE INDEX "daily_checkin_client_id_date_idx" ON "daily_checkin"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "water_log_client_id_date_key" ON "water_log"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "step_log_client_id_date_key" ON "step_log"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_client_id_type_key" ON "milestone"("client_id", "type");

-- CreateIndex
CREATE INDEX "milestone_client_id_idx" ON "milestone"("client_id");

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkin" ADD CONSTRAINT "daily_checkin_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_log" ADD CONSTRAINT "water_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_log" ADD CONSTRAINT "step_log_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
