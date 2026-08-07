-- Famiglia di dieta scelta in registrazione (Diet.name). Insieme a diet_style identifica il
-- PRODOTTO: lo stile da solo raggruppava famiglie diverse (Vegana/Vegetariana/Flexitariana/
-- Flessibile sono tutte 'flexible'), quindi la cliente ne sceglieva una e il motore poteva
-- servirne un'altra.
--
-- Nullable e senza backfill di proposito: sulle clienti già registrate resta NULL e
-- l'abbinamento continua a funzionare come prima (stile + regime + obiettivo + pasti).
ALTER TABLE "client_profile" ADD COLUMN IF NOT EXISTS "diet_family" TEXT;
