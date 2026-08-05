-- Il popup "Come ti senti oggi?" ha un "Salta per oggi" che finora non salvava niente: chiudeva
-- il popup e basta, e ricompariva alla prima uscita dalla home. Da qui il "salta" diventa un
-- fatto registrato, valido per la giornata su qualunque dispositivo.
--
-- Tabella separata da daily_checkin, non una colonna dentro il check-in: saltare NON è un
-- check-in, e le righe di daily_checkin sono contate come aderenza in quindici punti del backend
-- (report mensile, report di piano, segnali del motore, alert al coach, diet-learning). Una
-- colonna "skipped" avrebbe richiesto di escluderla in tutte quelle query, e la prima dimenticata
-- avrebbe gonfiato l'aderenza di una cliente che in realtà non ha risposto.
CREATE TABLE "checkin_skip" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_skip_pkey" PRIMARY KEY ("id")
);

-- Un solo skip per cliente per giorno: rende l'upsert idempotente, così ritoccare "Salta" o
-- riaprire l'app non crea righe doppie.
CREATE UNIQUE INDEX "checkin_skip_client_id_date_key" ON "checkin_skip"("client_id", "date");

ALTER TABLE "checkin_skip" ADD CONSTRAINT "checkin_skip_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
