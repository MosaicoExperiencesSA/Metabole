-- Da nota singola (una per cliente) a log di note (una riga per nota).
ALTER TABLE "client_note" DROP CONSTRAINT "client_note_pkey";
ALTER TABLE "client_note" ADD COLUMN "id" TEXT;
UPDATE "client_note" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "client_note" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_pkey" PRIMARY KEY ("id");
ALTER TABLE "client_note" RENAME COLUMN "updated_by_id" TO "author_id";
ALTER TABLE "client_note" DROP COLUMN "updated_at";
ALTER TABLE "client_note" ALTER COLUMN "body" DROP DEFAULT;
CREATE INDEX "client_note_client_id_created_at_idx" ON "client_note" ("client_id", "created_at");
