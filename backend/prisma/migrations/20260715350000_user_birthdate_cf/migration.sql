-- Data di nascita e codice fiscale sull'anagrafica utente (cliente).
ALTER TABLE "user" ADD COLUMN "birth_date" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "codice_fiscale" TEXT;
