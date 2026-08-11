-- §15.5 — LE CALORIE SCRITTE A MANO DAL NUTRIZIONISTA, E IL LORO STORICO.
--
-- Il numero della cartella è 20260812 e non 20260811 solo per ORDINE: l'ultima migrazione applicata
-- è `20260812090000_un_pagamento_per_rinnovo`, e Prisma le esegue in ordine alfabetico. Una
-- migrazione datata prima dell'ultima applicata non verrebbe mai eseguita in produzione. La data
-- vera del lavoro è l'11/8/2026.
--
-- Due campi sul profilo (il valore di ADESSO) e una tabella (il PERCHÉ, riga per riga).
-- Nessun backfill: `NULL` significa «nessuna correzione», che è esattamente lo stato di tutte le
-- clienti oggi. Il comportamento del motore per chi non ha correzioni resta identico.

ALTER TABLE "client_profile"
  ADD COLUMN "kcal_deficit_override" INTEGER,
  ADD COLUMN "kcal_adjust_pct" DOUBLE PRECISION;

CREATE TABLE "kcal_override" (
  "id"                TEXT NOT NULL,
  "client_id"         TEXT NOT NULL,
  "deficit_kcal"      INTEGER,
  "adjust_pct"        DOUBLE PRECISION,
  "prev_deficit_kcal" INTEGER,
  "prev_adjust_pct"   DOUBLE PRECISION,
  "target_prima"      INTEGER,
  "target_dopo"       INTEGER,
  "sotto_soglia"      BOOLEAN NOT NULL DEFAULT false,
  "motivo"            TEXT NOT NULL,
  "by_staff_id"       TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kcal_override_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kcal_override_client_id_created_at_idx" ON "kcal_override"("client_id", "created_at");

-- La cliente cancellata si porta via il suo storico clinico (CASCADE, come `clinical_note`).
ALTER TABLE "kcal_override"
  ADD CONSTRAINT "kcal_override_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Il nutrizionista che se ne va NON cancella la riga: resta scritto che quella correzione è stata
-- fatta, anche se l'autore non c'è più. È il motivo per cui `by_staff_id` è opzionale.
ALTER TABLE "kcal_override"
  ADD CONSTRAINT "kcal_override_by_staff_id_fkey"
  FOREIGN KEY ("by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
