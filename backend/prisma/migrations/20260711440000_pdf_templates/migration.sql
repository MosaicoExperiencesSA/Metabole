-- Template HTML dei PDF (ricevuta, report mensile) modificabili da admin.
CREATE TABLE "pdf_template" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pdf_template_pkey" PRIMARY KEY ("key")
);
