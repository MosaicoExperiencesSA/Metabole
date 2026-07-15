-- Corpo HTML dell'email registrata, per l'anteprima in sola lettura dal log.
ALTER TABLE "email_log" ADD COLUMN "body_html" TEXT;
