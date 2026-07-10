-- Pipeline CRM: gli Stati diventano gestibili dall'admin (aggiungi/rinomina/
-- riordina/colore), condivisi da tutti gli utenti.

-- 1) crm_record.stage: da enum "CrmStage" a testo, così può contenere anche gli
--    stati creati dall'admin. Le KEY restano stabili (usate dall'automazione).
ALTER TABLE "crm_record" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "crm_record" ALTER COLUMN "stage" TYPE TEXT USING "stage"::text;
ALTER TABLE "crm_record" ALTER COLUMN "stage" SET DEFAULT 'lead_in';

-- 2) Tabella degli stati della pipeline (condivisa).
CREATE TABLE "pipeline_stage" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "pipeline_stage_order_idx" ON "pipeline_stage"("order");
