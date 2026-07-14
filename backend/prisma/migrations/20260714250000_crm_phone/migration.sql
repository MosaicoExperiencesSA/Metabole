-- Telefono sul lead CRM: chiave (con l'email) per lead importati senza account.
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE INDEX IF NOT EXISTS "crm_record_phone_idx" ON "crm_record"("phone");
CREATE INDEX IF NOT EXISTS "crm_record_email_idx" ON "crm_record"("email");
