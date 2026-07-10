-- Buoni sconto (percentuale o importo fisso) con limiti di utilizzo.
CREATE TABLE "discount_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "max_total_uses" INTEGER,
    "max_per_client" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discount_code_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "discount_code_code_key" ON "discount_code" ("code");

CREATE TABLE "discount_redemption" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discount_redemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "discount_redemption_code_id_client_id_idx" ON "discount_redemption" ("code_id", "client_id");
ALTER TABLE "discount_redemption"
    ADD CONSTRAINT "discount_redemption_code_id_fkey"
    FOREIGN KEY ("code_id") REFERENCES "discount_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment" ADD COLUMN "discount_code_id" TEXT;
ALTER TABLE "payment" ADD COLUMN "discount_cents" INTEGER;
