-- La CAUSA di una decisione del motore diventa un dato.
--
-- Prima viveva solo dentro il testo della segnalazione (`[calo_rapido_energia] frase`) e si
-- cercava con un `contains`. Senza colonna non si può chiedere «per questa cliente, per questa
-- causa, c'è già una riga aperta?» — ed è la domanda che evita che la coda del nutrizionista
-- riceva la stessa riga ogni notte finché il problema dura.
ALTER TABLE "engine_decision" ADD COLUMN "reason_key" TEXT;

-- BACKFILL delle sole righe ANCORA APERTE (11/8: sono otto, una per cliente).
--
-- Senza questo passaggio la funzione nuova nascerebbe rotta il giorno stesso del deploy: le righe
-- aperte hanno `reason_key` NULL, la ricerca della causa già aperta non le troverebbe, e la prima
-- notte il motore scriverebbe un secondo allarme per la stessa cliente e la stessa causa —
-- esattamente il doppione che questa migrazione esiste per togliere. E sarebbe un doppione
-- permanente: revisionarne uno non chiude l'altro.
--
-- La causa si ricava dalla frase perché quelle frasi le scrive il codice, non una persona
-- (`engine.service.checkGuardrails`): sono tre, letterali, e non sono mai state cambiate. Il
-- confronto è su un pezzo di frase che identifica il guardrail senza ambiguità.
--
-- Si toccano SOLO le righe aperte: sullo storico già revisionato una causa indovinata non
-- servirebbe a niente e sarebbe un dato inventato dentro una cartella clinica.
UPDATE "engine_decision" SET "reason_key" = 'screening'
 WHERE "flagged_for_review" = true AND "reviewed_at" IS NULL AND "reason_key" IS NULL
   AND "flag_reason" LIKE 'Percorso supervisionato%';

UPDATE "engine_decision" SET "reason_key" = 'calo_rapido_energia'
 WHERE "flagged_for_review" = true AND "reviewed_at" IS NULL AND "reason_key" IS NULL
   AND "flag_reason" LIKE 'Calo troppo rapido%';

UPDATE "engine_decision" SET "reason_key" = 'energia_bassa_cronica'
 WHERE "flagged_for_review" = true AND "reviewed_at" IS NULL AND "reason_key" IS NULL
   AND "flag_reason" LIKE 'Energia bassa cronica%';

-- Quello che resta senza causa (una riga aperta da una REGOLA, non da un guardrail: la frase è
-- scritta dal nutrizionista dentro il protocollo, quindi non si indovina) prende la causa
-- generica. Meglio una riga in meno in coda che due righe uguali: se il motore ne scrive una
-- nuova per una regola diversa, resta comunque una sola chiamata a guardare quella cliente.
UPDATE "engine_decision" SET "reason_key" = 'regola'
 WHERE "flagged_for_review" = true AND "reviewed_at" IS NULL AND "reason_key" IS NULL;

CREATE INDEX "engine_decision_client_id_reason_key_reviewed_at_idx"
  ON "engine_decision" ("client_id", "reason_key", "reviewed_at");
