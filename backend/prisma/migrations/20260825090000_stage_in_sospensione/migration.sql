-- Da quale colonna della pipeline la scheda è stata parcheggiata in «In sospensione»: serve a
-- rimetterla ESATTAMENTE lì al rientro, invece di riportarla genericamente in «Acquisito».
-- Additiva e nullable: nessun backfill, nessuna riga riscritta.
ALTER TABLE "crm_record" ADD COLUMN "stage_prima_sospensione" TEXT;
