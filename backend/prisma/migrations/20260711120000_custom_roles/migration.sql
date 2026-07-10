-- M-backoffice: ruoli personalizzati (etichetta + colore + ruolo di sistema di base).
-- I 6 ruoli di sistema (enum "Role") restano invariati; i ruoli custom sono un
-- livello aggiuntivo: l'utente conserva il suo ruolo di sistema (sicurezza backend
-- immutata) e in più può avere un ruolo personalizzato per etichetta e menu.

-- 1) role_page_permission.role: da enum "Role" a testo, così può contenere anche le
--    chiavi dei ruoli personalizzati oltre ai ruoli di sistema.
ALTER TABLE "role_page_permission" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

-- 2) Tabella dei ruoli personalizzati.
CREATE TABLE "custom_role" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "base_role" "Role" NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_role_pkey" PRIMARY KEY ("key")
);

-- 3) Assegnazione del ruolo personalizzato all'utente (facoltativa).
ALTER TABLE "user" ADD COLUMN "custom_role_key" TEXT;
ALTER TABLE "user"
  ADD CONSTRAINT "user_custom_role_key_fkey"
  FOREIGN KEY ("custom_role_key") REFERENCES "custom_role"("key")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "user_custom_role_key_idx" ON "user"("custom_role_key");
