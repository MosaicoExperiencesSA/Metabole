-- Invito "porta un'amica" (Fase 8). Codice referral sulla cliente + tabella inviti (FK-less).

-- Codice referral della cliente (referrer) sul suo profilo.
ALTER TABLE "client_profile" ADD COLUMN "referral_code" TEXT;
CREATE UNIQUE INDEX "client_profile_referral_code_key" ON "client_profile"("referral_code");

-- Inviti: una referred (cliente invitata) = un solo invito.
CREATE TABLE "referral" (
    "id" TEXT NOT NULL,
    "referrer_client_id" TEXT NOT NULL,
    "referred_client_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "converted_at" TIMESTAMP(3),
    "rewarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_referred_client_id_key" ON "referral"("referred_client_id");
CREATE INDEX "referral_referrer_client_id_idx" ON "referral"("referrer_client_id");
