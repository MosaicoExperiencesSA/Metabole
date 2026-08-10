-- BANCA DATI NUTRIZIONALE (11/8): i numeri che Gaia può dire, con la fonte e l'affidabilità accanto.
--
-- Nasce dall'errore del basmati: Gaia aveva affermato a memoria un indice glicemico invertito. La
-- decisione non è stata vietarle i numeri ma obbligarla a leggerli da qui.
--
-- Le colonne che una tabella nutrizionale normale non ha, e che sono il punto:
--  · `glycemic_index_min/max` + `glycemic_index_reliability` — l'IG delle patate va da 73 a 111
--    secondo la fonte. Dire «82» è una precisione che il dato non ha: con affidabilità «debole» si
--    dice il range, o non si dice.
--  · `glycemic_index_source` / `source` per RIGA — la riga del basmati sa di venire dalle
--    International Tables 2008, voce «quick cooking», cioè un dato debole.
--  · `verified_by_id` / `verified_at` — un valore nuovo Gaia lo usa subito, ma resta nella lista
--    «da confermare» della nutrizionista finché non lo guarda.
--  · `state` (crudo/bollito/secco) — il CREA dà le lenticchie secche a 319 kcal e bollite a 109:
--    confondere i due stati sbaglia le calorie di un fattore tre.
CREATE TABLE IF NOT EXISTS "nutrient_fact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "category" TEXT,
  "state" TEXT,
  "glycemic_index" INTEGER,
  "glycemic_index_min" INTEGER,
  "glycemic_index_max" INTEGER,
  "glycemic_index_source" TEXT,
  "glycemic_index_reliability" TEXT,
  "kcal" DOUBLE PRECISION,
  "protein" DOUBLE PRECISION,
  "carbs" DOUBLE PRECISION,
  "sugars" DOUBLE PRECISION,
  "fat" DOUBLE PRECISION,
  "fiber" DOUBLE PRECISION,
  "source" TEXT,
  "source_ref" TEXT,
  "note" TEXT,
  "verified_by_id" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrient_fact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "nutrient_fact_name_key" ON "nutrient_fact"("name");
CREATE INDEX IF NOT EXISTS "nutrient_fact_category_idx" ON "nutrient_fact"("category");
CREATE INDEX IF NOT EXISTS "nutrient_fact_verified_at_idx" ON "nutrient_fact"("verified_at");

-- `SET NULL` e non `CASCADE`: se la nutrizionista che ha confermato un valore lascia l'azienda, il
-- valore resta — è un dato sugli alimenti, non su di lei. Si perde solo la firma.
DO $$ BEGIN
  ALTER TABLE "nutrient_fact"
    ADD CONSTRAINT "nutrient_fact_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gli alimenti chiesti dalle clienti e non presenti: è la parte «arricchisce il suo sapere», fatta
-- nel modo che non inventa niente. Il CONTEGGIO è la ragione per cui questa tabella esiste: dice
-- quale riga aggiungere per prima invece di farlo indovinare.
CREATE TABLE IF NOT EXISTS "nutrient_lookup_miss" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "times" INTEGER NOT NULL DEFAULT 1,
  "first_asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'open',
  CONSTRAINT "nutrient_lookup_miss_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "nutrient_lookup_miss_term_key" ON "nutrient_lookup_miss"("term");
CREATE INDEX IF NOT EXISTS "nutrient_lookup_miss_status_times_idx" ON "nutrient_lookup_miss"("status", "times");
