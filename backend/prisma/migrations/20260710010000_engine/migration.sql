-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "protocol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "thresholds" JSONB,
    "applies_to" TEXT,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'pending',
    "author_id" TEXT,
    "validated_by_id" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_decision" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "inputs" JSONB NOT NULL,
    "rule_id" TEXT,
    "action" JSONB NOT NULL,
    "flagged_for_review" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_outcome" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engine_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocol_status_idx" ON "protocol"("status");

-- CreateIndex
CREATE INDEX "engine_decision_client_id_date_idx" ON "engine_decision"("client_id", "date");

-- CreateIndex
CREATE INDEX "engine_decision_flagged_for_review_reviewed_at_idx" ON "engine_decision"("flagged_for_review", "reviewed_at");

-- AddForeignKey
ALTER TABLE "protocol" ADD CONSTRAINT "protocol_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol" ADD CONSTRAINT "protocol_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_decision" ADD CONSTRAINT "engine_decision_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_decision" ADD CONSTRAINT "engine_decision_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
