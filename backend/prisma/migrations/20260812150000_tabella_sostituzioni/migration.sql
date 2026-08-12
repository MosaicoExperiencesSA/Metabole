-- §16.9 — LA TABELLA DELLE SOSTITUZIONI DI GAIA. «Se non salviamo la sua risposta lei non impara.»
--
-- Fino a qui una sostituzione concordata in chat viveva SOLO dentro `menu_day.meals`, come
-- elemento di un array JSON: senza id (la si individuava per `data|slot|from`, in tre punti
-- diversi del codice), e leggibile solo dentro una finestra di ±30/90 giorni. Quello che una
-- cliente aveva chiesto tre mesi fa non esisteva più.
--
-- ⚠️ Questa tabella NON diventa la fonte di verità del menu. Il piatto di oggi resta scritto in
-- `menu_day.meals`; qui c'è la MEMORIA. Cancellare questa tabella non cambierebbe una sola
-- giornata di menu di una sola cliente — ed è di proposito: una tabella nuova che entra nel
-- percorso critico del pasto è un modo di rompere il pasto.
--
-- La riga non è un'occorrenza: `chiave` è unica e la stessa richiesta ripetuta incrementa `volte`.

CREATE TABLE "food_swap" (
  "id"                 TEXT NOT NULL,
  -- clientId|recipeId|radice(da)|radice(a) — vedi `common/nomi-alimento.ts`. È ciò che rende
  -- l'inserimento un upsert: senza, due richieste identiche sono due righe e il conteggio non c'è.
  "chiave"             TEXT NOT NULL,
  "client_id"          TEXT NOT NULL,
  "recipe_id"          TEXT,
  "dish_name"          TEXT,
  "meal_slot"          TEXT,
  "tipo"               TEXT NOT NULL DEFAULT 'ingrediente',
  "from_food"          TEXT NOT NULL,
  "to_food"            TEXT NOT NULL,
  "from_key"           TEXT NOT NULL,
  "to_key"             TEXT NOT NULL,
  "from_qty"           DOUBLE PRECISION,
  "to_qty"             DOUBLE PRECISION,
  "unit"               TEXT,
  "motivo"             TEXT,
  "origine"            TEXT NOT NULL DEFAULT 'chat',
  "stato"              TEXT NOT NULL DEFAULT 'da_verificare',
  "nota"               TEXT,
  "diet_id"            TEXT,
  "volte"              INTEGER NOT NULL DEFAULT 1,
  "prima_volta_il"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultima_volta_il"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creata_da_id"       TEXT,
  "validata_da_id"     TEXT,
  "validata_il"        TIMESTAMP(3),
  "promossa_gruppo_id" TEXT,
  "promossa_il"        TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "food_swap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_swap_chiave_key" ON "food_swap"("chiave");
-- La coda «da verificare»: è la schermata con cui la pagina si apre.
CREATE INDEX "food_swap_stato_ultima_volta_il_idx" ON "food_swap"("stato", "ultima_volta_il");
-- Le righe di UNA cliente, per la sua scheda.
CREATE INDEX "food_swap_client_id_ultima_volta_il_idx" ON "food_swap"("client_id", "ultima_volta_il");
-- «Chi chiede di togliere le carote»: la domanda che i gruppi di equivalenza non sanno fare.
CREATE INDEX "food_swap_from_key_idx" ON "food_swap"("from_key");

-- La cliente cancellata si porta via le sue righe: sono dati suoi, e senza di lei il contesto —
-- che è tutto il valore di questa tabella — non vuol dire più niente.
ALTER TABLE "food_swap" ADD CONSTRAINT "food_swap_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tutto il resto è SET NULL, e per lo stesso motivo tre volte: la riga deve sopravvivere a chi la
-- circonda. Una ricetta ritirata dal catalogo non cancella il fatto che quella cliente ne togliesse
-- il pepe (per questo `dish_name` è una copia del nome, non un join); la nutrizionista che lascia
-- l'azienda non cancella le validazioni che ha fatto; un gruppo di equivalenza eliminato lascia la
-- riga viva e semplicemente non più promossa.
ALTER TABLE "food_swap" ADD CONSTRAINT "food_swap_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_swap" ADD CONSTRAINT "food_swap_creata_da_id_fkey"
  FOREIGN KEY ("creata_da_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_swap" ADD CONSTRAINT "food_swap_validata_da_id_fkey"
  FOREIGN KEY ("validata_da_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_swap" ADD CONSTRAINT "food_swap_promossa_gruppo_id_fkey"
  FOREIGN KEY ("promossa_gruppo_id") REFERENCES "equivalence_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nessun backfill dai JSON esistenti, di proposito: la tabella parte vuota e si riempie da
-- domani. Ricostruire all'indietro da `menu_day.meals` vorrebbe dire inventare `volte` e
-- `prima_volta_il` su righe di cui non sappiamo quante volte sono state chieste — e una memoria
-- che parte con numeri inventati è peggio di una memoria che parte vuota.
