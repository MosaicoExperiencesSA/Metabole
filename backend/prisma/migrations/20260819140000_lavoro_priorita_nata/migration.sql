-- LA PRIORITÀ CHE LA DÀ SIMONE, E LA DATA IN CUI IL PUNTO È NATO (19/8).
--
-- Due richieste dello stesso messaggio, e una ragione sola: «pensavo di chiudere la lista lavori ma
-- invece che diminuire aumentano» — cioè l'elenco non si riusciva più a governare, perché non
-- diceva né cosa contasse di più né da quando una voce fosse lì.
--
-- ## `priorita`
--
-- ⚠️ NON è `blocca`, e le due colonne restano separate di proposito. `blocca` è un FATTO — dietro
-- questa voce c'è una fila ferma — e lo può verificare chiunque; la priorità è un GIUDIZIO, e lo dà
-- una persona sola. Con un campo solo non si potrebbe più dire «lo so che ferma la coda, aspetta
-- lo stesso», e il rosso tornerebbe a significare «urgente»: in un mese sarebbe tutto rosso e il
-- colore smetterebbe di dire qualcosa.
--
-- ⚠️ Il default è «neutra» e non «bassa». Una voce nuova non è meno importante: è una voce su cui
-- nessuno si è ancora pronunciato. Scrivere «bassa» al posto di chi deve decidere è un giudizio
-- inventato — lo stesso difetto delle tre stelle di default (voce 270).
--
-- ## `nata_il`
--
-- ⚠️ `created_at` NON risponde a «quando è nato questo punto» per le voci che vengono dal file:
-- entrano tutte insieme al clic su «Aggiorna dal rilascio», quindi cento voci nate in due settimane
-- risultano create nello stesso minuto. Una data falsa è peggio di una data assente, perché si
-- legge come un fatto e non si può controllare.
--
-- Perciò è NULL-abile: la dichiara il file per le voci di cui la data si sa davvero, e la pagina
-- scrive «Aperta il …»; dove manca dice «In elenco dal …», che è un fatto diverso e va detto con
-- parole diverse.
--
-- Additiva: nessuna riga esistente cambia comportamento. Le voci già in pagina restano «neutra»
-- (nessuno si è pronunciato) e senza data di nascita (non la sappiamo), che è la verità.
ALTER TABLE "lavoro" ADD COLUMN "priorita" TEXT NOT NULL DEFAULT 'neutra';
ALTER TABLE "lavoro" ADD COLUMN "nata_il" TIMESTAMP(3);

CREATE INDEX "lavoro_fatto_priorita_idx" ON "lavoro"("fatto", "priorita");
