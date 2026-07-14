-- Provvigioni/compensi PER PRODOTTO in valore assoluto (€), non più percentuali globali.
-- Ogni piano e ogni prodotto porta 4 importi in centesimi (coach, manager coach,
-- nutrizionista, capo nutrizionista). Sostituiscono i 4 config_param percentuali e il
-- flag product.commission_team.
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "commission_coach_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "commission_manager_coach_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "commission_nutritionist_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "commission_head_nutritionist_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "commission_coach_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "commission_manager_coach_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "commission_nutritionist_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "commission_head_nutritionist_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "product" DROP COLUMN IF EXISTS "commission_team";

-- Pulizia: le percentuali globali non servono più.
DELETE FROM "config_param" WHERE "key" IN (
  'commission_coach_percent',
  'commission_manager_coach_percent',
  'commission_nutritionist_percent',
  'commission_head_nutritionist_percent'
);
