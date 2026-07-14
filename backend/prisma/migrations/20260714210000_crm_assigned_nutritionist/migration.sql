-- Ref code anche per la NUTRIZIONISTA in registrazione: la scelta esplicita della
-- cliente si salva sul lead (come per la coach) e si propaga al profilo all'onboarding.
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "assigned_nutritionist_id" TEXT;
ALTER TABLE "crm_record" DROP CONSTRAINT IF EXISTS "crm_record_assigned_nutritionist_id_fkey";
ALTER TABLE "crm_record" ADD CONSTRAINT "crm_record_assigned_nutritionist_id_fkey"
  FOREIGN KEY ("assigned_nutritionist_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "crm_record_assigned_nutritionist_id_idx" ON "crm_record"("assigned_nutritionist_id");
