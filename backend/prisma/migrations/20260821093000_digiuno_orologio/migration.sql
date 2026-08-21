-- L'OROLOGIO DEL DIGIUNO — gli orari accanto alla finestra (21/8).
--
-- Alla cliente in digiuno non si chiede più «quali pasti preferisci saltare?», una domanda
-- astratta, ma «a che ora mangi». `fasting_window` resta ed è ancora il dato che tutto il motore
-- legge: non lo sceglie più nessuno a mano, lo DERIVA `menu/orologio-digiuno.ts` da queste colonne.
--
-- ⚠️ TUTTE ADDITIVE E NULLABLE: nessuna riga esistente cambia significato, e nessuna cliente
-- cambia menu per effetto di questa migrazione. Il giorno del deploy, in produzione, non succede
-- niente di visibile — ed è voluto.
--
-- ⚠️ `fasting_scelto_il` NASCE A NULL PER TUTTE, e non è una dimenticanza: è il meccanismo.
-- NULL vuol dire «non gliel'abbiamo ancora chiesto», che è una cosa diversa da «non digiuna». È
-- quel NULL a far atterrare sulla pagina dell'orologio, al primo avvio dopo il rilascio, le sei
-- clienti che oggi digiunano (`npm run diag:digiuni`, 21/8: cinque su «salta la colazione», una su
-- «salta la cena»). Sceglieranno loro.
--
-- ⛔ Per questo NON c'è nessuno script di backfill, e non è un pezzo rimandato: la versione
-- precedente della specifica prevedeva di scrivere d'ufficio protocollo e orario nel profilo di
-- ognuna, dedotti dalla finestra storica. Era il punto con più rischio di tutta la consegna — una
-- traduzione fatta a tavolino, scritta nel profilo di persone vere mentre dormono. Decisione di
-- Simone del 21/8: atterrano tutte sulla pagina e scelgono. «Non lo so» costa meno di «ho
-- indovinato», e qui il sistema smette di indovinare.
--
-- ⚠️ La CHIUSURA della finestra non ha una colonna: è `fasting_start_min + ore(protocollo) × 60`,
-- modulo 24 ore. Una durata scritta in due posti è una durata che prima o poi diverge.
--
-- ⚠️ QUATTRO colonne non le scrive ancora nessuno, ed è dichiarato invece che silenzioso:
-- `fasting_target_start_min` (l'adattamento graduale: spostare la finestra più presto accorcia il
-- digiuno, quindi si fa un'ora al giorno), `fasting_target_protocol` (la rampa d'ingresso: chi
-- inizia non parte da sedici ore, ci arriva) e le due del sonno, `fasting_sleep_start` /
-- `fasting_sleep_end`, che serviranno a zittire le push notturne **per cliente** — oggi quel
-- silenzio è una finestra globale in `notifications.service.ts`, uguale per tutte. (Le due del
-- sonno erano descritte al presente sia qui che nello schema: corretto in revisione il 21/8, perché
-- un campo dichiarato attivo e mai letto è un pezzo che nessuno implementa più.) Arrivano coi loro
-- pezzi: stanno qui perché una colonna in più oggi costa una riga, e una migrazione in più domani
-- costa un deploy.
--
-- ⚠️ Nessuna ha un DEFAULT, ed è voluto per due motivi. Su Postgres così è una modifica di solo
-- catalogo — nessuna riscrittura della tabella, lock trascurabile anche in produzione. E NULL vuol
-- dire «non me l'ha detto», che non è la stessa cosa di un orario scelto: il ripiego, dove serve, lo
-- mette chi legge, in un punto solo.
ALTER TABLE "client_profile"
  ADD COLUMN "fasting_protocol"          TEXT,
  ADD COLUMN "fasting_start_min"         INTEGER,
  ADD COLUMN "fasting_target_start_min"  INTEGER,
  ADD COLUMN "fasting_target_protocol"   TEXT,
  ADD COLUMN "fasting_sleep_start"       INTEGER,
  ADD COLUMN "fasting_sleep_end"         INTEGER,
  ADD COLUMN "fasting_changed_at"        TIMESTAMP(3),
  ADD COLUMN "fasting_scelto_il"         TIMESTAMP(3);
