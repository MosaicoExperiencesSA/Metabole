-- Regime e stile dieta: da enum fissi a TESTO, per renderli configurabili
-- (regime) e derivabili dalle diete (stile). I valori esistenti sono conservati
-- (::text), gli indici vengono ricostruiti in automatico da Postgres.
ALTER TABLE "client_profile" ALTER COLUMN "regime" TYPE TEXT USING "regime"::text;
ALTER TABLE "client_profile" ALTER COLUMN "diet_style" TYPE TEXT USING "diet_style"::text;
ALTER TABLE "diet" ALTER COLUMN "regime" TYPE TEXT USING "regime"::text;
ALTER TABLE "diet" ALTER COLUMN "style" TYPE TEXT USING "style"::text;
ALTER TABLE "recipe" ALTER COLUMN "regime" TYPE TEXT USING "regime"::text;

-- Ora che nessuna colonna li usa più, rimuoviamo i tipi enum.
DROP TYPE IF EXISTS "Regime";
DROP TYPE IF EXISTS "DietStyle";
