-- STORICO DELLE ASSEGNAZIONI DEI LEAD (richiesta di Simone dell'11/8).
--
-- «Mostra accettati con la cronologia, quindi tutti i dati vanno archiviati.» Il flag non si poteva
-- fare senza questa tabella: su `crm_record` i campi dell'assegnazione descrivono lo stato di ADESSO
-- e ogni passaggio cancella il precedente — il rifiuto azzera `assigned_coach_id`, la scadenza del
-- cron fa lo stesso e non lascia nemmeno una riga di audit, l'assegnazione massiva ne lascia una
-- sola con l'id del primo lead. Il risultato è che «chi l'ha rifiutato e perché» era una domanda
-- senza risposta possibile.
--
-- I nomi di coach e assegnante sono COPIATI dentro la riga: uno storico che dice «assegnato a —»
-- perché quella coach non lavora più qui non è uno storico.
CREATE TABLE IF NOT EXISTS "lead_assignment" (
  "id"               TEXT PRIMARY KEY,
  "record_id"        TEXT NOT NULL,
  "coach_id"         TEXT,
  "coach_name"       TEXT NOT NULL,
  "assigned_by_id"   TEXT,
  "assigned_by_name" TEXT,
  -- pending | accepted | rejected | expired | reassigned
  "status"           TEXT NOT NULL DEFAULT 'pending',
  -- manual | bulk | ref_code
  "origin"           TEXT NOT NULL DEFAULT 'manual',
  "assigned_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at"      TIMESTAMP(3),
  "reason"           TEXT
);

-- La cronologia di un lead, in ordine: è la lettura della scheda.
CREATE INDEX IF NOT EXISTS "lead_assignment_record_idx" ON "lead_assignment" ("record_id", "assigned_at");
-- «Cosa ha in mano questa coach»: la tabella «Lead da accettare» e il flag «mostra accettati».
CREATE INDEX IF NOT EXISTS "lead_assignment_coach_idx" ON "lead_assignment" ("coach_id", "status");
-- Le pendenti più vecchie: quello che guarda il cron delle scadenze.
CREATE INDEX IF NOT EXISTS "lead_assignment_status_idx" ON "lead_assignment" ("status", "assigned_at");

ALTER TABLE "lead_assignment"
  ADD CONSTRAINT "lead_assignment_record_id_fkey"
  FOREIGN KEY ("record_id") REFERENCES "crm_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Coach e assegnante: SET NULL, non CASCADE. Se una scheda staff viene rimossa la riga di storico
-- deve restare (il nome è già copiato dentro); con CASCADE sparirebbe la storia insieme alla persona.
ALTER TABLE "lead_assignment"
  ADD CONSTRAINT "lead_assignment_coach_id_fkey"
  FOREIGN KEY ("coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_assignment"
  ADD CONSTRAINT "lead_assignment_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- RECUPERO DI QUELLO CHE SI PUÒ ANCORA RECUPERARE.
--
-- Le assegnazioni chiuse in passato non si possono ricostruire: i campi che le contenevano sono
-- stati sovrascritti, e inventarle sarebbe peggio che non averle. Quello che esiste ancora è lo
-- stato corrente di ogni lead assegnato, e va portato dentro l'archivio: altrimenti il giorno del
-- rilascio il flag «mostra accettati» mostra una tabella vuota anche per le coach che hanno decine
-- di lead accettati, e sembra rotto.
--
-- `origin = 'manual'` per tutte: chi ha `assigned_by_id` nullo con stato `accepted` è quasi sempre
-- un ref code, ma «quasi sempre» non basta per scriverlo in un archivio. Resta 'manual' e nessuno
-- legge un dato inventato.
INSERT INTO "lead_assignment" ("id", "record_id", "coach_id", "coach_name", "assigned_by_id", "assigned_by_name", "status", "origin", "assigned_at", "resolved_at")
SELECT
  gen_random_uuid()::text,
  r."id",
  r."assigned_coach_id",
  COALESCE(c."display_name", 'coach non più presente'),
  r."assigned_by_id",
  a."display_name",
  r."assignment_status",
  'manual',
  COALESCE(r."assigned_at", r."created_at"),
  -- Le accettate sono già chiuse, ma non sappiamo QUANDO: meglio la data dell'assegnazione che una
  -- data inventata. Le pendenti restano aperte, come sono.
  CASE WHEN r."assignment_status" = 'accepted' THEN COALESCE(r."assigned_at", r."created_at") ELSE NULL END
FROM "crm_record" r
LEFT JOIN "staff" c ON c."id" = r."assigned_coach_id"
LEFT JOIN "staff" a ON a."id" = r."assigned_by_id"
WHERE r."assignment_status" IN ('pending', 'accepted')
  AND r."assigned_coach_id" IS NOT NULL;
