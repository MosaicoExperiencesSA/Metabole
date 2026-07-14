-- Regole suggerite per tipo di nutrizione + proposta di regola generale.
CREATE TABLE IF NOT EXISTS "rule_preset" (
  "id" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "regime" TEXT,
  "objective" TEXT,
  "rules" JSONB NOT NULL DEFAULT '{}',
  "clinical_notes" TEXT,
  "source" TEXT,
  "suggested" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rule_preset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rule_preset_style_idx" ON "rule_preset"("style");

-- RuleProposal: dietId diventa opzionale + titolo.
ALTER TABLE "rule_proposal" ALTER COLUMN "diet_id" DROP NOT NULL;
ALTER TABLE "rule_proposal" ADD COLUMN IF NOT EXISTS "title" TEXT;
