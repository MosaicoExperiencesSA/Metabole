-- Appuntamenti in agenda (app coach + cliente). Vedi Metabole_Backend_Operazioni §6.
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "staff_role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_client_id_datetime_idx" ON "appointment"("client_id", "datetime");
CREATE INDEX "appointment_staff_id_datetime_idx" ON "appointment"("staff_id", "datetime");
