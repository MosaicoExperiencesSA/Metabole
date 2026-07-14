-- Liste CRM: raggruppamenti manuali (N:N) di lead/clienti + campi storici sul lead.

-- Storico pre-Metabole sul lead (solo informativo, non entra in contabilità).
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "previous_status" TEXT;
ALTER TABLE "crm_record" ADD COLUMN IF NOT EXISTS "historical_paid_cents" INTEGER;

-- Liste.
CREATE TABLE IF NOT EXISTS "crm_list" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "color"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_list_pkey" PRIMARY KEY ("id")
);

-- Appartenenza lead ↔ lista (chiave composta).
CREATE TABLE IF NOT EXISTS "crm_list_member" (
  "list_id"   TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "added_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_list_member_pkey" PRIMARY KEY ("list_id", "record_id")
);
CREATE INDEX IF NOT EXISTS "crm_list_member_record_id_idx" ON "crm_list_member"("record_id");

ALTER TABLE "crm_list_member" DROP CONSTRAINT IF EXISTS "crm_list_member_list_id_fkey";
ALTER TABLE "crm_list_member" ADD CONSTRAINT "crm_list_member_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "crm_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_list_member" DROP CONSTRAINT IF EXISTS "crm_list_member_record_id_fkey";
ALTER TABLE "crm_list_member" ADD CONSTRAINT "crm_list_member_record_id_fkey"
  FOREIGN KEY ("record_id") REFERENCES "crm_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
