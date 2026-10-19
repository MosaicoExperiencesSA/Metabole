-- Pagamenti allo staff registrati dal backoffice (19/10/2026).
-- Tutte additive: le righe esistenti restano come oggi (nessuna contabile, manual = false).
ALTER TABLE "commission_withdrawal" ADD COLUMN "proof_data" BYTEA;
ALTER TABLE "commission_withdrawal" ADD COLUMN "proof_mime" TEXT;
ALTER TABLE "commission_withdrawal" ADD COLUMN "proof_name" TEXT;
ALTER TABLE "commission_withdrawal" ADD COLUMN "paid_with" TEXT;
ALTER TABLE "commission_withdrawal" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;
