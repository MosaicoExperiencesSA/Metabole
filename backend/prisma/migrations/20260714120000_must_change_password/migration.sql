-- Obbligo di cambio password al primo accesso (account creati dall'admin).
-- Il flag viene azzerato quando l'utente cambia la password (PATCH /me/password).
ALTER TABLE "user" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
