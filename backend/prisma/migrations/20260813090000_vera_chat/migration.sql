-- VERA — consegna 2: la chat. Additiva.

-- Il nome che la nutrizionista dà al proprio agente: glielo chiede lui, al primo incontro.
-- NULL = non gliel'ha ancora chiesto, ed è quello che fa partire la presentazione.
ALTER TABLE "staff" ADD COLUMN "nome_agente" TEXT;

-- ⚠️ Tabella propria e non ChatThread/Message: quelle sono le conversazioni DELLE CLIENTI, e ci si
-- filtra per client_id. Un thread di nutrizionista lì dentro comparirebbe negli elenchi clienti di
-- mezzo backoffice senza dare nessun errore.
CREATE TABLE "messaggio_vera" (
    "id" TEXT NOT NULL,
    "nutrizionista_id" TEXT NOT NULL,
    "ruolo" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messaggio_vera_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "messaggio_vera_nutrizionista_id_created_at_idx" ON "messaggio_vera"("nutrizionista_id", "created_at");
