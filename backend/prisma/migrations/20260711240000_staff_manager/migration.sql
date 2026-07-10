-- Responsabile diretto dello staff (manager coach / capo nutrizionista) per le provvigioni di catena.
ALTER TABLE "staff" ADD COLUMN "manager_id" TEXT;

ALTER TABLE "staff"
    ADD CONSTRAINT "staff_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "staff_manager_id_idx" ON "staff" ("manager_id");
