-- LA SPUNTA «RICETTA VERIFICATA» — richiesta di Simone del 4/9.
--
-- «Quando vado in modifica devo avere un flag: ricetta verificata. Quando il nutrizionista clicca,
-- resta tutto registrato.» Due colonne, non una: senza CHI e QUANDO la spunta dice solo «qualcuno,
-- una volta» — ed è la stessa forma di `clinical_clearance`, dove resta scritto chi ha guardato.
--
-- ⚠️ NON si riusa `allergens_reviewed`: quella dice «i tag degli allergeni sono confermati», che è
-- una cosa più stretta e la legge il filtro di sicurezza. Questa dice «una nutrizionista ha
-- guardato la ricetta intera». Riusarla vorrebbe dire che spuntare l'una accende l'altra, e la
-- ricetta entrerebbe nei menu delle allergiche senza che nessuno abbia guardato i tag.
--
-- Nullable e senza default: aggiungerle non tocca nessuna delle ricette esistenti, che restano
-- semplicemente «non verificate» — che è la verità.
ALTER TABLE "recipe" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "recipe" ADD COLUMN "verified_by_id" TEXT;
