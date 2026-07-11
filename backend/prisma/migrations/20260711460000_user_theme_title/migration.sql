-- Preferenze backoffice dell'utente: titolo/qualifica e tema grafico.
ALTER TABLE "user" ADD COLUMN "title" TEXT;
ALTER TABLE "user" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light';
