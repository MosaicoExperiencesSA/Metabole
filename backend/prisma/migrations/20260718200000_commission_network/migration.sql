-- Rete provvigionale a tre livelli (coach → coordinatrice → manager) e a due
-- livelli (nutrizionista → capo), pagata PER DIFFERENZA su percentuali per piano/prodotto.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'coach_coordinator';

ALTER TABLE "plan" ADD COLUMN "commission_coach_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN "commission_coordinator_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN "commission_manager_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN "commission_nutritionist_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN "commission_head_nutritionist_pct" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "product" ADD COLUMN "commission_coach_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN "commission_coordinator_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN "commission_manager_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN "commission_nutritionist_pct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN "commission_head_nutritionist_pct" INTEGER NOT NULL DEFAULT 0;
