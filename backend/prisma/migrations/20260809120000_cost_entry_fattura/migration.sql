-- Fattura allegata alla voce di costo (richiesta di Simone, 8/8): «in contabilità nei costi mi
-- piacerebbe poter allegare le fatture in modo da avere tutto insieme».
--
-- Stesso schema già usato per le contabili dei pagamenti (`payment.receipt_*`): il file sta nella
-- riga, cifrato AES-256-GCM con FILE_ENCRYPTION_KEY, nel formato iv(12) + authTag(16) + ciphertext.
-- Non si appoggia alla tabella `document` perché quella è legata a un `client_id`: una fattura di
-- un fornitore non è il documento di una cliente, e agganciarla lì vorrebbe dire rendere nullable
-- una relazione che oggi garantisce che ogni documento sanitario abbia una proprietaria.
--
-- Tutte nullable: i costi già registrati non hanno una fattura e restano validi così.
ALTER TABLE "cost_entry" ADD COLUMN IF NOT EXISTS "invoice_data" BYTEA;
ALTER TABLE "cost_entry" ADD COLUMN IF NOT EXISTS "invoice_mime" TEXT;
ALTER TABLE "cost_entry" ADD COLUMN IF NOT EXISTS "invoice_name" TEXT;
