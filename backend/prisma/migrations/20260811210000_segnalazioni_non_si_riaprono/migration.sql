-- «Se ha risolto, basta fino a nuova segnalazione» (richiesta dell'11/8).
--
-- Due colonne sulle segnalazioni:
--  · `resolved_at` — QUANDO è stata chiusa. Non si usa `updated_at` perché quello si muove a ogni
--    modifica: riassegnare una segnalazione a un'altra nutrizionista farebbe ripartire da zero la
--    tregua durante la quale non si riapre.
--  · `severity`   — QUANTO era grave quando è stata aperta (es. kg/settimana di calo). Serve a
--    riaprirla se la cosa peggiora davvero. Prima quel numero viveva solo dentro la frase del
--    motivo, e da lì si poteva soltanto estrarre con una regex.
--
-- Entrambe nullable: le segnalazioni che non hanno un «quanto» (piano bloccato, umore, aderenza)
-- restano senza gravità, e per loro vale solo la tregua.
ALTER TABLE "escalation" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);
ALTER TABLE "escalation" ADD COLUMN IF NOT EXISTS "severity" DOUBLE PRECISION;

-- Backfill: per le segnalazioni GIÀ risolte la data di chiusura migliore che abbiamo è
-- `updated_at`. Senza questo, tutte le chiusure fatte finora conterebbero come «mai risolte» e la
-- prima notte dopo il rilascio si riaprirebbero in blocco — che è esattamente il difetto che
-- stiamo togliendo.
UPDATE "escalation" SET "resolved_at" = "updated_at" WHERE "status" = 'resolved' AND "resolved_at" IS NULL;
