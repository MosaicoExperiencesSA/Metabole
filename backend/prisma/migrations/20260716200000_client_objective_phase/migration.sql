-- Fase attuale del cliente per l'abbinamento dieta: dimagrimento | mantenimento.
-- Decisione clinica dello staff. pickDiet la usa per scegliere la variante giusta
-- della famiglia (regime × obiettivo). Tutti i clienti esistenti partono in dimagrimento.
ALTER TABLE "client_profile" ADD COLUMN "objective" TEXT NOT NULL DEFAULT 'dimagrimento';
