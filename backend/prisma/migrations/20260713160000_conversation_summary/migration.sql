-- Riassunti giornalieri delle conversazioni (titolo AI + data). Vedi Metabole_Backend_Operazioni §7.
CREATE TABLE "conversation_summary" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "counterpart" "ChatCounterpart" NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_summary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_summary_client_id_counterpart_date_key" ON "conversation_summary"("client_id", "counterpart", "date");
CREATE INDEX "conversation_summary_client_id_counterpart_date_idx" ON "conversation_summary"("client_id", "counterpart", "date");
