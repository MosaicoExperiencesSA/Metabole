-- Metodo di pagamento "manual" per gli acquisti inseriti a mano dall'operatore.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'manual';
