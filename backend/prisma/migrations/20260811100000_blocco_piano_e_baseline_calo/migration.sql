-- Le due leve che «Correggi» offre al nutrizionista (decisioni dell'11/8, §15.2 punti 3 e 4).
--
-- 1) rapid_loss_baseline_at — «Autorizza a proseguire»: da quel momento il calcolo del ritmo di
--    calo riparte, e contano solo le pesate successive. Azzera l'ALLARME, non i progressi.
--
-- 2) plan_held_* — «Blocca il piano»: ferma i giorni NUOVI (quelli già ricevuti, incluso oggi,
--    restano della cliente). Prima questa leva non esisteva: il «piano bloccato» nasceva dagli
--    allergeni, diceva alla cliente una frase falsa e soprattutto non fermava l'erogazione.
--    plan_held_by_id dice chi l'ha messo, perché lo sblocco è suo, del capo o dell'admin.
ALTER TABLE "client_profile"
  ADD COLUMN "rapid_loss_baseline_at" TIMESTAMP(3),
  ADD COLUMN "plan_held_at"           TIMESTAMP(3),
  ADD COLUMN "plan_held_reason"       TEXT,
  ADD COLUMN "plan_held_by_id"        TEXT;

-- ON DELETE SET NULL come per coach e nutrizionista assegnati: se la scheda staff sparisce, il
-- blocco RESTA — è una decisione clinica sulla cliente, non una proprietà di chi l'ha presa. Con
-- un CASCADE la cancellazione di una collaboratrice sbloccherebbe in silenzio i piani che aveva
-- fermato, che è esattamente il tipo di effetto che nessuno collega alla causa.
ALTER TABLE "client_profile"
  ADD CONSTRAINT "client_profile_plan_held_by_id_fkey"
  FOREIGN KEY ("plan_held_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nessun backfill: nessuna cliente ha un piano bloccato con questo meccanismo, e un baseline
-- inventato su chi non è mai stato autorizzato spegnerebbe un allarme che nessuno ha messo in pausa.
