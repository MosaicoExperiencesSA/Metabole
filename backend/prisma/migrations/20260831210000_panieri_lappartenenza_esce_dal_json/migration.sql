-- FASE 1 DEL PIANO PANIERI — l'appartenenza di una ricetta a un paniere esce dal JSON.
--
-- Fino a oggi «questa ricetta sta in questo paniere» stava dentro `diet_day_template.meals`
-- (un array JSON di {slot, recipeId}), mescolata all'abbinamento della giornata e SENZA chiave
-- esterna. Da qui i 58 riferimenti rotti misurati il 31/8, su sei varianti con clienti sopra.
--
-- Questa migrazione crea le due tabelle e NON tocca niente di esistente: il riempimento lo fa
-- `npm run panieri:riempi`, che è un passo a parte e in sola lettura finché non gli si dice
-- APPLICA=1. Nessun dato viene spostato qui dentro.

CREATE TABLE "paniere" (
    "id" TEXT NOT NULL,
    "famiglia" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'bozza',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paniere_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paniere_ricetta" (
    "id" TEXT NOT NULL,
    "paniere_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paniere_ricetta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paniere_famiglia_regime_key" ON "paniere"("famiglia", "regime");
CREATE INDEX "paniere_regime_stato_idx" ON "paniere"("regime", "stato");

-- ⛔ È QUESTO IL PUNTO DELLA FASE 1: la chiave esterna rende i riferimenti rotti IMPOSSIBILI
-- per costruzione, invece di contarli con una diagnostica dopo che sono successi.
CREATE UNIQUE INDEX "paniere_ricetta_paniere_id_recipe_id_slot_key" ON "paniere_ricetta"("paniere_id", "recipe_id", "slot");
CREATE INDEX "paniere_ricetta_paniere_id_slot_idx" ON "paniere_ricetta"("paniere_id", "slot");
CREATE INDEX "paniere_ricetta_recipe_id_idx" ON "paniere_ricetta"("recipe_id");

ALTER TABLE "paniere_ricetta" ADD CONSTRAINT "paniere_ricetta_paniere_id_fkey"
    FOREIGN KEY ("paniere_id") REFERENCES "paniere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paniere_ricetta" ADD CONSTRAINT "paniere_ricetta_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
