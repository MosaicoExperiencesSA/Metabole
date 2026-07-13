-- Learning del motore: esito dei cicli (peso/cm) + efficacia appresa per ricetta.
-- Vedi Metabole_Motore_Personalizzazione §4/§6.
CREATE TABLE "cycle_feedback" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "cycle_start" DATE NOT NULL,
    "cycle_end" DATE NOT NULL,
    "delta_weight_kg" DOUBLE PRECISION,
    "delta_cm" DOUBLE PRECISION,
    "esito_peso" TEXT NOT NULL,
    "esito_cm" TEXT NOT NULL,
    "followed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cycle_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cycle_feedback_client_id_cycle_end_key" ON "cycle_feedback"("client_id", "cycle_end");
CREATE INDEX "cycle_feedback_client_id_cycle_end_idx" ON "cycle_feedback"("client_id", "cycle_end");

CREATE TABLE "menu_weight" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_weight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "menu_weight_client_id_recipe_id_key" ON "menu_weight"("client_id", "recipe_id");
CREATE INDEX "menu_weight_client_id_idx" ON "menu_weight"("client_id");
