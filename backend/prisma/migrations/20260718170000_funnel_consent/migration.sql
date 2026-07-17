-- Handoff punto 6: tracciamento funnel (segmento/canale) + consensi marketing GDPR.
ALTER TABLE "crm_record" ADD COLUMN "segment" TEXT;
ALTER TABLE "crm_record" ADD COLUMN "channel" TEXT;
ALTER TABLE "crm_record" ADD COLUMN "marketing_consent" BOOLEAN;
ALTER TABLE "crm_record" ADD COLUMN "consent_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "crm_record" ADD COLUMN "consent_at" TIMESTAMP(3);
ALTER TABLE "crm_record" ADD COLUMN "consent_source" TEXT;
