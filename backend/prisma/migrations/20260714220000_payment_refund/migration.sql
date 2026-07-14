-- Storno acquisti: registrazione del rimborso sul pagamento (l'esecuzione del
-- rimborso su Stripe/bonifico resta manuale dell'operatore).
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refund_cents" INTEGER;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refund_note" TEXT;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "refund_by_id" TEXT;
