-- GLI SPUNTINI CHE QUESTA CLIENTE NON VUOLE (13/8 sera — Vera, azione 3, Decisioni §14).
--
-- «Togli lo spuntino a Giulia»: il campo che rende quella frase un dato invece di un post-it.
-- Solo spuntini (morning_snack / afternoon_snack): i pasti principali passano da fasting_window,
-- che è una scelta di percorso con il suo permesso dedicato — due porte diverse apposta.
--
-- Le kcal della giornata NON si perdono: gli slot esclusi escono prima della composizione e il
-- target si ridistribuisce sui pasti rimasti (stessa strada del digiuno intermittente).
--
-- Additiva: array che nasce vuoto, nessuna cliente cambia comportamento finché qualcuno non scrive.

ALTER TABLE "client_profile" ADD COLUMN "pasti_esclusi" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
