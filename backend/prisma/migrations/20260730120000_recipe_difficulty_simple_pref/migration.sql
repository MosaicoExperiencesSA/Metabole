-- Difficoltà di preparazione della ricetta (semplice | media | elaborata).
-- Serve a proporre alternative "semplici" / vicine alla cucina italiana da alternare a quelle
-- esistenti. Default 'media' così le ricette attuali restano invariate.
ALTER TABLE "recipe" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'media';

-- Preferenza della cliente: menu con ricette semplici quando disponibili (attivabile dall'app).
ALTER TABLE "client_profile" ADD COLUMN "prefers_simple_recipes" BOOLEAN NOT NULL DEFAULT false;
