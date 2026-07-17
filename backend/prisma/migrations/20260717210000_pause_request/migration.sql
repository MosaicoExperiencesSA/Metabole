-- Richieste di pausa/congelamento abbonamento (modalità vacanza) con approvazione staff.
CREATE TABLE "pause_request" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "event_id" TEXT,
    "decided_by_staff_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "staff_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pause_request_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pause_request_client_id_idx" ON "pause_request"("client_id");
CREATE INDEX "pause_request_status_idx" ON "pause_request"("status");
ALTER TABLE "pause_request" ADD CONSTRAINT "pause_request_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
