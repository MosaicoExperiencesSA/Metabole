-- Automazione email del ciclo di vita: impostazioni + log/dedup invii.
CREATE TABLE "lifecycle_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "triggers" JSONB,
    "last_run_at" TIMESTAMP(3),
    "updated_by_id" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lifecycle_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lifecycle_email" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lifecycle_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lifecycle_email_user_id_dedupe_key_key" ON "lifecycle_email"("user_id", "dedupe_key");
CREATE INDEX "lifecycle_email_template_key_idx" ON "lifecycle_email"("template_key");
CREATE INDEX "lifecycle_email_sent_at_idx" ON "lifecycle_email"("sent_at");
