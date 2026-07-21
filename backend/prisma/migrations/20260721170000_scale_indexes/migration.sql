-- Scalabilità liste storiche (80k contatti): ricerca/dedup per email e telefono
-- sui lead CRM erano scansioni piene della tabella. Indici dedicati.
-- IF NOT EXISTS: la migration è ripetibile in sicurezza anche se un tentativo
-- precedente aveva già creato uno o più indici (recupero da stato P3009).
CREATE INDEX IF NOT EXISTS "crm_record_email_idx" ON "crm_record"("email");
CREATE INDEX IF NOT EXISTS "crm_record_phone_idx" ON "crm_record"("phone");

-- Piani in scadenza / scadenza prove: query su status + endDate (cron rinnovi,
-- report). Prima l'accesso era per il solo status con filtro su endDate a valle.
CREATE INDEX IF NOT EXISTS "subscription_status_end_date_idx" ON "subscription"("status", "end_date");
