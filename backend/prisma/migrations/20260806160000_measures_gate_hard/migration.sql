-- Gate misure severo (richiesta Simone 5/8, voce #6).
--
-- Il popup bloccante sulle misure esisteva già e tratteneva il menu, ma si poteva convivere:
-- la cliente lo chiudeva e tirava avanti. La richiesta è di stringere — niente menu, avviso alla
-- coach, solleciti ogni due ore e, dal giorno dopo, app bloccata con «contatta la tua coach per
-- sbloccare la app» — lasciando alla coach il potere di riaprire dopo aver sentito il motivo.
--
-- `measures_unlocked_until`: finestra di grazia concessa dalla coach dalla chat. È una DATA e non
-- un booleano perché uno sblocco senza scadenza equivale a disattivare la regola per sempre, e
-- nessuno si ricorderebbe di rimetterla.
--
-- `is_store_reviewer`: i recensori di Apple e Google usano account di prova. Se si trovassero
-- davanti a un'app bloccata rifiuterebbero la pubblicazione, quindi su quegli account le misure
-- sono considerate a posto e il blocco non scatta mai. Richiesto esplicitamente da Simone il 5/8.
ALTER TABLE "client_profile"
  ADD COLUMN "measures_unlocked_until" TIMESTAMP(3),
  ADD COLUMN "is_store_reviewer" BOOLEAN NOT NULL DEFAULT false;
