-- Regole per prodotto (Fase F) + coda proposte regola.
CREATE TABLE "product_rule" (
    "id" TEXT NOT NULL,
    "diet_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_rule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_rule_diet_id_rule_code_key" ON "product_rule"("diet_id", "rule_code");
CREATE INDEX "product_rule_diet_id_idx" ON "product_rule"("diet_id");

CREATE TABLE "rule_proposal" (
    "id" TEXT NOT NULL,
    "diet_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "proposed_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rule_proposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rule_proposal_status_idx" ON "rule_proposal"("status");
