-- Anagrafica fiscale/indirizzo sul lead/cliente CRM (dalle liste storiche o a mano).
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "codice_fiscale" TEXT;
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "address" TEXT;
