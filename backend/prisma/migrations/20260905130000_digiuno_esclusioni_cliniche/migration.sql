-- LE ESCLUSIONI CLINICHE DAL DIGIUNO — decisioni della nutrizionista responsabile, 5/9/2026.
--
-- Documento firmato: progetto/guide/Risposte_Cliniche_Lucia_2026-09-05.pdf, scheda 7.
--
-- Tre domande di esclusione (punto 2): disturbi del comportamento alimentare storici o attivi,
-- gravidanza o allattamento, terapia ipoglicemizzante o diabete di tipo 1. Più la soglia di BMI
-- 18,5, che non ha bisogno di una colonna: si calcola da peso e altezza.
--
-- ⚠️ `fasting_exclusions` NULL vuol dire «non gliel'abbiamo chiesto», che è diverso da «ha
-- risposto no». Senza risposte il digiuno non si PROPONE; una cliente che già digiuna non si
-- SOSPENDE su un dato che non abbiamo — togliere il digiuno a qualcuno per una nostra ignoranza
-- è un danno fatto due volte.
--
-- `fasting_sospeso_il` / `fasting_sospeso_perche` restano scritti quando il giro notturno sospende
-- d'ufficio: senza, la cliente si troverebbe la giornata piena e nessuno saprebbe dire perché.
--
-- Tutte e tre additive e nullable: il giorno del deploy non cambia niente per nessuno.
ALTER TABLE "client_profile" ADD COLUMN "fasting_exclusions" JSONB;
ALTER TABLE "client_profile" ADD COLUMN "fasting_sospeso_il" TIMESTAMP(3);
ALTER TABLE "client_profile" ADD COLUMN "fasting_sospeso_perche" TEXT;
