-- Correzione: la colonna era stata creata come "updatedAt" (camelCase) mentre
-- lo schema la mappa su "updated_at" (@map), causando P2022 sull'endpoint
-- /marketing/lifecycle. Rinomina idempotente: su alcuni ambienti la colonna è
-- già stata rinominata a mano, quindi rinominiamo solo se "updatedAt" esiste
-- ancora. Su un DB nuovo (dove la migration precedente ha creato "updatedAt")
-- la rename avviene normalmente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lifecycle_settings' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "lifecycle_settings" RENAME COLUMN "updatedAt" TO "updated_at";
  END IF;
END $$;
