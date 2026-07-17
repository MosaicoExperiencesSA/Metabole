-- Campagne marketing: invio programmato (data/ora) + throttle a lotti (invia N, pausa M minuti).
ALTER TABLE "marketing_campaign" ADD COLUMN "scheduled_for" TIMESTAMP(3);
ALTER TABLE "marketing_campaign" ADD COLUMN "batch_size" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketing_campaign" ADD COLUMN "pause_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketing_campaign" ADD COLUMN "cursor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketing_campaign" ADD COLUMN "next_batch_at" TIMESTAMP(3);
CREATE INDEX "marketing_campaign_status_next_batch_at_idx" ON "marketing_campaign"("status", "next_batch_at");
