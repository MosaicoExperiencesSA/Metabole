-- Codici sconto personali (handoff punto 5): il codice può essere legato a UNA cliente.
ALTER TABLE "discount_code" ADD COLUMN "client_id" TEXT;
CREATE INDEX "discount_code_client_id_idx" ON "discount_code"("client_id");
