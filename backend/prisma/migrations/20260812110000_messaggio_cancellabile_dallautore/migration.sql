-- «Chi scrive il messaggio deve poterlo cancellare» (Simone, 11/8).
--
-- Cancellazione MORBIDA e non `DELETE`: la conversazione fra una cliente e chi la segue è materia
-- sanitaria, e un consiglio dato e poi tolto resta un consiglio dato. Il messaggio sparisce da tutte
-- le letture — cliente e staff — e resta nel database per chi un domani debba ricostruire i fatti.
--
-- Nessun backfill: `NULL` = «non cancellato», che è lo stato di tutti i messaggi esistenti.
-- Nessuna foreign key su `deleted_by_id`: chi cancella è sempre l'autore, che è già in
-- `sender_user_id`; la colonna serve a leggere la riga senza doverlo dedurre.

ALTER TABLE "message"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_id" TEXT;

-- L'indice serve alle letture, che da ora filtrano SEMPRE `deleted_at IS NULL`.
CREATE INDEX "message_thread_id_deleted_at_idx" ON "message"("thread_id", "deleted_at");
