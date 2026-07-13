-- Campi "prodotto" mostrati al cliente sullo schermo 16 (spec prodotti dinamici).
ALTER TABLE "diet" ADD COLUMN "client_name" TEXT;
ALTER TABLE "diet" ADD COLUMN "client_description" TEXT;
ALTER TABLE "diet" ADD COLUMN "highlights" JSONB;
ALTER TABLE "diet" ADD COLUMN "seasonal_tag" TEXT;
ALTER TABLE "diet" ADD COLUMN "objective" TEXT NOT NULL DEFAULT 'dimagrimento';
ALTER TABLE "diet" ADD COLUMN "client_visible" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "diet_client_visible_idx" ON "diet"("client_visible");
