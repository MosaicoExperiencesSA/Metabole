-- Modelli email modificabili + log degli invii.
CREATE TABLE "email_template" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_template_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "template_key" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_log_created_at_idx" ON "email_log" ("created_at");
