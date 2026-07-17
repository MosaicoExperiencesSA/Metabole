-- Prezzi di lancio (handoff Prezzi/Prova): listino barrato + scadenza promo sui piani.
-- price_cents resta il prezzo di VENDITA in promo; scaduta la promo vale list_price_cents.
ALTER TABLE "plan" ADD COLUMN "list_price_cents" INTEGER;
ALTER TABLE "plan" ADD COLUMN "promo_ends_at" TIMESTAMP(3);
