-- Eventi di tracciamento (analitici, append-only). Vedi Metabole_Tracciamento_Dati.md.
CREATE TABLE "analytics_event" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT,
    "session" TEXT,
    "refcod" TEXT,
    "phase" TEXT,
    "screen" TEXT,
    "step" INTEGER,
    "data" JSONB,
    "client_ts" BIGINT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_event_event_id_key" ON "analytics_event"("event_id");
CREATE INDEX "analytics_event_user_id_received_at_idx" ON "analytics_event"("user_id", "received_at");
CREATE INDEX "analytics_event_session_received_at_idx" ON "analytics_event"("session", "received_at");
CREATE INDEX "analytics_event_name_received_at_idx" ON "analytics_event"("name", "received_at");
