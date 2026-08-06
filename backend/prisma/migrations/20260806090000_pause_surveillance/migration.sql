-- Sorveglianza durante la pausa vacanza (richiesta Simone del 5/8, voce #3).
--
-- Finora la pausa sospendeva i menu e spostava avanti la scadenza, ma per tutta la sua durata
-- nessuno chiedeva più il peso, nessuno guardava i numeri e la coach non veniva avvisata di
-- nulla: una cliente poteva sparire per novanta giorni e ricomparire con dieci chili in più,
-- senza che il sistema se ne fosse accorto.
--
-- Il modulo `monitoring` faceva già esattamente questa vigilanza, ma è riservato a chi NON ha
-- un piano attivo (è il paracadute di fine percorso) e rifiuta esplicitamente chi ce l'ha.
-- Durante una pausa il piano è attivo, quindi era escluso per costruzione. Invece di forzare
-- quel modulo, teniamo i tre dati che servono sulla richiesta di pausa stessa.
--
-- Perché sulla riga della pausa e non in una tabella nuova: la sorveglianza nasce e muore con
-- quella specifica pausa, e l'idempotenza dei promemoria è naturale (una riga per pausa).
ALTER TABLE "pause_request"
  -- Peso di riferimento: quello del giorno in cui la pausa è iniziata. NULL finché la pausa
  -- non è cominciata o se la cliente non si era mai pesata.
  ADD COLUMN "ref_weight_kg" DOUBLE PRECISION,
  -- Ultimo promemoria misure inviato: evita di chiedere il peso tutti i giorni.
  ADD COLUMN "last_measure_ask_at" TIMESTAMP(3),
  -- Quando la coach è stata avvisata del superamento della soglia. Una volta sola per pausa:
  -- l'obiettivo è segnalare, non tempestare.
  ADD COLUMN "coach_alerted_at" TIMESTAMP(3);
