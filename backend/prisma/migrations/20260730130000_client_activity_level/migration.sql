-- Livello di attività fisica dichiarato dalla cliente (domanda dedicata).
-- Valori: sedentary | light | moderate | active | very_active. Guida il fattore di attività
-- nel calcolo del fabbisogno calorico giornaliero; se assente si usa lifestyle.work.
ALTER TABLE "client_profile" ADD COLUMN "activity_level" TEXT;
