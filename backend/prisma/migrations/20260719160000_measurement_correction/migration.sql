-- Correzione misure lo stesso giorno (una sola volta): la misura PRECEDENTE viene salvata
-- qui come "sostituita". I valori correnti della riga restano quelli buoni, quindi grafici e
-- report (che leggono i valori correnti) non conteggiano la misura sostituita.
ALTER TABLE "measurement" ADD COLUMN "replaced_snapshot" JSONB;
