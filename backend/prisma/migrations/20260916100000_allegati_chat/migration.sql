-- GLI ALLEGATI DELLE CHAT — Simone, 16/9/2026: «nelle chat tutte, anche quella del Nutrizionista,
-- mettiamo la possibilità di allegare un file, immagine, ecc».
--
-- Una tabella nuova e basta: nessuna colonna toccata su quelle che ci sono, quindi il giorno del
-- deploy non cambia niente per nessuno finché qualcuno non allega un file.
--
-- `data` è cifrato (iv 12 byte + authTag 16 byte + ciphertext), come in "document".
-- ON DELETE CASCADE: se un messaggio sparisce davvero (cancellazione dell'account), l'allegato va con lui.
CREATE TABLE "message_attachment" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_attachment_message_id_idx" ON "message_attachment"("message_id");

ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
