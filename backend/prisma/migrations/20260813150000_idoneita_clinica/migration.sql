-- IL VIA LIBERA CLINICO: come la nutrizionista dice «può proseguire» (13/8).
--
-- Domanda di Simone: «se poi metti Visita obbligatoria e la nutrizionista decide che la cliente può
-- proseguire, come fa a dircelo? Questo succede per tutte le persone in percorso, parte il messaggio
-- sorveglianza sanitaria ma lei come fa a dirci ok può proseguire?»
--
-- ## Perché non bastava chiudere la segnalazione
--
-- Il canale c'era già — screening del questionario → segnalazione clinica → la nutrizionista la
-- chiude — ma ha la forma sbagliata per questa domanda:
--
--  1. ⚠️ La tregua di `escalations/riapertura.ts` dura 14 giorni, poi la segnalazione si RIAPRE.
--     Per il calo peso è giusto (quella condizione può peggiorare); per «ha un'allergia, serve la
--     visita» no: un'allergia non passa, e il via libera non scade su un timer.
--  2. ⚠️ «Risolta» registra uno stato e una data, non COSA ha deciso: se l'ha visitata, se aspetta
--     un certificato, o se ha valutato che la visita non serve.
--  3. ⚠️ Il flag `richiedeVisita` è derivato dalle allergie: chiudere la segnalazione non lo spegne,
--     quindi si riaccenderebbe da solo per sempre.
--
-- ## Cosa scrivono queste colonne
--
-- Una DECISIONE, sulla cliente: cosa, chi, quando, e la nota che la spiega. Non scade — una
-- valutazione clinica vale finché non arriva un fatto nuovo, non finché non scadono quattordici
-- giorni.
--
-- `idoneita`: 'idonea' | 'serve_visita'. NULL = nessuno l'ha ancora valutata, ed è diverso da
-- entrambe: è lo stato in cui si trova oggi chiunque.
--
-- ⚠️ LA NOTA NON SI COPIA QUI: `idoneita_nota_id` punta a una riga di `client_note`, la tabella
-- delle note sulla cliente che ESISTE GIÀ e che ha già autore e data. Richiesta di Simone: «rendere
-- obbligatoria la scrittura di una nota (dove segnamo chi ha scritto, data e ora) in modo che anche
-- la coach entrando vede la nota del nutrizionista». Scrivendola lì la coach la trova dove le note
-- le cerca già, invece che in un campo che solo la scheda clinica sa mostrare — e il testo esiste in
-- un posto solo.
--
-- ⚠️ NESSUN BLOCCO parte da qui. Il percorso e i menu continuano: bloccare l'erogazione vorrebbe
-- dire sospendere piani attivi a clienti paganti per un campo introdotto oggi, e su chi è già in
-- percorso sarebbe una sospensione di massa il giorno del rilascio.
--
-- Additiva, nessun backfill: tutte partono da NULL, cioè «da valutare», che è la verità.

ALTER TABLE "client_profile" ADD COLUMN "idoneita" TEXT;
ALTER TABLE "client_profile" ADD COLUMN "idoneita_decisa_il" TIMESTAMP(3);
ALTER TABLE "client_profile" ADD COLUMN "idoneita_decisa_da_id" TEXT;
ALTER TABLE "client_profile" ADD COLUMN "idoneita_nota_id" TEXT;

-- ⚠️ `ON DELETE SET NULL` e non `CASCADE`: se una nutrizionista lascia, la sua decisione clinica non
-- si cancella insieme al suo account — resta la decisione, si perde solo il nome. Il contrario
-- svuoterebbe le schede delle sue clienti nel giorno in cui se ne va.
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_idoneita_decisa_da_id_fkey"
  FOREIGN KEY ("idoneita_decisa_da_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stessa scelta sulla nota: se qualcuno la cancella dalla lista, la decisione resta in piedi e si
-- vede che la spiegazione non c'è più. Cancellare la decisione insieme alla nota sarebbe peggio.
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_idoneita_nota_id_fkey"
  FOREIGN KEY ("idoneita_nota_id") REFERENCES "client_note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "client_profile_idoneita_idx" ON "client_profile"("idoneita");
