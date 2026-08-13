-- L'ELENCO DEI LAVORI — la pagina «Lavori» del backoffice (13/8).
--
-- Richiesta di Simone: «una pagina con modifiche e implementazioni, con l'elenco dei lavori da fare,
-- e una volta fatto mettiamo la spunta — così è tutto registrato ed evidente. Visibile solo ad
-- admin.»
--
-- ⚠️ Non è un doppione del REGISTRO: quello racconta cosa è stato scritto, questa tabella risponde a
-- cosa manca. Le voci fatte NON si cancellano — restano in fondo con la data, perché «cosa è stato
-- fatto» è la domanda vera quando qualcuno chiede a che punto siamo.
--
-- Additiva: tabella nuova, nessuna riga esistente toccata.

CREATE TABLE "lavoro" (
  "id"          TEXT NOT NULL,
  "titolo"      TEXT NOT NULL,
  "dettaglio"   TEXT,
  -- Il raggruppamento della pagina. «Aspetta Nocanty» / «Aspetta Simone» sono categorie e non un
  -- campo in più: in un elenco misto una decisione clinica in attesa sembra codice non scritto.
  "categoria"   TEXT NOT NULL DEFAULT 'Da fare',
  "ordine"      INTEGER NOT NULL DEFAULT 0,
  -- ⚠️ La chiave del caricamento iniziale dai documenti: è ciò che rende lo script rilanciabile
  -- senza duplicare. NULL per le voci scritte a mano dalla pagina.
  "chiave"      TEXT,
  -- ⚠️ «Questa voce ne blocca altre»: il rosso della pagina. Non è «importante» — è «finché non si
  -- chiude, dietro c'è una fila ferma». Se diventasse un modo per dire «urgente», in un mese
  -- sarebbe tutto rosso e il colore non direbbe più niente.
  "blocca"      BOOLEAN NOT NULL DEFAULT false,
  "fatto"       BOOLEAN NOT NULL DEFAULT false,
  "fatto_il"    TIMESTAMP(3),
  "fatto_da_id" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lavoro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lavoro_chiave_key" ON "lavoro"("chiave");
CREATE INDEX "lavoro_fatto_categoria_ordine_idx" ON "lavoro"("fatto", "categoria", "ordine");

-- ⚠️ `ON DELETE SET NULL`, come per il via libera clinico: se chi ha spuntato lascia l'azienda, la
-- voce resta fatta e si perde solo il nome. Il contrario cancellerebbe pezzi di elenco il giorno in
-- cui si chiude un account.
ALTER TABLE "lavoro" ADD CONSTRAINT "lavoro_fatto_da_id_fkey"
  FOREIGN KEY ("fatto_da_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
