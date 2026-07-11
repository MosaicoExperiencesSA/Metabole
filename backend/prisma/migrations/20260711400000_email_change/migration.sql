-- Cambio email con verifica + seconda email (login alternativo).
-- La principale resta `email` (notifiche, ricevute); la secondaria serve solo per il login.

-- Seconda email dell'account (verificata), unica come la principale.
ALTER TABLE "user" ADD COLUMN "secondary_email" TEXT;
CREATE UNIQUE INDEX "user_secondary_email_key" ON "user"("secondary_email");

-- Email di destinazione trasportata dal token di verifica del cambio email.
ALTER TABLE "action_token" ADD COLUMN "email" TEXT;

-- Nuovo tipo di token per il cambio email.
ALTER TYPE "ActionTokenType" ADD VALUE 'email_change';
