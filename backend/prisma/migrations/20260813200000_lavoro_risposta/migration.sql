-- LA RISPOSTA SU UNA VOCE DEI LAVORI (13/8, richiesta di Simone).
--
-- «Se mi dai la possibilità di inserire le risposte… così posso consultarmi e inserire mano a mano,
-- e poi te le esporto al momento giusto.» Molte voci aperte aspettano la risposta di qualcun altro —
-- la nutrizionista, un fornitore — e finora quella risposta viveva in una chat o in una mail, cioè
-- da nessuna parte.
--
-- ⚠️ Campo suo e non dentro `dettaglio`: il dettaglio è la DOMANDA, questa è la risposta. In un campo
-- solo, per aggiungere quello che si è saputo si riscriverebbe quello che si voleva sapere — ed è
-- così che si perde il perché di una voce.
--
-- Additiva: la migrazione precedente (`20260813180000_lavori`) è già applicata in produzione, quindi
-- questa NON la si tocca — si aggiunge.

ALTER TABLE "lavoro" ADD COLUMN "risposta" TEXT;
ALTER TABLE "lavoro" ADD COLUMN "risposta_il" TIMESTAMP(3);
ALTER TABLE "lavoro" ADD COLUMN "risposta_da_id" TEXT;

-- `SET NULL` come per la spunta: se chi ha scritto la risposta lascia l'azienda, la risposta resta e
-- si perde solo il nome.
ALTER TABLE "lavoro" ADD CONSTRAINT "lavoro_risposta_da_id_fkey"
  FOREIGN KEY ("risposta_da_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
