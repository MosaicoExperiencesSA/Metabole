-- A quale team vanno le provvigioni del prodotto: both | coaching | nutrition.
ALTER TABLE "product" ADD COLUMN "commission_team" TEXT NOT NULL DEFAULT 'both';
