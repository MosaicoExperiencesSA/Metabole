-- Varianti pasti nelle famiglie diete: 3 pasti / 5 pasti / digiuno intermittente.
-- rule_preset.meals: dimensione della variante ('3' | '5' | 'fasting'); null = 5 (storico).
ALTER TABLE "rule_preset" ADD COLUMN "meals" TEXT;
-- Le definizioni esistenti hanno sempre generato cataloghi a 5 pasti: backfill esplicito.
UPDATE "rule_preset" SET "meals" = '5' WHERE "meals" IS NULL;
-- diet.fasting: la dieta generata è a digiuno intermittente 16:8 (pasti in finestra 12-20).
ALTER TABLE "diet" ADD COLUMN "fasting" BOOLEAN NOT NULL DEFAULT false;
