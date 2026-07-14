-- Nuovo stato "cancelled" per i pagamenti: usato per l'annullo (operatore o cliente)
-- e per l'auto-annullo dei bonifici in attesa oltre la soglia di giorni.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'cancelled';
