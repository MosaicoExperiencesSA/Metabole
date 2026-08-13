-- VERA — consegna 1: le fondamenta.
-- Tutto ADDITIVO: nessuna colonna riscritta, nessun dato toccato.

-- 1) «Questo giorno la cliente l'ha già visto?» — non esisteva.
--    `menu_day.status` c'è, con default 'planned', e non lo aggiorna nessuno: sembrava il posto
--    giusto e non lo era.
ALTER TABLE "menu_day" ADD COLUMN "viewed_at" TIMESTAMP(3);

-- I giorni GIÀ erogati restano `NULL`: non sappiamo se li ha visti, e «non lo so» non è «no».
-- Chi rigenera deve trattare il null come «non toccare», non come «rifallo pure».
CREATE INDEX "menu_day_client_id_viewed_at_idx" ON "menu_day"("client_id", "viewed_at");

-- 2) Il dizionario delle famiglie alimentari, per nutrizionista.
CREATE TABLE "famiglia_alimento" (
    "id" TEXT NOT NULL,
    "nutrizionista_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chiave" TEXT NOT NULL,
    "membri" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comune" BOOLEAN NOT NULL DEFAULT false,
    "promossa_da_id" TEXT,
    "promossa_il" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "famiglia_alimento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "famiglia_alimento_nutrizionista_id_chiave_key" ON "famiglia_alimento"("nutrizionista_id", "chiave");
CREATE INDEX "famiglia_alimento_chiave_idx" ON "famiglia_alimento"("chiave");
CREATE INDEX "famiglia_alimento_comune_idx" ON "famiglia_alimento"("comune");

-- 3) Il registro delle azioni, con la frase originale.
CREATE TABLE "azione_vera" (
    "id" TEXT NOT NULL,
    "nutrizionista_id" TEXT NOT NULL,
    "frase" TEXT NOT NULL,
    "azione" TEXT NOT NULL,
    "ambito" TEXT NOT NULL,
    "soggetto_tipo" TEXT NOT NULL,
    "soggetto_id" TEXT,
    "soggetto_nome" TEXT,
    "dettaglio" JSONB,
    "stato" TEXT NOT NULL DEFAULT 'attiva',
    "conflitto_sanitario" BOOLEAN NOT NULL DEFAULT false,
    "annullata_da_id" TEXT,
    "annullata_il" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "azione_vera_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "azione_vera_nutrizionista_id_created_at_idx" ON "azione_vera"("nutrizionista_id", "created_at");
CREATE INDEX "azione_vera_soggetto_id_created_at_idx" ON "azione_vera"("soggetto_id", "created_at");
CREATE INDEX "azione_vera_stato_idx" ON "azione_vera"("stato");
