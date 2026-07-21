-- Scalabilità liste storiche (80k contatti): ricerca/dedup per email e telefono
-- sui lead CRM erano scansioni piene della tabella. Indici dedicati.
CREATE INDEX "crm_record_email_idx" ON "crm_record"("email");
CREATE INDEX "crm_record_phone_idx" ON "crm_record"("phone");

-- Piani in scadenza / scadenza prove: query su status + endDate (cron rinnovi,
-- report). Prima l'accesso era per il solo status con filtro su endDate a valle.
CREATE INDEX "subscription_status_end_date_idx" ON "subscription"("status", "end_date");
