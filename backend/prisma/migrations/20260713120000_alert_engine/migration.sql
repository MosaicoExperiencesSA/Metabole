-- Alert engine: coda avvisi per la coach (Metabole_Backend_Operazioni §5).
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "coach_id" TEXT,
    "alert_group" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_coach_id_status_idx" ON "alert"("coach_id", "status");
CREATE INDEX "alert_client_id_type_status_idx" ON "alert"("client_id", "type", "status");
