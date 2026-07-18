-- Livello "Monitoraggio" (spec Antonio 17/07): paracadute gratuito max 1 mese dopo il percorso.
CREATE TABLE "monitoring_period" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reference_weight_kg" DOUBLE PRECISION NOT NULL,
    "regain_offered_at" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "converted_to" TEXT,
    "last_measure_ask_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monitoring_period_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "monitoring_period_client_id_status_idx" ON "monitoring_period"("client_id", "status");

-- Piani nascosti dallo shop ma acquistabili con link diretto (es. "Menu di rientro").
ALTER TABLE "plan" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
