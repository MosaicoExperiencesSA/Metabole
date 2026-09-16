-- Invito a provare Gaia (16/9): una riga per lead esaminato. Additiva.
CREATE TABLE "gaia_invite" (
    "id" TEXT NOT NULL,
    "crm_record_id" TEXT NOT NULL,
    "email" TEXT,
    "esito" TEXT NOT NULL DEFAULT 'invio',
    "tentativi" INTEGER NOT NULL DEFAULT 0,
    "ultimo_tentativo_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "reminder_esito" TEXT,
    "clicked_at" TIMESTAMP(3),
    "entered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gaia_invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gaia_invite_crm_record_id_key" ON "gaia_invite"("crm_record_id");
CREATE UNIQUE INDEX "gaia_invite_email_key" ON "gaia_invite"("email");
CREATE INDEX "gaia_invite_ultimo_tentativo_at_idx" ON "gaia_invite"("ultimo_tentativo_at");
CREATE INDEX "gaia_invite_sent_at_idx" ON "gaia_invite"("sent_at");
CREATE INDEX "gaia_invite_esito_idx" ON "gaia_invite"("esito");

ALTER TABLE "gaia_invite" ADD CONSTRAINT "gaia_invite_crm_record_id_fkey" FOREIGN KEY ("crm_record_id") REFERENCES "crm_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
