-- Opt-out marketing per email (dal webhook Brevo)
CREATE TABLE "marketing_opt_out" (
  "email" TEXT NOT NULL,
  "reason" TEXT,
  "source" TEXT NOT NULL DEFAULT 'brevo',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_opt_out_pkey" PRIMARY KEY ("email")
);
