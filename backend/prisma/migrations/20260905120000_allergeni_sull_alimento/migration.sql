-- GLI ALLERGENI DICHIARATI SULL'ALIMENTO — 5/9, l'agente alimenti chiesto da Simone.
--
-- Il foglio del 31/8 aveva dichiarato il limite: «essere in tabella non vuol dire conoscerne gli
-- allergeni — su un pesto pronto la deduzione direbbe nessun allergene con la stessa faccia». E la
-- strada scritta là: «si chiude dichiarando gli allergeni SULL'ALIMENTO, non allungando un elenco di
-- parole». Questa colonna è quella strada.
--
-- ⚠️ Vuoto = NON SI SA, non «nessuno»: tutte le righe di prima del 5/9 nascono vuote e nessuno le ha
-- guardate. Chi legge non deduce niente da un vuoto; un tag si aggiunge solo da una riga che lo dice.
--
-- `filled_by` dice chi ha scritto la riga: 'agente_alimenti' per quelle compilate dall'AI cercando in
-- rete, vuoto per le persone e gli import. Serve alla nutrizionista per trovarle, e a noi per
-- contarle.
ALTER TABLE "nutrient_fact" ADD COLUMN "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "nutrient_fact" ADD COLUMN "filled_by" TEXT;
