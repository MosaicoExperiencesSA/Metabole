-- Nota libera dello staff sul cliente (una per cliente).
CREATE TABLE "client_note" (
    "client_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_note_pkey" PRIMARY KEY ("client_id")
);

ALTER TABLE "client_note"
    ADD CONSTRAINT "client_note_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_note"
    ADD CONSTRAINT "client_note_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
