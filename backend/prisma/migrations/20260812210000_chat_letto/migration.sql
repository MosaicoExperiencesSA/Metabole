-- §Chat (12/8) — «un pallino rosso se il cliente ha scritto dall'ultima visita nella pagina».
-- Fin dove ha letto ogni PERSONA in ogni conversazione. Per persona e non per conversazione: il
-- capo nutrizionista vede i thread di tutti, e il suo sguardo non deve spegnere il pallino della
-- collega a cui quella paziente è assegnata.
CREATE TABLE "chat_read" (
  "id"        TEXT NOT NULL,
  "user_id"   TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "read_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_read_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_read_user_id_thread_id_key" ON "chat_read"("user_id", "thread_id");
CREATE INDEX "chat_read_user_id_idx" ON "chat_read"("user_id");

ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "chat_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nessun backfill: senza riga, «mai letto» — e la prima apertura della pagina la scrive. Un
-- backfill a `now()` spegnerebbe il pallino su messaggi arrivati e mai visti, che è esattamente
-- il caso che questa tabella esiste per non perdere.
