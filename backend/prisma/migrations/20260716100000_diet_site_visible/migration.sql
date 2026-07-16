-- Flag indipendente: dieta mostrata sul SITO pubblico (separato da client_visible dell'app/onboarding).
ALTER TABLE "diet" ADD COLUMN "site_visible" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "diet_site_visible_idx" ON "diet"("site_visible");

-- Backfill: le diete oggi già mostrate sul sito sono tutte le approvate → le teniamo visibili,
-- così il sito non si svuota al deploy. Poi si possono spegnere una a una dal backoffice.
UPDATE "diet" SET "site_visible" = true WHERE "status"::text = 'approved';
