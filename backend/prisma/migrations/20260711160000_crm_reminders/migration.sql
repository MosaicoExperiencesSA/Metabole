-- Calendario CRM: promemoria/appuntamenti, opzionalmente legati a un lead/cliente.
CREATE TABLE "crm_reminder" (
    "id" TEXT NOT NULL,
    "crm_record_id" TEXT,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_reminder_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "crm_reminder"
  ADD CONSTRAINT "crm_reminder_crm_record_id_fkey"
  FOREIGN KEY ("crm_record_id") REFERENCES "crm_record"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "crm_reminder_due_at_idx" ON "crm_reminder"("due_at");
CREATE INDEX "crm_reminder_crm_record_id_idx" ON "crm_reminder"("crm_record_id");
