-- VERA — le domande che aspettano una nutrizionista (contratto fra le due sessioni, 13/8). Additiva.

CREATE TABLE "richiesta_vera" (
    "id" TEXT NOT NULL,
    "chiave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "cliente_nome" TEXT,
    "nutrizionista_id" TEXT,
    "testo" TEXT NOT NULL,
    "termine" TEXT,
    "origine" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'aperta',
    "risposta" TEXT,
    "chiusa_da_id" TEXT,
    "chiusa_il" TIMESTAMP(3),
    "azione_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "richiesta_vera_pkey" PRIMARY KEY ("id")
);

-- ⚠️ L'unicità della chiave NON è un vezzo: è ciò che rende `apriRichiestaVera` richiamabile ogni
-- notte da un lavoro programmato senza riempire la coda di doppioni. La seconda chiamata con la
-- stessa chiave non fa niente, e non è un errore.
CREATE UNIQUE INDEX "richiesta_vera_chiave_key" ON "richiesta_vera"("chiave");
CREATE INDEX "richiesta_vera_nutrizionista_id_stato_idx" ON "richiesta_vera"("nutrizionista_id", "stato");
CREATE INDEX "richiesta_vera_stato_created_at_idx" ON "richiesta_vera"("stato", "created_at");
