-- Sistema Agenti AI — registro, esecuzioni (costi) e audit append-only.
CREATE TABLE "agent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "system_prompt" TEXT,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "human_in_loop" BOOLEAN NOT NULL DEFAULT false,
    "monthly_budget_cents" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_key_key" ON "agent"("key");
CREATE INDEX "agent_department_idx" ON "agent"("department");
CREATE INDEX "agent_enabled_idx" ON "agent"("enabled");

CREATE TABLE "agent_run" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input_ref" TEXT,
    "output_ref" TEXT,
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "verdict" TEXT,
    "approved_by_id" TEXT,
    "error" TEXT,
    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_run_agent_id_started_at_idx" ON "agent_run"("agent_id", "started_at");
CREATE INDEX "agent_run_status_idx" ON "agent_run"("status");
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_log" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    CONSTRAINT "agent_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_log_agent_run_id_ts_idx" ON "agent_log"("agent_run_id", "ts");
ALTER TABLE "agent_log" ADD CONSTRAINT "agent_log_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
