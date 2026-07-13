-- Contabilità (backlog #6): voci di costo (ricorrenti + una tantum).
CREATE TABLE "cost_entry" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "cadence" TEXT NOT NULL DEFAULT 'once',
    "date" DATE NOT NULL,
    "end_date" DATE,
    "vendor" TEXT,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cost_entry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cost_entry_category_date_idx" ON "cost_entry"("category", "date");
