-- Nome e cognome separati sul lead, più un alias facoltativo.
-- Il campo `name` NON viene toccato: resta la forma «Nome Cognome» che leggono tabella,
-- pipeline, email e ricevute. Le colonne nuove sono nullable perché i lead importati dalle
-- liste storiche hanno solo il nome intero, e inventare uno split su quelli vorrebbe dire
-- trasformare «Maria Teresa De Santis» in un cognome sbagliato.
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "alias" TEXT;
