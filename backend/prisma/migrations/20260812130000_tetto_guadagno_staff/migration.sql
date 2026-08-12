-- §16.8 — TETTO DI GUADAGNO MENSILE, SUL PROFILO DELLA SINGOLA PERSONA.
--
-- Decisione di Simone (11/8): il tetto NON è un parametro globale, si imposta persona per
-- persona dove sta il nutrizionista. Quindi una colonna su `staff`, non una riga in
-- `config_param`.
--
-- La colonna nasce NULL per tutti, e NULL significa «nessun tetto»: il comportamento di oggi
-- resta identico per chiunque, senza backfill. ⚠️ Anche lo ZERO significa «nessun tetto» — lo
-- decide il codice (`common/tetto-compensi.ts`), non il database, perché un `CHECK (> 0)` qui
-- farebbe fallire il salvataggio di un campo svuotato invece di leggerlo come «tolto».

ALTER TABLE "staff" ADD COLUMN "earnings_cap_cents" INTEGER;

-- Quanto ha già maturato QUESTA persona in QUESTO mese: la domanda che il tetto fa a ogni
-- provvigione. La faceva già anche il portafoglio staff (`payouts.service.ts`, due somme a ogni
-- apertura) e il registro contabile non aveva un indice su chi: solo su tipo+data e
-- categoria+data. Con il tetto la stessa domanda passa da «una volta quando guardo» a «una volta
-- per ogni pagamento approvato», e senza indice è una scansione del registro intero.
CREATE INDEX "ledger_entry_staff_id_date_idx" ON "ledger_entry"("staff_id", "date");
