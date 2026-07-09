-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('in_person', 'televisit');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('scheduled', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('blood_test', 'photo', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'reviewed');

-- CreateTable
CREATE TABLE "visit" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "nutritionist_id" TEXT NOT NULL,
    "type" "VisitType" NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "video_room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "nutritionist_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_client_id_datetime_idx" ON "visit"("client_id", "datetime");

-- CreateIndex
CREATE INDEX "visit_nutritionist_id_datetime_idx" ON "visit"("nutritionist_id", "datetime");

-- CreateIndex
CREATE INDEX "document_client_id_uploaded_at_idx" ON "document"("client_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "document_status_idx" ON "document"("status");

-- CreateIndex
CREATE INDEX "clinical_note_client_id_date_idx" ON "clinical_note"("client_id", "date");

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
