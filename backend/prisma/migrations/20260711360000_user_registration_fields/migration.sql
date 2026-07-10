-- Dati anagrafici e di spedizione raccolti alla registrazione (schermata "Crea il tuo account").
ALTER TABLE "user" ADD COLUMN "first_name" TEXT;
ALTER TABLE "user" ADD COLUMN "last_name" TEXT;
ALTER TABLE "user" ADD COLUMN "address_line" TEXT;
ALTER TABLE "user" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "user" ADD COLUMN "city" TEXT;
ALTER TABLE "user" ADD COLUMN "province" TEXT;
