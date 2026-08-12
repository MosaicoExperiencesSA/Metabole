-- «Gestito» diventa un RINVIO (Simone, 12/8). Serve sapere QUANDO è stato segnato.
ALTER TABLE "alert" ADD COLUMN "handled_at" TIMESTAMP(3);

-- ⚠️ Backfill su `updated_at`, e SOLO per i gestiti.
--
-- Lasciarlo null avrebbe due difetti opposti, tutti e due veri: senza data non si riaprono mai (e
-- l'arretrato resta invisibile per sempre), ma valorizzarlo a `now()` regalerebbe a tutti una
-- settimana in più proprio alle segnalazioni più vecchie. `updated_at` è la data più vicina al vero
-- che abbiamo: per un alert gestito, l'ultima scrittura È quasi sempre il momento in cui è stato
-- segnato gestito.
--
-- Conseguenza voluta: al primo ricalcolo notturno, i gestiti da più di una settimana la cui
-- condizione vale ANCORA tornano in lista tutti insieme. Non è rumore — è l'arretrato che era
-- rimasto nascosto, e la prima volta va guardato.
UPDATE "alert" SET "handled_at" = "updated_at" WHERE "status" = 'handled';

-- Il ricalcolo cerca i gestiti di UNA cliente: l'indice per cliente+tipo+stato che c'è già copre
-- la ricerca. Nessun indice nuovo.
