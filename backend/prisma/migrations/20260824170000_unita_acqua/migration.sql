-- Come la cliente contava l'acqua quel giorno: bicchieri o bottiglie da 0,5 / 1 / 1,5 L.
-- Additiva e nullable: nessun backfill, nessuna riga riscritta. NULL = unità non registrata
-- (tutte le giornate prima del 24/8), e il valore resta comunque in bicchieri da 250 ml.
ALTER TABLE "water_log" ADD COLUMN "unit" TEXT;
