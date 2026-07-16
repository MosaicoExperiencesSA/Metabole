-- Note dello staff sul LEAD (scheda CRM): valgono anche per i lead puri senza account.
CREATE TABLE "crm_note" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_note_record_id_idx" ON "crm_note"("record_id");

ALTER TABLE "crm_note" ADD CONSTRAINT "crm_note_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "crm_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_note" ADD CONSTRAINT "crm_note_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
