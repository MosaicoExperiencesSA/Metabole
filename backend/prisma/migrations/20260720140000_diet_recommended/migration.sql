-- Sezione "Consigliati": diete in evidenza (es. Vacanza estiva, Rientro estivo).
ALTER TABLE "diet" ADD COLUMN "recommended" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "diet_recommended_idx" ON "diet"("recommended");
