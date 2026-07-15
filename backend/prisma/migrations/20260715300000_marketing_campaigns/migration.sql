-- Etichette libere sulle schede per la segmentazione marketing
ALTER TABLE "crm_record" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Storico campagne marketing (destinatari congelati + mail inviata)
CREATE TABLE "marketing_campaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "template_key" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body_html" TEXT NOT NULL,
  "segment" JSONB NOT NULL DEFAULT '{}',
  "recipients" JSONB NOT NULL DEFAULT '[]',
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_campaign_created_at_idx" ON "marketing_campaign"("created_at");
