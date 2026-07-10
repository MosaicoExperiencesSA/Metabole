-- Ref code coach + assegnazione lead con accettazione (2 giorni).
ALTER TABLE "staff" ADD COLUMN "ref_code" TEXT;
CREATE UNIQUE INDEX "staff_ref_code_key" ON "staff" ("ref_code");

ALTER TABLE "crm_record" ADD COLUMN "assigned_coach_id" TEXT;
ALTER TABLE "crm_record" ADD COLUMN "assignment_status" TEXT;
ALTER TABLE "crm_record" ADD COLUMN "assigned_at" TIMESTAMP(3);
ALTER TABLE "crm_record" ADD COLUMN "assigned_by_id" TEXT;

CREATE INDEX "crm_record_assigned_coach_id_assignment_status_idx" ON "crm_record" ("assigned_coach_id", "assignment_status");

ALTER TABLE "crm_record"
    ADD CONSTRAINT "crm_record_assigned_coach_id_fkey"
    FOREIGN KEY ("assigned_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_record"
    ADD CONSTRAINT "crm_record_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
