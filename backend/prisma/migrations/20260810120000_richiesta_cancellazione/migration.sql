-- REVOCA DEL CONSENSO E CANCELLAZIONE A 30 GIORNI (richiesta di Simone dell'8/8).
--
-- La cliente revoca il consenso al trattamento dei dati sanitari dal suo profilo, scrive ELIMINA a
-- mano, e da lì parte un termine: al 31° giorno i dati sanitari e il percorso vengono cancellati.
-- Nel frattempo può fermare tutto dal link nelle mail («Sospendi l'eliminazione»).
--
-- Perché una tabella e non due colonne sul profilo:
--  - il profilo cliente è **esattamente ciò che viene cancellato**: tenere lo stato della richiesta
--    lì dentro vorrebbe dire cancellare la prova di ciò che è stato fatto insieme al dato;
--  - la richiesta va conservata anche dopo l'esecuzione (chi, quando, chi l'ha sospesa): è la
--    documentazione dell'adempimento, e serve proprio quando qualcuno la contesta.
--
-- FK-less, come le altre tabelle recenti: `client_id` resta valido anche quando l'utenza è stata
-- anonimizzata, e nessun vincolo può impedire la cancellazione che questa tabella governa.
CREATE TABLE IF NOT EXISTS "deletion_request" (
  "id"            TEXT PRIMARY KEY,
  "client_id"     TEXT NOT NULL,
  "requested_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Il giorno in cui si cancella: scritto alla richiesta e mai ricalcolato, così il termine non si
  -- sposta se qualcuno cambia la soglia dei giorni in configurazione mentre l'attesa è in corso.
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  -- pending | suspended | done | cancelled
  "status"        TEXT NOT NULL DEFAULT 'pending',
  -- Hash del token del link «Sospendi»: in chiaro non si conserva, come per i reset password.
  -- Il link vale come firma della cliente, ed è il motivo per cui solo lei può fermare il termine.
  "token_hash"    TEXT NOT NULL,
  "suspended_at"  TIMESTAMP(3),
  "suspended_by"  TEXT,
  "completed_at"  TIMESTAMP(3),
  -- L'avviso «manca un giorno» è già stato mandato: senza questo il cron lo rimanderebbe ogni notte.
  "warned_at"     TIMESTAMP(3),
  -- Cosa è stato cancellato davvero (conteggi per tabella): la ricevuta dell'adempimento.
  "report"        JSONB
);

-- L'indice che serve al cron: «le richieste ancora aperte con termine passato».
CREATE INDEX IF NOT EXISTS "deletion_request_status_scheduled_idx"
  ON "deletion_request" ("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "deletion_request_client_idx" ON "deletion_request" ("client_id");
-- Il token si cerca per hash a ogni clic sul link: senza indice sarebbe una scansione.
CREATE UNIQUE INDEX IF NOT EXISTS "deletion_request_token_hash_key"
  ON "deletion_request" ("token_hash");
