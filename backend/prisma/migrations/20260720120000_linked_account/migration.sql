-- Utenza collegata (cliente <-> staff, stessa persona): switch di profilo senza logout.
ALTER TABLE "user" ADD COLUMN "linked_user_id" TEXT;
CREATE UNIQUE INDEX "user_linked_user_id_key" ON "user"("linked_user_id");
