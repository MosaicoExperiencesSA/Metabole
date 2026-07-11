-- Prelievi provvigioni: IBAN salvato sullo staff + richieste di prelievo.
ALTER TABLE "staff" ADD COLUMN "iban" TEXT;

CREATE TABLE "commission_withdrawal" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "iban" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "receipt_data" BYTEA,
    "receipt_mime" TEXT,
    "receipt_name" TEXT,
    "note" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    CONSTRAINT "commission_withdrawal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commission_withdrawal_staff_id_status_idx" ON "commission_withdrawal"("staff_id", "status");
ALTER TABLE "commission_withdrawal" ADD CONSTRAINT "commission_withdrawal_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
