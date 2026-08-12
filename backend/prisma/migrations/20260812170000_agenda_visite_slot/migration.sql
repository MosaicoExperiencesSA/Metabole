-- §16.7 — L'AGENDA DELLE VISITE: la settimana tipo del nutrizionista e i giorni in cui non riceve.
--
-- «Il nutrizionista inserisce gli slot in una settimana tipo, esempio lunedì dalle 9 alle 10 poi
-- dalle 10,05 alle 11.10, col flag "si ripete". Poi può inserire i giorni di vacanza e lì gli slot
-- si chiudono in automatico» (Simone, 12/8).
--
-- ⚠️ GLI ORARI SONO MINUTI, NON DATE. `start_min`/`end_min` contano dalla mezzanotte, ora di Roma.
-- È l'unico modo di scrivere «tutti i lunedì alle 9» senza legarlo a un istante: salvato come
-- timestamp, quel «9:00» dopo il cambio dell'ora diventerebbe le 8 o le 10 per metà anno, e non
-- se ne accorgerebbe nessuno fino alla prima cliente che si presenta all'ora sbagliata. L'istante
-- vero lo calcola il codice (`agenda/settimana-tipo.ts`), che sa dov'è il cambio d'ora.

CREATE TABLE "visit_slot" (
  "id"              TEXT NOT NULL,
  "nutritionist_id" TEXT NOT NULL,
  -- 0 = domenica … 6 = sabato. Solo sugli slot che si ripetono.
  "weekday"         INTEGER,
  -- Solo sugli slot una tantum: una giornata straordinaria fuori dalla settimana tipo.
  "date"            DATE,
  "start_min"       INTEGER NOT NULL,
  "end_min"         INTEGER NOT NULL,
  "repeats"         BOOLEAN NOT NULL DEFAULT true,
  "type"            TEXT NOT NULL DEFAULT 'in_person',
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "visit_slot_pkey" PRIMARY KEY ("id")
);

-- ⚠️ I vincoli stanno QUI e non solo nel codice, perché una riga sbagliata non darebbe nessun
-- errore: darebbe uno slot che non compare mai fra gli orari prenotabili, e nessuno saprebbe
-- perché. `weekday` e `date` sono alternativi, e l'orario deve stare dentro la giornata.
ALTER TABLE "visit_slot" ADD CONSTRAINT "visit_slot_quando_chk" CHECK (
  ("repeats" = true  AND "weekday" IS NOT NULL AND "weekday" BETWEEN 0 AND 6 AND "date" IS NULL) OR
  ("repeats" = false AND "date" IS NOT NULL AND "weekday" IS NULL)
);
ALTER TABLE "visit_slot" ADD CONSTRAINT "visit_slot_orario_chk" CHECK (
  "start_min" >= 0 AND "end_min" <= 1440 AND "end_min" > "start_min"
);

CREATE INDEX "visit_slot_nutritionist_id_weekday_idx" ON "visit_slot"("nutritionist_id", "weekday");
CREATE INDEX "visit_slot_nutritionist_id_date_idx" ON "visit_slot"("nutritionist_id", "date");

-- Il nutrizionista che se ne va si porta via la sua settimana tipo: sono i SUOI orari, e senza di
-- lui non vogliono dire niente. Le visite già fissate restano (vedi il SET NULL su `visit.slot_id`).
ALTER TABLE "visit_slot" ADD CONSTRAINT "visit_slot_nutritionist_id_fkey"
  FOREIGN KEY ("nutritionist_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- I giorni in cui non riceve. Estremi INCLUSI: «dal 10 al 20» sono undici giorni chiusi, non nove —
-- è la lettura che dà chiunque scriva quelle due date, ed è l'unica che non fa lavorare qualcuno il
-- giorno in cui parte.
CREATE TABLE "staff_time_off" (
  "id"         TEXT NOT NULL,
  "staff_id"   TEXT NOT NULL,
  "dal"        DATE NOT NULL,
  "al"         DATE NOT NULL,
  "motivo"     TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_time_off_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_periodo_chk" CHECK ("al" >= "dal");
CREATE INDEX "staff_time_off_staff_id_dal_idx" ON "staff_time_off"("staff_id", "dal");
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quello che mancava alla VISITA.
--
-- `ends_at`: prima una visita era un istante senza durata, quindi «alle 10» e «alle 10:30» non si
-- sapeva se si accavallassero — non si sapeva quanto durasse la prima. Resta NULL sulle visite già
-- in tabella: non inventiamo una durata che nessuno ha scritto.
--
-- `slot_id`: quale slot della settimana tipo occupa. NULL = fissata a mano, fuori griglia — ed è il
-- caso di tutte quelle esistenti. SET NULL alla cancellazione dello slot: se il nutrizionista
-- ritira un orario dalla settimana tipo, l'appuntamento già preso con una persona non sparisce.
ALTER TABLE "visit"
  ADD COLUMN "ends_at" TIMESTAMP(3),
  ADD COLUMN "slot_id" TEXT;

CREATE INDEX "visit_slot_id_datetime_idx" ON "visit"("slot_id", "datetime");
ALTER TABLE "visit" ADD CONSTRAINT "visit_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "visit_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
