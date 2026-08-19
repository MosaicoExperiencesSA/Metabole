-- GLI ALIMENTI DA CORREGGERE A MANO — richiesta di Simone, 19/8 sera.
--
-- «Crea una tabella dove possiamo correggere a mano», sulla voce dei nomi liberi degli ingredienti.
-- L'elenco esisteva già, ma solo come TESTO dentro `npm run diag:crudo-cotto` e `npm run
-- diag:ricerca`, cioè su una shell di Render. ⚠️ Un elenco di lavoro che vive dove chi deve
-- lavorarci non entra è un elenco che nessuno lavora.
--
-- ## ⚠️ PERCHÉ NON UNA TABELLA NUOVA
--
-- «Quali alimenti ci mancano?» è UNA domanda, e la risposta arriva da due parti: le clienti che li
-- chiedono a Gaia (`times`, che c'è dal 11/8) e le ricette che li usano (`ricette`, che nasce qui).
-- Due tabelle vorrebbero dire due elenchi da lavorare, che divergono al primo giorno e fanno
-- lavorare due volte sullo stesso nome — ed è la stessa regola per cui in questo progetto due punti
-- che rispondono alla stessa domanda devono chiamarsi fra loro invece di somigliarsi.
--
-- ⚠️ E le due colonne NON si sommano: «chiesto 40 volte da persone diverse» e «usato in 1025
-- ricette» sono unità diverse, e un totale inventato farebbe ordinare l'elenco su un numero che non
-- vuol dire niente. Si mostrano tutte e due, e decide chi guarda.
--
-- ## Le altre due colonne
--
-- `motivo` — i tre casi si chiudono in tre modi diversi: una riga nuova (`non_in_tabella`), la riga
-- a crudo (`solo_da_cotto`, perché nelle ricette le grammature sono a crudo), lo stato dichiarato
-- (`senza_stato`). Un elenco che dice solo «manca» obbliga chi lo lavora a ricapirlo ogni volta.
--
-- `suggerito` — la riga a cui il nome si abbinerebbe. È il campo che fa risparmiare il lavoro:
-- «olio extravergine» → «olio extravergine di oliva» si chiude con UN sinonimo, e con una riga sola
-- si chiudono 2771 ricette. ⛔ Il sinonimo lo scrive una persona: qui si suggerisce, non si applica.
--
-- ⚠️ Migrazione ADDITIVA con i default: le righe che ci sono già restano valide e leggibili, e il
-- codice vecchio che non conosce queste colonne continua a funzionare identico.
ALTER TABLE "nutrient_lookup_miss" ADD COLUMN "ricette" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "nutrient_lookup_miss" ADD COLUMN "motivo" TEXT;
ALTER TABLE "nutrient_lookup_miss" ADD COLUMN "suggerito" TEXT;

-- L'elenco si legge ordinato per quante ricette lo usano, fra quelli ancora aperti.
CREATE INDEX "nutrient_lookup_miss_status_ricette_idx" ON "nutrient_lookup_miss"("status", "ricette");
