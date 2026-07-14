-- R8 sicurezza: allergeni (14 UE) sulle ricette + flag "revisionato dal nutrizionista".
ALTER TABLE "recipe" ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "recipe" ADD COLUMN "allergens_reviewed" BOOLEAN NOT NULL DEFAULT false;
