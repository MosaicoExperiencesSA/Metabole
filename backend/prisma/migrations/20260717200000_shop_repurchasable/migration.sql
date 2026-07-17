-- Flag "riacquistabile": se false, dopo l'acquisto l'articolo scompare dallo shop di quel cliente.
ALTER TABLE "plan" ADD COLUMN "repurchasable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product" ADD COLUMN "repurchasable" BOOLEAN NOT NULL DEFAULT true;
