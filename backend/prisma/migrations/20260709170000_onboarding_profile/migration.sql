-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('female', 'male');

-- CreateEnum
CREATE TYPE "Regime" AS ENUM ('omnivore', 'vegetarian', 'vegan');

-- CreateEnum
CREATE TYPE "DietStyle" AS ENUM ('mediterranean', 'protein', 'low_carb', 'flexible');

-- CreateEnum
CREATE TYPE "PathType" AS ENUM ('classic3', 'five', 'supplements', 'intermittent_fasting');

-- CreateEnum
CREATE TYPE "CoachStyle" AS ENUM ('daily', 'when_needed', 'on_request');

-- CreateEnum
CREATE TYPE "Character" AS ENUM ('follows', 'needs_push', 'perseveres', 'quits');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('proposed', 'confirmed', 'achieved', 'revised');

-- CreateEnum
CREATE TYPE "EscalationSource" AS ENUM ('screening', 'coach', 'engine');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "head_nutritionist_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "sex" "Sex",
    "height_cm" INTEGER,
    "start_weight_kg" DOUBLE PRECISION,
    "start_waist_cm" DOUBLE PRECISION,
    "start_hips_cm" DOUBLE PRECISION,
    "regime" "Regime",
    "diet_style" "DietStyle",
    "meals_per_day" INTEGER,
    "path_type" "PathType",
    "coach_style" "CoachStyle",
    "character" "Character",
    "intolerances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disliked_foods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lifestyle" JSONB,
    "theme_color" TEXT,
    "plan_start_date" TIMESTAMP(3),
    "assigned_coach_id" TEXT,
    "assigned_nutritionist_id" TEXT,
    "consents" JSONB,
    "screening_flag" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_answers" JSONB,
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "target_weight_kg" DOUBLE PRECISION,
    "target_waist_cm" DOUBLE PRECISION,
    "target_hips_cm" DOUBLE PRECISION,
    "target_date" TIMESTAMP(3),
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'proposed',
    "confirmed_by_coach_at" TIMESTAMP(3),
    "confirmed_by_nutritionist_at" TIMESTAMP(3),
    "history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "EscalationSource" NOT NULL,
    "assigned_to_id" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_profile_user_id_key" ON "client_profile"("user_id");

-- CreateIndex
CREATE INDEX "client_profile_assigned_coach_id_idx" ON "client_profile"("assigned_coach_id");

-- CreateIndex
CREATE INDEX "client_profile_assigned_nutritionist_id_idx" ON "client_profile"("assigned_nutritionist_id");

-- CreateIndex
CREATE INDEX "objective_client_id_idx" ON "objective"("client_id");

-- CreateIndex
CREATE INDEX "escalation_client_id_idx" ON "escalation"("client_id");

-- CreateIndex
CREATE INDEX "escalation_status_idx" ON "escalation"("status");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_head_nutritionist_id_fkey" FOREIGN KEY ("head_nutritionist_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_assigned_coach_id_fkey" FOREIGN KEY ("assigned_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_assigned_nutritionist_id_fkey" FOREIGN KEY ("assigned_nutritionist_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective" ADD CONSTRAINT "objective_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
