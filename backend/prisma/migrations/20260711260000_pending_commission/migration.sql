-- Provvigioni accantonate: create quando manca lo staff assegnato al pagamento,
-- pagate all'assegnazione dal backoffice.
CREATE TABLE "pending_commission" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    CONSTRAINT "pending_commission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_commission_client_id_status_idx" ON "pending_commission" ("client_id", "status");
