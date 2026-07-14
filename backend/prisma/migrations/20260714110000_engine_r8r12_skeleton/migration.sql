-- R8: allergie come blocco duro, distinte da intolleranze/gusti
ALTER TABLE "client_profile" ADD COLUMN "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- R4/R8 — Gruppi di equivalenza
CREATE TABLE "equivalence_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_id" TEXT,
    "members" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equivalence_group_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "equivalence_group_product_id_idx" ON "equivalence_group"("product_id");
CREATE INDEX "equivalence_group_status_idx" ON "equivalence_group"("status");

-- R8 — Base personalizzata del cliente
CREATE TABLE "client_menu_pool" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "diet_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "recipe_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excluded" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_menu_pool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_menu_pool_client_id_diet_id_version_key" ON "client_menu_pool"("client_id", "diet_id", "version");
CREATE INDEX "client_menu_pool_client_id_idx" ON "client_menu_pool"("client_id");

-- R10/R11 — Ciclo bigiornaliero attivo + stato contestuale
CREATE TABLE "client_cycle" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "diet_id" TEXT NOT NULL,
    "cycle_start" DATE NOT NULL,
    "cycle_end" DATE NOT NULL,
    "day_template_id" TEXT,
    "cooking_g1" TEXT,
    "cooking_g2" TEXT,
    "state" TEXT NOT NULL DEFAULT 'normale',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_cycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_cycle_client_id_cycle_end_idx" ON "client_cycle"("client_id", "cycle_end");

-- R9 — Certificato di unicità
CREATE TABLE "personalization_certificate" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "diet_id" TEXT,
    "seed" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personalization_certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "personalization_certificate_client_id_version_key" ON "personalization_certificate"("client_id", "version");
CREATE INDEX "personalization_certificate_client_id_idx" ON "personalization_certificate"("client_id");
