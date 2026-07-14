# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

---

## 2026-07-14

- `[Sviluppo]` **Lista consolidata dei lavori restanti** (`progetto/Lavori_Restanti_20260714.md`) — unifica Relazione_Cosa_Manca, Handoff sessione motore e sprint go-live del 14/07; sostituisce le liste precedenti. Include le **nuove richieste di Simone**: ① regola motore "ripetizione bigiornaliera" decisa dal nutrizionista (giorno 2 = stessi alimenti, preparazione diversa scelta dal motore), design da validare col socio; ② **Liste CRM** manuali per suddividere lead/clienti (viste tutte/per lista, badge nel dettaglio accanto allo stato CRM) con **import delle liste storiche** (stato precedente + totale già pagato, separato dalla contabilità Metabole).

- `[Sviluppo]` **Backoffice — permessi completi, moduli dashboard, scheda lead** — ① ogni schermata ora è
  controllata dalla tabella permessi: nuova chiave `posta` (staff di default), Dashboard senza bypass,
  Ricette/Allergeni sulla chiave `recipes`; `syncDefaults` completa anche i ruoli personalizzati (ereditano
  il default del ruolo di base per le sezioni nuove). ② Moduli dashboard per tutte le sezioni aggiunte
  (Chat, Posta, Negozio, Buoni sconto, Contabilità, Provvigioni, Prelievi, Testimonianze) con anteprime.
  ③ Nuova **scheda lead** `/crm/lead/:id` (click sul nome del lead puro in Gestione lead e Pipeline):
  anagrafica modificabile, stato, coach, promemoria, storico stati; backend `GET /crm/leads/:id` +
  `PATCH /crm/leads/:id/info`. Test aggiornati (permessi custom role, CRM updateInfo/detail).

- `[Prodotto]` **Documento "Cosa resta da fare" per Simone (PDF)** (`Metabole_Simone_Cosa_Resta.pdf`) — riepilogo completo e prioritizzato: A) gate di lancio (base contatori con snippet, Stripe LIVE + pagamento reale, email/DNS, smoke test); B) config & deploy (CORS/URL, AI key, segreti Render, FCM, Vercel/backoffice); C) pulizie (app/.env.example, rimuovere schema_1.prisma, build/test pipeline, cron); D) post-lancio (motore R8–R12 restante, email→Brevo, marketing/Giudice, blog/Publisher, app dedicate, prodotti dinamici, certificazione unicità). Con ordine consigliato e riferimenti.

- `[Prodotto]` **Estratto traduzioni sensibili RU/ZH/AR per revisore** (`marketing/Traduzioni_Revisione_RU_ZH_AR.md`) — 18 stringhe chiave del sito (claim hero, concept "non una dieta", banda, multiculturalità, CTA, coach/supervisione, testimonianze, form + **consenso privacy**) affiancate IT↔RU, IT↔ZH, IT↔AR, con colonna "Correzione". Nota: pagine legali (privacy/cookie/termini) da rivedere a parte nei loro file. Pronto da mandare a un madrelingua per lingua; manca solo il revisore.

- `[Prodotto]` **Marketing — catalogo email al 100%** (`marketing/Metabole_Email_Ciclo_Vita.md` Parti 6–7 + tracker) — scritte anche le ultime email (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali: verifica/reset/ricevuta/rinnovo/**dunning**/appuntamento, consensi: re-permission/preferenze). Tracker `Elenco_Email_Automatiche.md`: **48 email tutte 🟢** (copy pronta), zero residui. Prossimo passo (Sviluppo): traduzione nelle lingue dell'app + template Brevo agganciati ai trigger.

- `[Prodotto]` **Marketing — completata la copy delle email in bozza** (`marketing/Metabole_Email_Ciclo_Vita.md` Parte 5) — scritte le email che restavano 🟡: conversione (profilo incompleto, **nurture 1–4**), retention (**onboarding G1/G2/G4/G7**, feedback ricette, riattivazione dropout, referral), **win-back T+3/T+7**. Tracker `email_automatiche/Elenco_Email_Automatiche.md` aggiornato: tutte 🟢 tranne le ⚪ (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali/dunning, consensi). Prossimo passo: traduzione + template Brevo con i trigger.

- `[Prodotto]` **Piano Prodotto pre-lancio + primi materiali** — `progetto/Piano_Prodotto_PreLancio.md` (task nostri: team, testimonianze, revisione traduzioni, email, smoke test). Preparati: `marketing/Modulo_Testimonianze_Consenso.md` (raccolta + liberatoria GDPR + linee guida + tracce domanda) e `progetto/Template_Pagina_Team.md` (schede ruolo/CV + specifiche foto). **Rimosso ogni riferimento alle "grammature"** (non esistono nel nostro prodotto: si lavora per piatto e calorie) da Piano, STATO_LANCIO e checklist go-live.

- `[Prodotto]` **Pagina unica STATO LANCIO** (`progetto/STATO_LANCIO.md`) — one-pager sempre aggiornato con "cosa manca per aprire": semaforo, ✅ già fatto (verificato live), 🔴 4 gate (base contatori, Stripe LIVE + pagamento reale, email/DNS, smoke test), 🟠 consigliati (backoffice, FCM, pulizie), 🔵 contenuti [Pr], ⚪ dopo il lancio. Da tenere come riferimento quando si chiede lo stato.

- `[Prodotto]` **Sito — contatori: base storica Mosaico + nuova dicitura (9 lingue)** (`Metabole_Sito_Presentazione.html`) — i contatori partono dai numeri storici di **Mosaico Experiences SA**: **persone raggiunte da 85.218**, **clienti seguiti da 18.979** (default HTML + `STATS`). Nuova **dicitura** sotto i contatori (versione "sobria e chiara", tradotta in tutte le 9 lingue): *"L'esperienza è quella del nostro team. I clienti seguiti e le persone raggiunte sono i numeri che Mosaico Experiences SA ha maturato in 5 anni con diversi prodotti dedicati alla nutrizione."* → **impatto [Sviluppo]:** i numeri vivono nel DB e l'endpoint `/public/stats` sovrascrive i default (oggi mostra ~12/13 perché la base è ~0). Impostare la **base** nel backend/`config_param` così che `reached = 85218 + n° lead` e `clients = 18979 + n° acquisti` (offset di partenza), lasciando l'incremento +1 per lead / +1 per acquisto.

- `[Sviluppo]` **Generazione automatica dei codici col metodo aziendale** — nuovo modulo
  `common/ref-code.ts`: ogni codice generato in automatico segue la regola **5 lettere cognome +
  iniziale nome + progressivo da 01** (es. VOLPEA01). Vale per il ref code coach (admin e "il mio
  invito") e per il codice cliente "porta un'amica" (dal nome della cliente); casuale solo se il
  nome manca. Con la stessa forma nei due spazi, l'**unicità è verificata incrociata** (staff.refCode
  + clientProfile.referralCode), anche per i codici impostati a mano dall'admin. Inserimento
  case-insensitive (già garantito). +6 unit test (lead-assignment e referral).

- `[Prodotto]` **Go-live — verifica LIVE + checklist ridotta** (`Metabole_Checklist_GoLive.md`) — controllo dal vivo: backend up (`/health`, `/plans` = 3 piani reali €297/€497/€797 → DB Neon prod seedato), `/payment-methods` carta+bonifico (Stripe collegato), **app cliente live** su app.metabole.eu, sito live, endpoint lead attivo, utenze staff reali create. Infrastruttura **in piedi**. Restano solo **conferme** (Stripe in modalità LIVE + webhook, deliverability email Brevo/DNS, backoffice raggiungibile, FCM) + **smoke test con pagamento reale** + **contenuti** (team, grammature Keto, traduzioni, testimonianze). Checklist riscritta con spuntato ciò che è live e ridotta ai punti rimasti.

- `[Prodotto]` **Marketing — area "Email automatiche" con elenco-tracker** (`marketing/email_automatiche/Elenco_Email_Automatiche.md`) — nuovo registro di lavoro delle email automatiche in preparazione, con campi **evento (trigger), oggetto, testo (sintesi), segmento, timing, stato** (⚪ da progettare / 🟡 bozza / 🟢 copy pronta / 🔵 da tradurre / ⬛ template Brevo / ✅ live). Raggruppate in 8 aree: attivazione, conversione, retention, **email per evento** (peso obiettivo, morale, plateau, ricorrenze…), rinnovo, win-back, servizio/transazionali, consensi. Rimanda alla copy completa in `Metabole_Email_Ciclo_Vita.md` e alle campagne massive.

- `[Prodotto]` **Marketing — Email per ciclo di vita (per stato utente)** (`marketing/Metabole_Email_Ciclo_Vita.md`) — set completo di email triggered mappate a stati CRM e agente. Le 3 richieste con **copy pronta** (Benvenuto; "Il tuo profilo è pronto" con riepilogo questionario + piano + nutrizionista + coach; "Il tuo piano inizia domani + lista della spesa") + proposta di tutto il resto da agente di marketing: conversione (profilo incompleto, **checkout abbandonato** 3 email, nurture chi non sceglie il piano, obiezione prezzo), retention (onboarding 1–7, milestone, feedback ricette, contenuti valore, **riattivazione dropout_risk**, supporto stato Conforto, **referral**), **rinnovo** in scadenza (T-7/T-3/T-1 + upsell), **win-back** scaduti (grace, novità, survey uscita, stagionale), transazionali/dunning, consensi/preferenze. Con merge tag Brevo, trigger, priorità, A/B, metriche e passaggio dal Giudice. Da tradurre + costruire template Brevo. Nessun invio senza consenso. **Aggiunta copy completa** delle email ad alto impatto (checkout abbandonato A2.1–A2.3, rinnovo C1–C3) e una **Parte 4 — Email per EVENTO** (EV1 obiettivo di peso raggiunto, primo risultato, traguardo intermedio, costanza, **plateau**, **giornata storta/morale**, misure mancanti, rientro, compleanno, anniversario, pre-evento agenda, passaggio a mantenimento) con regole di frequenza e benessere.

- `[Sviluppo]` **Create le 14 utenze staff reali in produzione** — via `POST /admin/users` (admin
  `admin@metabole.eu`, password recuperata col flusso di reset): Giusy Vita (`sales` = Responsabile
  Coach), Antonio Nocera (`head_marketing`) e 12 coach (`coach`), email `nome@metabole.eu`, password
  provvisoria con **obbligo di cambio al primo accesso**, le 12 coach con **manager = Giusy** e **ref
  code personalizzato** (regola: 5 lettere cognome + iniziale nome + 01; inserimento case-insensitive,
  già garantito da `resolveByRefCode`). Verifica live: lista utenti completa, login di prova con flag
  `mustChangePassword=true`. Credenziali provviste fuori repo (repo pubblico).

- `[Prodotto]` **Checklist go-live aggiornata + Runbook operativo PDF** — `Metabole_Checklist_GoLive.md` rivista sullo stato reale: i **3 blocker di codice sono CHIUSI** (endpoint pubblico lead, form sito collegati, scoping per-paziente). Restano solo configurazione (Neon, segreti, Stripe LIVE, Brevo+DNS, CORS, FCM), deploy dei due front-end su Vercel e smoke test. Nuovo `Metabole_Runbook_GoLive.pdf` con l'**ordine esatto 1→9** dei passi (per Simone/Ops) + pulizie [Sv] (`app/.env.example`, rimuovere `schema_1.prisma`, build/test in pipeline) e contenuti [Pr]. Nessun nuovo sviluppo per aprire; chiavi solo nei pannelli, mai nel repo.

- `[Prodotto]` **E1 Agente Esclusioni (R8) — decisioni per Simone** (`Metabole_E1_Agente_Esclusioni_Decisioni.md`) — sciolte Q1/Q2 bloccanti e confermate le proposte di default: **Q1** tag allergeni normalizzati (14 UE) taggati dal nutrizionista, con **pre-tag assistito** da confermare + gate "prodotto non attivabile finché ricette non taggate e gruppi approvati"; **Q2** derivati via tag (un tag = alimento + derivati), tracce rimandate; **Q3** filtro ricette (no generazione automatica); **Q4** base personale = `recipeIds` sicuri; **Q5** veg/vegano ora, religione dopo; **Q6** blocca+escala se un solo **slot principale** scoperto (spuntini/merende non bloccano) + testo messaggio cliente; **Q7** run a fine onboarding + su update profilo + pulsante "rigenera base" + flag rigenerazione su nuova versione base; **Q8** ≥3 opzioni per slot principale in `config_param` (soglia separata per spuntini/merende). Via libera a E1.

- `[Sviluppo]` **Obbligo cambio password al primo accesso + ruolo `sales` → "Responsabile Coach"** — nuovo
  campo `must_change_password` su `user` (migrazione `20260714120000_must_change_password`, validata su
  PG16, default false); `POST /admin/users` accetta `mustChangePassword`, il flag è esposto in `/me`,
  nella lista utenti admin e nella risposta di login; `PATCH /me/password` lo azzera al primo cambio
  riuscito. **Backoffice**: nuova schermata bloccante `CambioPasswordObbligatorio` (gate in `Protected`)
  — finché la password provvisoria non viene cambiata nessuna pagina è raggiungibile; build Vite ok.
  Etichetta del ruolo `sales` unificata a **"Responsabile Coach"** in backend e backoffice (era
  "Commerciale"/"Resp. Coach Team": la voce "commerciale" nella tabella ruoli era un refuso storico).
  +2 unit test su UsersService. Scopo: onboarding delle utenze staff reali (team coach + responsabili)
  con password provvisoria consegnata a voce e cambio obbligatorio.

- `[Sviluppo]` **Sito di presentazione LIVE su metabole.eu + favicon Gaia** — pubblicato su SiteGround
  (`public_html`) il sito v4 completo: home + Blog/Lavora/Privacy/Cookie/Termini; WordPress preinstallato
  accantonato senza cancellarlo (`DirectoryIndex index.html index.php` in `.htaccess`). Collaudo go-live da
  `Istruzioni_Claude_Sito_Metabole.md`: endpoint pubblici 200 con CORS ok da metabole.eu e www, sezioni
  dinamiche popolate (stats/percorsi/testimonianze), form lead → CRM verificato (lead di prova "Test GoLive
  Claude" da cancellare), honeypot che scarta. Aggiunta **favicon Gaia** (`favicon.svg` dalla mascotte
  `#gaiaMascot` + PNG 32px inline) su tutte le pagine. → nota: dopo ogni modifica ai file del sito nel repo,
  ricopiare su SiteGround e svuotare la Cache Dinamica.


- `[Prodotto]` **Risposta al piano R8–R12 di Simone — decisioni per sbloccare l'agente** (`Metabole_Motore_R8_R12_Decisioni.md`) — verificata e confermata la mappatura di Simone sullo schema reale (CycleFeedback/RecipeRating/MenuWeight/EngineDecision/Protocol/Escalation/ProductRule ci sono; ClientProfile senza `allergies`; mancano EquivalenceGroup/ClientCycle/ClientMenuPool). Decise le 5 domande aperte: **D1** Agente (B) genera i menu, motore a protocolli (A) resta guardrail di sicurezza (non si fondono); **D2** gruppi di equivalenza = **modello dedicato** `EquivalenceGroup` del nutrizionista (seed dai 23 gruppi di regola4), non tag; **D3** unicità = seme+collision check+`PersonalizationCertificate` (HMAC/hash-chain) per l'MVP, PKI/auditor esterno rimandato (claim marketing → Antonio); **D4** stati contestuali sul `ClientCycle`, soglie in config_param, guardrail conforto→mood_risk; **D5** aggiungere `ClientProfile.allergies String[]` + domanda onboarding separata. Approvato il piano a fasi E0→E5 e le migrazioni additive sicure (allergies + scheletro modelli). Priorità: prima i blocker go-live.

- `[Prodotto/Sviluppo]` **Keto inserito nel motore + PDF Metodo/Audit + 12 regole nel wizard "Costruisci nuovo percorso"** — (1) **Motore**: base Keto approvata caricata come catalogo **isolato** del prodotto Keto — `backend/prisma/data/keto_catalog.json` (**118 ricette** per pasto con kcal, metodi di cottura, tag keto/veg; **8 giornate bilanciate** ~1450 kcal) + `backend/prisma/seed_keto.ts` (idempotente, crea Recipe + Diet `style:keto` con dayTemplates, isolato per prodotto) agganciato in `seed.ts` (`seedKetoCatalog`). (2) **PDF**: `Metabole_Metodo_Motore_Intelligente.pdf` (Fase A R1–R7 + Fase B R8–R12, mappa "dove agisce l'agente") e `Metabole_Audit_Personalizzazione.pdf` (verifica: ogni menu personalizzato e muta sui bisogni; parità Keto↔Mediterranea; rischi/presidi). (3) **Wizard** `Metabole_Wizard_Crea_Prodotto.html`: nuovo pannello con le **12 regole** in 2 fasi, R8+ marcate come **agente AI**, titolo "Costruisci nuovo percorso · nutrizionista/admin". → impatto [Sviluppo]: rivedere `seed_keto.ts` (grammature reali le fissa il nutrizionista); il seed è idempotente e non tocca cataloghi già popolati.

- `[Prodotto]` **METODO DEL MOTORE INTELLIGENTE — regole canoniche unificate (Keto + Mediterranea) per ogni percorso** (`percorsi/METODO_MOTORE_INTELLIGENTE.md`) — allineate le due serie di regole prendendo da ciascuna ciò che mancava. Stabilite **12 regole in 2 fasi**: **Fase A costruzione base (R1–R7)** = nutrizionista+strumenti (raccolta, catalogo per pasto [×stagione opz.], calorie interne, gruppi equivalenza, cotture, **bilanciamento giornata + porzioni standard/no-fame**, approvazione+isolamento per prodotto); **Fase B motore intelligente (R8–R12)** = **dove interviene l'AGENTE AI, unico per percorso** (R8 esclusioni con **blocca+escala** se non sostituibile; R9 partenza differenziata + **unicità certificata** seme/collision/registro firmato; R10 ciclo bigiornaliero + monitoraggio con **misure obblig., peso vs cm separati, seguito sì/no, gradimento default 5★ = max stelle**; R11 adattamento scoring efficacia×gradimento + **apprendimento che isola il pasto** + **stati** Conforto→Rientro/Pre-Post-evento/Plateau; R12 obiettivo dimagrimento/mantenimento + matrice segnalazioni + RBAC/kcal nascoste/cifratura/config_param). Mappa "dove agisce l'agente". **Audit unicità confermato e rafforzato**: ogni menu resta personalizzato e muta sui bisogni del cliente (parità piena Keto↔Mediterranea). Stato: da validare nutrizionista, no deploy. → impatto [Sviluppo]: standard del motore per ogni nuovo percorso, R8–R12 come componenti riusabili parametrizzati per product_id.

- `[Prodotto]` **Percorso KETO — Regola 10: menu di partenza differenziati per cliente** (`percorsi/keto/regola10_menu_partenza_differenziati.md`) — i menu di partenza sono **diversi per ogni cliente** anche a **pari percorso** e **stessa data d'inizio**: due clienti = due menu di partenza. Meccanismo: **seme personale** derivato da `client_id` che ordina/ruota in modo deterministico ma unico la sequenza pescata dalla **base personalizzata** (R7) → primo menu e ordine diversi per ciascuno. Restano garantiti keto, kcal target, ciclo bigiornaliero con 2 cotture (R6+R8); da lì prosegue l'adattamento (R9). Sequenza di partenza salvata nello storico personale. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: generare sequenza di partenza personale (ordinamento con seme da client_id) sulla base personalizzata, salvarla, l'Agente Adattamento prosegue da lì.

- `[Prodotto]` **Percorso KETO — Regola 9: Agente Adattamento (scelta menu successivo + apprendimento personale)** (`percorsi/keto/regola9_agente_adattamento.md`) — l'agente legge la tabella personale (esito misure + gradimento) e decide il menu del ciclo dopo: 📈 **preso peso** → ripropone il **menu che ha fatto perdere di più** al cliente (dal **ranking personale** per Δ peso; a parità, gradimento più alto); ➖ **invariato** / 📉 **sceso** → **nuovo menu** dalla base personalizzata (non recente, gradimento alto, cotture preferite). Logica exploit(sale)/explore(fermo o scende). Mantiene un **ranking menu per client_id** (Δ peso + ★) aggiornato ogni ciclo e registra decisione/motivo/esito nello **storico personale** cifrato. Limiti: aumenti ripetuti/plateau/cali anomali → **escalation nutrizionista**; l'agente non inventa menu né cambia kcal/grammature da solo. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Adattamento con regola di decisione, ranking menu personale, storico cifrato, escalation.

- `[Prodotto]` **Percorso KETO — Regola 8: Agente Monitoraggio (ciclo bigiornaliero)** (`percorsi/keto/regola8_agente_monitoraggio.md`) — man mano che il cliente prova i menu, l'agente registra nella **tabella personale**: **misure obbligatorie** (peso/cm → esito 📉 sceso / ➖ invariato / 📈 salito) e **gradimento piatti opzionale** (se assente → **default 5★**). Unità = **ciclo di 2 giorni** (i menu sono ogni 2 giorni): nei due giorni **stesso menu** con **due metodi di cottura diversi** (Regola 6, kcal invariate). Definiti schema tabella personale (ciclo, menu, cottura g1/g2, Δpeso, Δcm, esito, ★), regole ferme (misure chiudono il ciclo; gradimento mai penalizzante; l'agente solo registra, non adatta ancora), dati sanitari cifrati (accesso cliente+nutrizionista). È la materia prima per la personalizzazione dinamica successiva. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Monitoraggio con ciclo bigiornaliero, schermata misure obbligatoria + gradimento opzionale (default 5★), tabella personale cifrata per client_id, abbinamento menu↔2 cotture.

- `[Prodotto]` **Percorso KETO — Regola 7: Agente Esclusioni → base personalizzata (prima personalizzazione vera)** (`percorsi/keto/regola7_agente_esclusioni.md`) — come per la Mediterranea, un **agente AI** parte dalla copia della base approvata e **rimuove/sostituisce** ciò che il cliente non può/non vuole: **allergie** (blocco duro, incl. tracce/derivati), **intolleranze** (sostituzione con alternativa tollerata), **non graditi** (preferita sostituzione via gruppi di equivalenza Reg.4), **cultura/fede + veg/vegano**. Principio: prima sostituire (varietà), poi rimuovere; sempre **dentro la keto e a pari kcal**. Output = **base personalizzata** del cliente (isolata per `client_id`), punto di partenza delle regole successive. Casi limite (categoria svuotata, allergie gravi, veg+allergie) → **escalation al nutrizionista**, l'agente non inventa. Audit delle esclusioni. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: implementare l'Agente Esclusioni (filtra per tag alimento/allergene + gruppi equivalenza), output base personalizzata isolata, log, escalation sotto soglia.

- `[Prodotto]` **Percorso KETO — Regola 6: metodi di cottura → nuovi pasti** (`percorsi/keto/regola6_metodi_cottura.md`) — 1ª regola di personalizzazione: per ogni cibo **3–5 metodi di cottura** (forno, griglia/piastra, cartoccio, umido, vapore, padella, bassa temperatura, crudo/marinato…) che **conservano le kcal del piatto** (a parità di porzione e grasso aggiunto). Matrice metodi per gruppo (pesci grassi/bianchi, crostacei, pollame, carne rossa, uova, tofu, verdure, formaggi) + esempi generati (salmone CE08 ×5, pollo PR01 ×5, bistecca CE10 ×5, branzino PR03 ×5, uova COL02 ×5, gamberi CE13 ×4, tofu CE02 ×4). Regola calorica: **frittura/impanatura escluse** (aggiungono olio → piatto diverso). Effetto: *ingrediente × metodo* moltiplica il catalogo restando keto. Nella base personale il cliente sceglie il **metodo preferito / a rotazione**, senza ricalcolo. Stato: 🟡 da validare nutrizionista, no deploy. → impatto [Sviluppo]: attributo **metodo di cottura** sul modello piatto (varianti a stessa kcal) + filtro preferenza in personalizzazione.

- `[Prodotto]` **Percorso KETO — base APPROVATA dal nutrizionista → si apre la fase "personalizzazione"** — la base Keto (`base_keto_da_approvare.md`) è 🟢 **approvata**: da ora è **immutabile e condivisa** (ogni modifica futura ripassa dal nutrizionista con versione). Nuovo `percorsi/keto/personalizzazione_cliente.md`: cambia la natura delle regole — **fino a qui costruivano la base, d'ora in poi costruiscono la personalizzazione di ogni cliente**. Principio fissato: ogni cliente Keto riceve una **BASE PERSONALE = copia della base approvata**; le regole successive lavorano **solo su quella copia**, senza toccare la base ufficiale né mischiarsi con altri clienti/percorsi. Lo scaffold contiene lo schema (approvata→clona→personale→regole→menu), le dimensioni personalizzabili (grammature/fabbisogno, esclusioni allergie-intolleranze-non graditi, gusti/veg/fede, n° pasti, obiettivo, stato/gradimento) come placeholder, e una **tabella-registro** delle regole di personalizzazione. Stato: pronto a ricevere la 1ª regola, no deploy. → impatto [Sviluppo]: alla scelta "Keto", clonare la base approvata in una base personale del cliente; le regole seguenti operano solo su quella copia.

- `[Prodotto]` **Percorso KETO — base costruita col metodo validato (regole 1–5)** — cartella `percorsi/keto/`: (1) `raccolta_menu_web.md` raccolta menu keto da 5 fonti (~31 giornate/~130 pasti); (2) `catalogo_pasti.md` **118 piatti** deduplicati e **divisi per pasto** (colazioni/pranzi/cene/spuntini/merende); (3) `catalogo_pasti_calorie.md` stessi piatti **con kcal** (senza grammature); (4) `regola4_sostituzioni.md` **23 gruppi di equivalenza** (i 12 del nutrizionista + altri: pesci bianchi, crostacei, salumi, proteine veg, crucifere, basi finto-carbo, frutti keto, dolcificanti…) + ~32 varianti a calorie invariate + "Settimana B"; (5) `base_keto_da_approvare.md` **base isolata (solo Keto)** con workflow di **approvazione del nutrizionista** per categoria (sign-off) → dopo l'ok diventa il **pool per ogni cliente Keto**, mai mischiato con altri percorsi. Metodo riusabile identico per gli altri percorsi (Proteica, Low-carb, gravidanza, menopausa, sportivo, pre-matrimonio…), ciascuno con base separata. Stato: 🟡 in revisione nutrizionista, no deploy. → impatto [Sviluppo]: agganciare il pool al prodotto Keto (isolato); motore compone i giorni del cliente solo da qui + sostituzioni/esclusioni; versioning con approvazione.

- `[Prodotto]` **Marketing — archivio vignette catalogato per l'agente Publisher** — tutte le creative raccolte in **`marketing/vignette/`** con **catalogo machine-readable** `catalogo_vignette.json` (schema `metabole.vignette.catalog/v1`): 8 collezioni (persona: maria/menopausa/post-gravidanza/rientro/giornata storta; punti di forza: persone vere+AI, su misura; app: schermate reali) = **32 varianti/asset**, ognuna con messaggio, caption, hashtag, canale, stato, fonte (Canva `design_id`+preview o PNG) e **compliance/gate Giudice**; 6 voci `in_coda`. Più `README.md` (come lo usa il Publisher), `catalogo_canva.md`, le 3 gallerie HTML e `app-screens/` (5 screenshot reali). → impatto [Sviluppo]: il **Publisher** legge il catalogo, esporta il PNG dal design_id (o usa il PNG), passa dal Giudice, pubblica via API e logga. → in coda: gusto senza fame, sicurezza clinica, trasparenza, gravidanza pre/post, sposa.

- `[Prodotto]` **Marketing — vignette con schermate REALI dell'app** — catturate dal **prototipo ufficiale** via **Chromium headless** nel sandbox (aggirato il blocco `libXdamage` con uno **stub compilato**, asset via proxy allowlisted, navigazione simulata nel flow → app, popup chiusi). 5 screenshot reali in `marketing/app-screens/` (contatti, home, obiettivi, percorso, agenda). La **Contatti** mostra Gaia (assistente AI) + coach (Sara C.) + nutrizionista (Dott.ssa Marini), tutti LIVE. Nuova galleria `../Metabole_Vignette_App_Reali.html` (sostituisce la mockup ricostruita): 4 vignette 1080×1350 con le schermate vere + messaggi. Nota: alcune icone barre/foto CDN non caricate nel rendering headless (perfette in produzione o via Chrome connesso).

- `[Prodotto]` **Marketing — vignette punti di forza (Canva) + vignette app mockup** — sui **punti di forza** generate e archiviate **8 vignette** Canva: *Persone vere + AI* (4) e *Davvero su misura* (4), nella cartella `FAHPU5TzSCs` e nell'indice `../Metabole_Vignette_Archivio.md`. In coda (quota Canva giornaliera raggiunta): gusto senza fame, sicurezza clinica, trasparenza + temi gravidanza pre/post e sposa. Per le **schermate app** (Canva non riproduce la nostra UI/Gaia) creata composizione nostra `../Metabole_Vignette_App_Mockup.html`: 3 vignette 1080×1350 con telefono + schermata reale (Chi ti segue: Coach/Nutrizionista/Gaia; chat; menu "AI propone → nutrizionista valida") e **mascotte Gaia ufficiale**; avatar coach/nutrizionista stock da sostituire con volti reali.

- `[Prodotto]` **Marketing — vignette AI (Canva) persona-target + archivio** — svolta creativa: da concept astratti a **storie vere in prima persona per persona-target** (foto calde, dignità, no pressione estetica). Generati con **Canva** (connettore) 19 design Instagram: **Maria/matrimonio figlia** (3 approvati), **menopausa**, **post-gravidanza**, **rientro vacanze**, **giornata storta** (4 varianti l'una). Tutti esportati in PNG e archiviati nella **cartella Canva** `https://www.canva.com/folder/FAHPU5TzSCs`. Indice riusabile in `../Metabole_Vignette_Archivio.md` (messaggi, caption, hashtag, link modifica/anteprima per riesportare). Compliance: prima persona per occasione/emozione (non "entra nel vestito"), 18+, dal Giudice. → nota: Gaia non la disegna Canva (mascotte inventata) → si aggiunge come asset reale o si compone a parte.

- `[Prodotto]` **Marketing — vignette "grafica reale" (foto + tipografia)** — nuova versione `../Metabole_Vignette_Social_Foto.html`: 10 card 1080×1080 con **foto vere** (Unsplash, sostituibili con scatti nostri) + overlay/tipografia brand, per i post del Lotto 1; testimonianza come quote card (nessun volto reale senza consenso), conformi (no prima/dopo, no numeri, 18+). Affianca la versione illustrata SVG. → Nota: per illustrazioni AI su misura serve un connettore image-generation (da valutare).

- `[Prodotto]` **Marketing — vignette social (Lotto 1) + strategia rientro/nurture** — nuova galleria `../Metabole_Vignette_Social.html`: **12 vignette SVG** (1080×1080, palette brand, mascotte Gaia) dai 10 post del Lotto 1 (cassetto diete ×2, quote "Non una dieta" ×2, caroselli fame/porzioni, reel dietro-le-quinte/assaggio, giornata storta, menopausa, mangi fuori, testimonianza) con caption+hashtag pronti; conformi (no prima/dopo, no numeri, 18+), firme generiche "responsabile scientifico" (no nome Russolillo, come deciso). SVG validati. Nuovo doc `../Metabole_Strategia_Rientro_Nurture.md`: strategia **win-back 20.000 clienti** + **nurture 80.000 lead** — base giuridica LPD/GDPR (re-permission lead, soft opt-in clienti, SPF/DKIM), segmentazione, offerta, canali (email Brevo/SMS/retargeting social con le vignette/WhatsApp), **sequenze A (rientro) e B (nurture)**, aggancio agli stati CRM/agente, KPI, ordine operativo. → impatto [Sviluppo]/[Marketing]: sequenze email in Brevo agganciate agli stati; igiene liste/consensi.

- `[Prodotto]` **Go-live — smoke test (script + piano) + sonda live** — nuovo `scripts/metabole_smoke.sh` (health/plans/products/payment-methods/POST public-leads/endpoint protetto) e `../Metabole_Smoke_Test.md` (piano manuale B1–B7: account+email, onboarding, pagamento Stripe, motore menu, backoffice, sito, sicurezza). **Sonda live 14/7**: backend **up** (`/health` ok, DB up, v0.1.0), `/plans` 3 piani reali, `/payment-methods` card+bonifico ok; `POST /public/leads` non ancora attivo (blocker #1, in carico a Simone). Verifica dei 2 blocker di codice (endpoint lead + fix sicurezza scoping) pianificata via task per il 15/7.

- `[Prodotto]` **Go-live rosso #1 — lead-capture (form sito in sicurezza + handoff endpoint)** — i form `leadForm` (sito) e `jobForm` (Lavora) ora mostrano "Grazie" **solo su risposta 2xx reale**; aggiunti **honeypot** antispam, **messaggio d'errore con fallback `info@metabole.eu`** (tradotto in 9 lingue) così **nessun lead va perso**, e `data-endpoint` collegato a `/api/v1/public/leads`. Nuovo **handoff [Sviluppo]** `../Metabole_Lead_Endpoint_Handoff.md` con **codice pronto**: `PublicLeadDto`, `CrmService.createPublic()` (riusa `CrmRecord`, metadati in `stageDates` → **nessuna migrazione**), `PublicLeadController` (`@Public` + `@Throttle` 5/min + honeypot), registrazione nel `CommerceModule`, note **CORS** (aggiungere dominio sito) e captcha Turnstile opzionale. → **impatto [Sviluppo]:** applicare l'endpoint (2 file nuovi + 1 metodo + 1 riga modulo) e aggiungere l'origine sito a `CORS_ORIGINS`.

- `[Prodotto]` **Verifica pronto-al-lancio + checklist go-live** — revisione dell'intero repo (backend/app/backoffice/sito/legali/deploy). Esito: codice molto avanzato; **blocker** = (1) endpoint pubblico "crea lead" + collegare i form del sito (oggi lead/candidature persi), (2) fix sicurezza scoping `/engine/decisions/:id/confirm|correct` per-paziente, (3) config prod (Stripe LIVE+webhook, Neon URL, Brevo+SPF/DKIM, FCM push, ADMIN/CORS/VITE_API_URL). Nuovo file **`../Metabole_Checklist_GoLive.md`** (spuntabile, con responsabili [Sv]/[Pr]/[Ops]): blocker, config, smoke test, contenuti, e "subito dopo" (endpoint dinamici sito, app coach/nutrizionista dedicate, marketing/Giudice, agenti, blog, social, prodotti dinamici, stagionali, certificazione unicità). → impatto [Sviluppo]: chiudere i blocker prima del go-live.

- `[Prodotto]` **Marketing — testimonianze sul sito + pubblicazione social (spec)** — la sezione **Storie** del sito ora è **dinamica** (`data-testimonials-endpoint`, con fallback alle 3 storie statiche): ogni testimonianza **approvata** nel marketing **compare automaticamente sul sito** oltre a essere usata nei contenuti. Nuovo doc `../Metabole_Testimonianze_Social_Publishing.md`: entità **`Testimonial`** + flusso (raccolta → **Giudice**/consenso → approvazione responsabile marketing → pubblica su sito + marketing); e **Publisher via API** per i social — **Facebook Pagina + Instagram** (Meta Graph / Instagram Content Publishing API: account Business, Pagina collegata, IG professionale, app Meta, permessi `instagram_content_publish`, **App Review** 2–4 sett., pubblicazione in 2 passi), **TikTok** (Content Posting API: App Review, upload a chunk, token 24h, limiti/giorno, no scheduling nativo), + canali **consigliati** (LinkedIn, YouTube, Threads, Pinterest, Google Business, WhatsApp/Telegram). Entità `SocialAccount`/`SocialPost`, adapter per canale, guardrail (Giudice, rate limit, token refresh, audit, segreti su Render). → **impatto [Sviluppo]:** entità Testimonial + endpoint (sito già pronto), Publisher + adapter social, gestione OAuth/token. NB: collegare account e App Review sono **azioni dell'utente/business** (l'AI non fa login/OAuth).

## 2026-07-13


- `[Prodotto]` **Pagine legali multilingua (nota IT vincolante) — complete** — **Cookie**, **Termini** e **Privacy** tradotti **completi in tutte e 9 le lingue** (IT/EN/ES/PT/FR/DE/RU/ZH/AR) con selettore lingua, RTL per l'arabo e nota "traduzione di cortesia, **versione italiana legalmente vincolante**". Privacy verificata: 83 chiavi × 9 lingue tutte presenti. Autorità di controllo localizzata per lingua (IFPDT/FDPIC/EDÖB/PFPDT…), basi legali LPD/nLPD + GDPR. Tutte con hook `data-i18n-endpoint` (traduzioni anche dal DB).

- `[Prodotto]` **Sito — Blog nel menu, box "metodi gestiti", pagine tradotte, spec agenti** — header: aggiunti **Blog** e **Percorsi/Lavora** nel menu in alto; nuovo **4° contatore "metodi gestiti"** nella banda statistiche (dinamico, = n° percorsi, da `data-stats-endpoint`/`data-paths-endpoint`). **Pagine tradotte nelle 9 lingue** con selettore + hook DB: **Blog** (27 chiavi) e **Lavora** (45, incluse opzioni form e placeholder) complete; **Cookie** tradotto con **nota "versione italiana vincolante"** (traduzione di cortesia). → **restano da tradurre Termini e Privacy** (stesso schema + nota IT vincolante). Nuovo doc **`../Metabole_Agenti_AI_Spec_Sviluppo.md`** per lo Sviluppo: entità `Agent`/`AgentRun`/`AgentLog`, orchestrazione, endpoint `/agents`, mapping motore Claude, budget/guardrail, integrazione Giudice/RBAC, seed dei 13 agenti. → impatto [Sviluppo]: implementare pagina backoffice Agenti + runtime; traduzioni/contatori dal DB.

- `[Prodotto]` **Dashboard — nuova sezione "Agenti" (tutti Claude)** — deciso: **standard su agenti Claude** (niente mix di fornitori). Prototipo `../Metabole_Dashboard_Agenti.html`: sezione dashboard che mostra **ogni agente** con **nome · dove lavora · cosa fa · regola · motore** (Haiku 4.5 / Sonnet 5 / Opus 4.8; ElevenLabs per la voce; motore dieta deterministico). 13 agenti su 5 reparti (App/Marketing/Comunicazione/CRM/Sistema), filtro per reparto, e **form "Nuovo agente"** (nome, tipo, dove applicarlo, motore, cosa fa, regola) che aggiunge una card. Mappatura motore→compito valutata per criticità/volume. → **impatto [Sviluppo]:** pagina backoffice `Agenti` + entità `Agent` (name, dept, type, engine, task, rule, enabled) + registrazione/instradamento reale degli agenti; il motore LLM diventa Claude.

- `[Prodotto]` **Sito v4 + Comunicazione/blog + analisi costi agenti** — sito: **mascotte Gaia vera** (SVG dal widget, occhi che sbattono) nell'orbita e nel telefono; **badge App Store + Google Play**; **icona Kosher** sostituita (stella di Davide SVG, mancava in Tabler); **blog** e **lavora con noi** ora **pagine dedicate**, in home solo **articolo in evidenza** e **richiamo**; nuovo box **"Percorsi alimentari"** con i percorsi dell'app (Mediterranea/Proteica/Low-carb/Keto), caricabile da endpoint; **contatori dinamici**: "persone raggiunte" +1 a ogni **lead**, "clienti" +1 a ogni **acquisto piano** (letti dal DB via `data-stats-endpoint`, +1 ottimistico sul form). Nuovo doc **`../Metabole_Comunicazione_Blog_Agente.md`**: sotto-reparto **Comunicazione** nel Marketing con **agente Redattore** (RAG su fonti nutrizione → bozza → **Giudice** → **approvazione responsabile marketing** → **1 articolo/giorno** pubblicato sul blog; entità `Article`, endpoint, cron, escalation claim salute al nutrizionista capo). Nuovo doc **`../Metabole_Agenti_AI_Motori_Costi.md`**: inventario agenti (LLM specializzati con umano-nel-ciclo), motore consigliato (Haiku 4.5 default / Sonnet 5 / Opus raro + ElevenLabs voce + modello immagini) e **stima costi** (~$0,30–0,80 per cliente/mese; ~$360–1.000/mese in avvio, ~$3–8k a 10.000 clienti; marketing/blog quasi trascurabili). → **impatto [Sviluppo]:** endpoint `data-stats-endpoint` (contatori reali: +1 lead / +1 acquisto), `data-paths-endpoint` (percorsi app), `data-blog-endpoint` + entità `Article` + cron pubblicazione 1/giorno; fissare il **motore LLM** nel codice.

- `[Prodotto]` **Sito — revisione grafica + app + mascotte Gaia + blog + lavora + 9 lingue** — `../Metabole_Sito_Presentazione.html` rivisto a fondo: nuova sezione **"Come funziona l'app"** (il cliente inserisce misure e gradimento → l'**AI** registra e propone → il **nutrizionista** valida) con mockup del telefono; **mascotte Gaia** disegnata in SVG (usata nella ruota e nel telefono); nella **ruota hero** ora le linee figura→cliente **si accendono in sequenza** al passaggio di Gaia (come se attivasse l'azione, direzione dalla figura al cliente); **"AI" pulsa sempre** con i colori dell'intelligenza ovunque compaia Metabole**AI**; grafica più viva e **arcobaleno della multinazionalità** (sezione "Per ogni cultura" ora chiara con barra rainbow e icone colorate; tolto il fondo scuro/nero); **blocchi più vicini e con contorni** definiti; **nome Russolillo rimosso** (nome + CV alla pubblicazione). Aggiunte **2 lingue**: **spagnolo e portoghese** (ora IT/EN/ES/PT/FR/DE/RU/ZH/AR = 9). Nuove pagine **`../Metabole_Lavora.html`** ("Sei nutrizionista/coach? Vuoi diventare tutor della nutrizione?" + form candidatura) e **`../Metabole_Blog.html`** (indice articoli). Verificato: JS ok, 146 chiavi × 9 lingue complete, 14 sezioni bilanciate. → **impatto [Sviluppo]:** (1) **le lingue devono vivere nel DB** — predisposto hook `loadRemoteI18N` + attributo `data-i18n-endpoint` sul `<body>`: quando l'endpoint restituisce `{lingua:{chiave:valore}}` sovrascrive le locali (serve endpoint tipo `GET /api/v1/i18n/site`); (2) endpoint **"crea lead"** e **"candidatura lavora con noi"** (`fonte:'lavora_con_noi'`); (3) deploy Vercel/sottodominio. → da confermare: revisione madrelingua ES/PT/RU/ZH/AR; nomi/CV team; contenuti reali del blog.

- `[Sviluppo]` **Prodotti dinamici — Fase A+B (fondazione backend)** — deciso (con Simone) di NON creare una nuova tabella (il nome `Product` è già gli integratori): si **estende `Diet`**, che già possiede i menu isolati per `diet_id`. Aggiunti a `Diet` i campi cliente (`clientName`, `clientDescription`, `highlights`, `seasonalTag`, `objective`, `clientVisible`) + nuovo stile **`keto`** nell'enum `DietStyle`. Due migrazioni additive **validate su Postgres 16 locale** (ADD VALUE enum + ADD COLUMN). Seed idempotente `seedDietProductFields` (campi prodotto su Mediterranea/Proteica/Low-carb + crea **Keto** a menu vuoti). Endpoint **`GET /onboarding/diet-products`** (zero-redeploy, letto a runtime). **Nessun cambiamento visibile nell'app ancora** (è la fondazione; lo schermo 16 dinamico è la Fase C). Piano completo in `../Metabole_Prodotti_Dinamici_Piano_Sviluppo.md`. NB: type-check reale del backend su Render (il campo nuovo non è nel client Prisma locale).

- `[Prodotto]` **Sito — multilingua (7 lingue) + cookie + statistiche + esigenze culturali + pagine legali** — sito rifatto grafico con **animazione "tu al centro"** (Gaia organizza menu/coach/nutrizionista/eventi/imprevisti) e foto reali; ora in **IT/EN/FR/DE/RU/ZH/AR** (selettore lingua, arabo RTL, scelta persistente); **banner cookie** accetta/rifiuta → Cookie Policy; **statistiche** (20+ anni, 20.000+ clienti, 80.000+ persone) con **nota prodotti** (Nutriamo, MetaboleAI · Mosaico Experiences SA); sezione **"Per ogni cultura"** (halal — no maiale/crostacei, kosher/altre fedi, veg/vegan, allergie). Nuove pagine `../Metabole_Cookie.html` e `../Metabole_Termini.html`; privacy/cookie/termini su **base svizzera (LPD)** + GDPR per UE, foro di Lugano; tolto avviso "da validare" (validato dal consulente). → da confermare: numeri, elenco prodotti, foto/nomi team, `info@metabole.eu`; revisione madrelingua RU/ZH/AR. → impatto [Sviluppo]: endpoint "crea lead"; deploy Vercel/sottodominio.
- `[Sviluppo]` **Attivazione — schermo 27 "Il tuo percorso è pronto" + stato checklist 1:1** — allineato lo schermo 27 (PlanFlow) al prototipo: bolla di Gaia col **testo esatto** e i nomi **reali** di coach e nutrizionista (dal team assegnato). Prodotta la mappa `../Metabole_Checklist_Allineamento_STATO.md` con lo stato ✅/🟡/⬜ di tutte le 34 schermate onboarding + dashboard. **Onboarding replicato 1:1** tranne: schermo 16 (prodotti dinamici/Keto), video coach/nutrizionista (28–29), rifiniture assaggio menu (30) e widget tutto pronto (34). Type-check e build ok.

- `[Sviluppo]` **Onboarding — aggiunto schermo 6 "Perché vuoi iniziare adesso?"** — prima domanda della sezione Mente, con le 4 opzioni esatte del prototipo (Sentirmi bene con me stessa · Rientrare nei miei vestiti · Salute ed energia · Un evento importante) e il testo di Gaia. La risposta si salva in `lifestyle.motivation` (campo JSON già esistente → **nessuna migrazione**); aggiunto `motivation` al `LifestyleDto`. Con questo l'ordine delle domande Mente è completo (Perché → Come seguita → Carattere). Type-check app + questions ok.

- `[Sviluppo]` **Onboarding — testi delle domande allineati verbatim al prototipo** — titoli e testo scritto di Gaia (subtitle) di **tutte** le domande copiati esatti dal prototipo: es. identità → "Come vuoi essere chiamata?", carattere → "Quale caratteristica ti contraddistingue quando prendi un impegno?", e i testi lunghi di Gaia per obiettivo, salute, intolleranze, coach, ecc. Aggiornata anche la **palette colori app** (schermo 24) ai 6 colori della direttiva (#F2B807/#E23B3B/#E86FA6/#2F80ED/#12A386/#F2820A). Backend `onboarding.questions.ts` (servito a runtime, nessuna migrazione). **Rimandati** (filone prodotti dinamici): schermo 16 "Stile che preferisci" (Keto + prodotti dall'API) e l'aggiunta della domanda "Perché vuoi iniziare adesso?" (nuovo campo). Type-check del file ok.

- `[Sviluppo]` **App cliente — allineamento 1:1 onboarding (colori sezioni + schermo 25 GDPR)** — seguendo la Direttiva Replica 1:1: le **5 sezioni** hanno ora ordine, nomi, tab e **colori esatti** del prototipo (Mente `#6C4CD6` · Vita `#2F80ED` · Agenda `#E8543C` · Gusto `#E8A11B` · Corpo `#12A386`, con sfondi tenui) e l'ordine corretto **Mente→Vita→Agenda→Gusto→Corpo** (prima il Corpo era in testa). Lo schermo **25 "Trattamento dei dati personali"** ora ha la bolla di Gaia col testo esatto ("Manca solo la tua approvazione…") e pulsante "Accetta e procedi". Verificato che i campi **Età, Altezza, Sesso** (schermo 19) e **Peso/Vita/Fianchi** (schermo 20) erano già definiti a backend e mostrati. Type-check e build ok.
- `[Prodotto]` **Marketing — primo lotto social (vignette + testi)** — `../Metabole_Social_Lotto1.md/.pdf`: 10 post pronti (vignette empatiche, caroselli educativi firmati **dott. Salvatore Russolillo** — capo nutrizionista/tecnologo/coach/psicologo — Reel prodotto, quote, testimonianza) con concept, testi sull'immagine, caption, hashtag e prompt immagine; mini-calendario 2 settimane. Tutti conformi (no prima/dopo, no numeri/garanzie, 18+), passano dal Giudice. Contesto operativo: legale (privacy/cookie) pronto da avvocato; team pronto (Russolillo + 8 coach + 1 supervisore); go-live quasi completo (restano verifiche Stripe LIVE/Brevo/DPA + contenuti menu altre diete + profili coach/nutrizionista in-app).
- `[Prodotto]` **Sito — Informativa privacy** — aggiunta `../Metabole_Privacy.html` (adattata dalla policy Mosaico Experiences SA / nutriamo.ch): Titolare Mosaico Experiences SA (Lugano), email `info@metabole.eu`, servizi tarati sul sito reale (modulo contatti, Google Fonts, log hosting) al posto di quelli WordPress; rimossi riferimenti obsoleti (Privacy Shield). Collegata dal footer e dal consenso del form. Nota: riguarda il **sito**; l'app ha l'informativa dedicata del legale. Testo da validare col consulente privacy.
- `[Prodotto]` **Sito di presentazione — v3 grafico + animazione "tu al centro"** — `../Metabole_Sito_Presentazione.html` rifatto come sito vero, non landing: **animazione orbitale nell'hero** (cliente al centro, Gaia che ruota e connette Menu/Coach/Nutrizionista/Eventi/Imprevisti), **foto reali** (Unsplash con fallback Picsum sicuro), tipografia editoriale (Fraunces+Inter), sezioni ricche (concept, banda foto, team con Russolillo + coach, "un giorno con te", storie con volti, FAQ, CTA immersiva). Tono meno commerciale, più umano. Restano CTA app + form lead (`data-endpoint` da collegare). → da fornire foto reali del team; deploy Vercel/sottodominio.
- `[Prodotto]` **Sito di presentazione — v2 più umano/reale** — `../Metabole_Sito_Presentazione.html` riscritto con meno tono "markettaro" e le **persone** al centro: sezione **team reale** (dott. Salvatore Russolillo responsabile scientifico + le 8 coach e supervisora), **spazi per foto vere** (hero, team, piatti, testimonianze) con etichette che descrivono la foto da inserire, tono caldo. Restano CTA → app.metabole.eu + form lead (`data-endpoint` da collegare al CRM). Compliance ok (no prima/dopo, no numeri/garanzie, 18+). → impatto [Sviluppo]: endpoint pubblico "crea lead"; deploy Vercel/sottodominio. → da fornire: foto reali + nomi coach + ritratto Russolillo.
- `[Prodotto]` **App cliente — pag.16: "Flessibile" → "Keto"** — nella lista prodotti (array `PLANS`) del prototipo (e `docs/`) sostituito il piano *Flessibile* con **Keto** (caratteristiche: pochi carboidrati, grassi buoni, sotto controllo del nutrizionista). Sintassi verificata. *(Nota: elenco demo; in produzione i prodotti arrivano dall'API.)*
- `[Prodotto]` **Checklist allineamento web app ↔ prototipo** — `../Metabole_Checklist_Allineamento.md/.pdf`: 34 schermate onboarding + dashboard + popup, ognuna con casella da spuntare; a supporto della direttiva di replica 1:1.
- `[Prodotto]` **DIRETTIVA per lo Sviluppo — replica 1:1 del prototipo nella web app** — deciso: il prototipo `docs/Metabole_Prototipo_Navigabile.html` è la **versione finale** dell'app cliente; la web app va allineata **1:1** (sezioni Mente/Vita/Agenda/Gusto/Corpo + colori, contenuti, pagine e ordine, testi di Gaia scritti e parlati, dashboard, popup, navigazione). **Unica eccezione: il pagamento Stripe reale** resta quello della web app. Doc `../Metabole_Direttiva_Replica_Prototipo.md/.pdf` con valori esatti (colori sezioni, palette, ordine 34 schermate) + **prompt pronto** da incollare all'AI di Simone. → impatto [Sviluppo]: allineare la web app schermata per schermata al prototipo.
- `[Prodotto]` **App cliente/Onboarding — campi anagrafici + schermata privacy** — nel prototipo (e `docs/`): pag.19 "Come vuoi essere chiamata?" ora mostra **sempre Età + Sesso (Uomo/Donna)** sotto il Nome (prima erano nascosti finché non scrivevi il nome); pag.20 "Il tuo punto di partenza" ha in più il campo **Altezza (cm)**; **nuova schermata "Trattamento dei dati personali"** (GDPR + consenso) inserita **dopo pag.24 (colore)**, con voce di Gaia: *"Manca solo la tua approvazione al trattamento dei dati personali e potrò costruire il tuo percorso personalizzato di MetaboleAI. Clicca su accetta e procedo."* Flusso **35 passi** (conteggio dinamico); verificato a runtime con jsdom. → **voce da rigenerare** (solo `privacy`, testo cambiato): `FORCE=1 ONLY="privacy"`. → impatto [Sviluppo]: replicare campi e schermata consenso nell'app React.
- `[Prodotto]` **Prodotto/Motore — Gestione eventi programmabili** — nuovo `../Metabole_Gestione_Eventi.md/.pdf`: sezione dashboard per programmare gli eventi (matrimonio, vacanze, sgarro, +altri) a fasi Prima/Il giorno/Dopo, con leve configurabili (modalità menu dimagrimento/mantenimento/nessun menu, messaggio Home, integratori prescritti dal nutrizionista non selezionabili, politica misure con/senza blocco, spegnimento consigli, coach più attiva + soglie Δkg/Δcm). Template configurabili da nutrizionista/admin, istanza da agenda cliente; riusa stati agente pre/post_evento e le fasi agenda esistenti; data-driven (zero-redeploy). → impatto [Sviluppo]: entità EventType/EventPhase/ClientEvent/EventSupplementPlan; hook motore fase-attiva; regole alert event-driven.

- `[Prodotto]` **Prototipo — pagina 16 cablata: caratteristiche al tocco** — nel prototipo (e `docs/`) la pagina 16 ora rende i piani da un array `PLANS` (come dall'API) e, al tocco sul nome, apre il pannello **Caratteristiche principali** (un solo pannello per volta, riusa `data-show`/`data-panel`). Verificato a runtime con jsdom (4 piani, apertura/chiusura ok, scelta salvata in `state.plan`). Voce generica invariata. → riferimento visivo per lo Sviluppo dell'app.

- `[Sviluppo]` **Notifiche — campanella in-app collegata al server + preferenze + guida push** — la
  **campanella** nell'header ora mostra le notifiche reali (`GET /me/notifications`): titolo/testo dal
  `payload`, icona per tipo, ora relativa ("5 min fa"), **badge** con le non-lette, tap = segna-letta
  (`PATCH /me/notifications/:id/read`) e "Segna lette" per tutte. In **Profilo** nuova sezione
  **Notifiche**: interruttore "anche via email" + on/off per ogni tipo (`GET/PATCH
  /me/notifications/prefs`); le notifiche di sicurezza e del team restano sempre attive. Type-check e build
  ok. Per il **push sul telefono** (passo successivo scelto: "prima in-app, poi push") ho scritto la guida
  `../Metabole_Notifiche_Push_Setup.md`: Simone crea il progetto **Firebase** (package `app.metabole.client`)
  e passa `google-services.json` + service account (su Render), poi collego app (`@capacitor/push-notifications`)
  e server (modello `PushToken` + invio FCM dentro `notifyOncePerDay`, rispettando le preferenze).
- `[Sviluppo]` **App cliente — Agenda rifatta come nel prototipo** — la schermata Agenda ora segue il
  prototipo: **"Prossimi appuntamenti"** (reali da `GET /me/agenda`: ora/data, coach o nutrizionista, tipo,
  tag "Con la coach"/"Col nutrizionista"), **"Prenota un appuntamento"** (foglio: la prenotazione diretta
  arriva presto → intanto "Chiedi a Gaia"), **"Il tuo piano"** (da `GET /me/subscription`: nome piano,
  "scade tra N gg", **Rinnova** → Shop). Sotto restano i **giorni no-diet** (aggiungi/rimuovi + piano
  prima/durante/dopo) così non si perde la funzione. Type-check e build ok.
- `[Sviluppo]` **App cliente — header comune anche su Menu, Assistente e Profilo** — uniformato l'header
  teal `AppHeader` (MetaboleAI + titolo + notifiche/da-completare/shop/profilo) sulle ultime schermate che
  restavano con la vecchia intestazione: **Menu** ("Il tuo menu"), **Assistente** ("Gaia") e **Profilo**
  ("Profilo", con sotto il blocco avatar/nome). Ora **tutte** le schermate dell'app hanno lo stesso header
  del prototipo. Type-check e build ok. Allineato il workspace alla pull del socio (registro/stato) prima
  di procedere. **Nota:** la decisione navigazione risulta CONFERMATA dal socio (stessa del prototipo),
  quindi il lavoro precedente è validato. Prossimo grande filone [Sviluppo] dalla pull: **prodotti
  dinamici / zero-redeploy** (entità `Product`, wizard backoffice, agente per prodotto, **pagina 16**
  dell'onboarding che legge i prodotti dall'API con voce di Gaia generica) — da pianificare, tocca
  backend + backoffice + app.
- `[Prodotto]` **Prodotto — campo "Caratteristiche principali" del prodotto** — ogni prodotto porta `client_description` + `highlights` (3–5 punti), inseriti nel wizard (step Anagrafica) e **mostrati al cliente** al tocco sul nome del piano a pagina 16. Aggiornati spec sviluppo (modello dati/wizard/pag.16), catalogo (B1) e mockup wizard. Coerente con la voce generica di Gaia. → impatto [Sviluppo]: campi `Product.client_description`/`highlights` + vista dettaglio al tap.
- `[Prodotto]` **Voce/Prodotto — pagina 16 voce generica (zero-redeploy audio)** — la voce di Gaia a pag.16 non elenca più le diete: da "…mediterranea, proteica, low-carb…" a **"Scegli il piano più adatto alle tue esigenze: tocca il nome di un piano per scoprirne le caratteristiche principali."** (prototipo + `docs/` + `tools/genera_voci_gaia.mjs`, chiave `q_stile_che_preferisci`). I nomi prodotti restano solo testo a schermo (dinamici) e sono toccabili per aprire la descrizione. → **voce da rigenerare SOLO quella chiave**: `ONLY=q_stile_che_preferisci` (mai FORCE su tutte). Regola aggiunta in Spec_Prodotti_Dinamici §0.
- `[Prodotto]` **Sviluppo(req) — ZERO-REDEPLOY per i prodotti** — aggiunto requisito in `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md` §0: creare/modificare un prodotto NON deve mai richiedere ripubblicazione app (web/nativa) né deploy backend. Il client legge i prodotti dall'API a runtime; menu/regole sono dato. → impatto [Sviluppo]: pagina 16 e motore data-driven; niente liste hardcodate.
- `[Prodotto]` **Prodotto — Schede regole (microcopy wizard) + mockup wizard "Crea nuovo prodotto"** — `../Metabole_Schede_Regole_Wizard.md/.pdf` (testo semplice regola-per-regola con domanda di consenso, come lo legge il nutrizionista) e `../Metabole_Wizard_Crea_Prodotto.html` (mockup dei 5 passi: anagrafica → menu → regole → proposta → attivazione con agente dedicato). Riferimenti per lo Sviluppo del wizard.
- `[Prodotto]` **DECISIONI — navigazione app + nome prodotto** — (1) **Navigazione app cliente DECISA**: si adotta quella del prototipo *Home · Percorso · Obiettivi · Contatti · Agenda* (Shop in header); la versione *Menu · Obiettivo · Home · AI · Agenda* è la vecchia, **da sostituire**. → impatto [Sviluppo]: creare Percorso e Contatti, spostare Menu nella Home, trasformare AI in Contatti. (2) **Nome 2° protocollo estate confermato: "Ritorno in Equilibrio"**.
- `[Prodotto]` **Sviluppo(handover)/Motore — Spec prodotti dinamici + obiettivo mantenimento** — nuovo `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md/.pdf`: modello dati (`Product`, `Menu(product_id)`, `Recipe`, `ProductRule`, `RuleProposal`), wizard backoffice, API bozza, agente per prodotto, pagina 16 dinamica, vincoli (isolamento S1 enforced a DB). Aggiunto obiettivo prodotto **dimagrimento/mantenimento** in `../Metabole_Motore_Personalizzazione.md` §0ter. → impatto [Sviluppo]: è la spec da implementare per "Crea nuovo prodotto".
- `[Prodotto]` **Motore/Prodotto — Catalogo regole motore + wizard "Crea nuovo prodotto"** — nuovo `../Metabole_Regole_Motore_Catalogo.md/.pdf`: tutte le regole del motore numerate e classificate (🔒 sicurezza sempre attive · ⚙️ opzionali con consenso), + spec della sezione dashboard "Crea nuovo prodotto" (nome + menu propri colazione/pranzo/cena + snack, consenso regola-per-regola, proponi nuova regola, un agente AI per prodotto). I due protocolli estate = due prodotti creati così; si scelgono a pag.16. → impatto [Sviluppo]: entità `Product` + `Menu(product_id)` + `ProductRule`; wizard backoffice; agente per prodotto; pag.16 legge i Product attivi.
- `[Prodotto]` **Prodotto — Testi di Gaia & template Coach (protocolli estate)** — copioni pronti (`../Metabole_Testi_Gaia_Coach_Estate.md/.pdf`) per Vacanze in Serenità e Ritorno in Equilibrio: Gaia (attivazione, valigia, quotidiano, gestione strappo, check-in soft, rientro) e Coach (buona partenza, bentornato, call). Tono "equilibrio senza colpa", nessun menu, nessuna promessa. → per lo Sviluppo/voce: nuove chiavi audio suggerite `estate_vac_*` / `estate_rit_*`.
- `[Prodotto]` **Motore/Prodotto — REGOLA: isolamento dei menu per prodotto (BLOCCO)** — ogni prodotto/protocollo ha il PROPRIO catalogo di menu; **mai** mischiare menu tra prodotti diversi, nemmeno per riferimento; a parità di piatti si **duplicano, non si condividono**; i menu li fornisce il nutrizionista, l'AI non li inventa né prende in prestito. Aggiunta in `../Metabole_Motore_Personalizzazione.md` (§0) e in `../Metabole_Piani_Estate` (§0). → impatto [Sviluppo]: menu legati a `product_id`, nessun riferimento/join tra cataloghi di prodotti diversi. I due protocolli estate hanno cataloghi propri, **vuoti** finché il nutrizionista non li popola. Fissata anche come **regola ferrea** in `STATO.md`.
- `[Prodotto]` **Prodotto — Piani d'estate (luglio): Vacanze in Serenità & Ritorno in Equilibrio** — spec dei due percorsi stagionali (`../Metabole_Piani_Estate.md/.pdf`): mantenimento in vacanza (menu freddi/portabili, bussola-ristorante, misure non bloccanti) e ripartenza dolce al rientro (reset 1ª settimana → ritmo 2ª). Costruiti sui mattoni esistenti (stati agente, catalogo estivo, segnali). **Scope**: sono modalità sopra la dieta scelta; menu concreti oggi solo per la **Mediterranea** (unico catalogo reale), altri regimi = logica ma catalogo da costruire. → impatto [Sviluppo]: segnale `travel_mode` (date) che accende mantenimento/rientro; sospendere popup misure in vacanza; evento `rientrato` al CRM. Aggiunto anche `../Metabole_Macchina_Marketing_Schema.svg` (schema visivo della macchina).
- `[Prodotto]` **Marketing — Macchina di marketing completa (8 agenti + Giudice) + integrazione** — aggiunti `../Metabole_Macchina_Marketing_AI`, `../Metabole_Agente_Contesto_Tempismo`, `../Metabole_Libreria_Creativa`, `../Metabole_Specifica_Giudice_Compliance` (.md/.pdf) e `progetto/INTEGRAZIONE_MARKETING.md`. La macchina: Contesto&Tempismo → Stratega → Creativo/Copy → **Giudice** (compliance, blocca prima di pubblicare) → Publisher → Lead → Analista. → impatto [Sviluppo]: implementare il Giudice (ruleset in `config_param` + audit) e gli endpoint agenti (lead/pubblicazione/consensi).
- `[Sviluppo]` **App cliente — navigazione allineata al prototipo navigabile (docs/)** — rifatta la struttura dell'app "dentro" seguendo **schermata per schermata** il prototipo in `docs/Metabole_Prototipo_Navigabile.html` (fotografato in headless per copiarlo fedele). Novità: **header comune `AppHeader`** (barra teal ad angoli arrotondati con "METABOLEAI" + titolo + 4 icone: notifiche, da completare, shop, profilo) su tutte le schermate principali; **tab bar** riordinata a **Home · Percorso · Obiettivi · Contatti · Agenda** (solo icone, quella attiva in un quadrato teal rialzato, come nel prototipo). **Home** semplificata al prototipo: "IL MENU DI OGGI" (carosello pasti + Spesa), "PROSSIMO APPUNTAMENTO", card "GAIA · LA FRASE DI OGGI" — dati reali dal backend. Due **nuove pagine**: **Percorso** ("IL MENU DI OGGI" + "Diario del percorso" con schede *Menu passati* / *Eventi*) e **Contatti** (team Gaia · coach · nutrizionista con stato LIVE e "Conversazioni passate", nota privacy) — nomi reali dal profilo. **Accedi** rifatto come **foglio che sale dal basso** sopra la Landing ("Bentornata", Email o username, Password, Entra, Password dimenticata?), identico allo screenshot. Aggiunti header teal a **Obiettivi** ("I tuoi obiettivi"), **Agenda**, **Shop**. Rotte nuove `/percorso`, `/contatti`, `/shop`. Type-check e build di produzione **ok**; verifica visiva delle schermate fatta in headless (combaciano col prototipo). Note oneste su cosa NON è (ancora) allineato: **Menu, Assistente (chat Gaia) e Profilo** hanno ancora la loro intestazione (non il nuovo header comune); nella "Percorso · Menu passati" non mostro il segno kg perso/preso perché quel dato non è ancora esposto dal backend (mostro "N pasti"); su Home ho tolto la riga acqua/passi e le azioni rapide che nel prototipo non ci sono (si possono rimettere altrove se vuoi); i badge notifiche/da-completare compaiono solo con conteggi reali (niente numeri finti) e per ora aprono un foglio segnaposto. Schermi 27–29 (video coach/nutrizionista, assaggio menu) e 33 (widget) restano fuori: i video li hai chiesti di saltare, gli altri aspettano contenuti reali.
- `[Prodotto]` **Nuovi documenti dal socio (da lavorare come step successivi)** — caricati `Metabole_Libreria_Creativa.pdf` e `Metabole_Integrazione_Marketing_Deploy.pdf`: da leggere e integrare nei prossimi passi (marketing/creatività e integrazione deploy). **TODO prossima sessione.**
- `[Sviluppo]` **App cliente — TypeText esteso a Onboarding e Home + allineamento Home al prototipo** —
  l'effetto "a macchina da scrivere" di Gaia è ora applicato anche: alle **intro di sezione** e alla
  **bolla di ogni domanda** dell'Onboarding (rimonta ad ogni domanda, così ricompone), all'**overview
  "Facciamo conoscenza"** (schermo 4, "cinque punti" in grassetto), e alla **frase del giorno di Gaia in
  Home** (si ricompone ogni volta). Home: etichetta della card allineata al prototipo →
  **"GAIA · LA FRASE DI OGGI"** con icona *sparkles*. Type-check app ok. Consegnati `Onboarding.tsx`,
  `Home.tsx`.
  Aggiunto anche lo **schermo 25 "Sto cucendo il tuo percorso"**: transizione a schermo intero (Gaia
  grande + bolla che si compone + spinner) mostrata mentre il motore calcola, con durata minima ~3,2s
  come nel prototipo (onesta: compare durante il vero calcolo, non è un finto ritardo). Build di
  produzione ok.
  **⚠️ DECISIONE APERTA (serve Simone) — navigazione a tab.** Il prototipo in `docs/` usa la barra
  **Home · Percorso · Obiettivi · Contatti · Agenda** (+ Shop), mentre l'app oggi ha
  **Menu · Obiettivo · Home · AI · Agenda** (e nel codice questa era marcata come "prototipo definitivo").
  Sono due architetture di navigazione diverse: allinearle vorrebbe dire creare le pagine **Percorso** e
  **Contatti** (oggi assenti), spostare **Menu** dentro la Home e trasformare **AI/Assistente**. È un
  cambio strutturale importante e reversibile solo con lavoro: **non l'ho fatto in autonomia**. Da decidere
  insieme quale delle due barre è quella buona prima di procedere.
- `[Sviluppo]` **App cliente — testo "a composizione" (TypeText) + Fase 2 (Crea account)** — come nel
  prototipo, i testi di Gaia si **compongono a macchina da scrivere mentre lei parla**: nuovo componente
  riutilizzabile `TypeText` (rispetta grassetti e `prefers-reduced-motion`, cursore lampeggiante),
  applicato alla card assistente della Landing, alla bolla di "In cosa siamo diversi" e di "Crea account";
  da usare su tutti gli schermi. **Fase 2**: `Register` (schermo 3) allineato al mockup — registrazione
  minimale (Nome/Cognome/Email/Password/Codice invito con nota, l'indirizzo si prende al checkout),
  barra "Passo 3 di 34", "oppure registrati con" Apple/Google (placeholder "in arrivo"). Type-check ok.
  Nota: il prototipo live non è raggiungibile dalla sandbox (rete ristretta) e la copia locale è una
  versione più vecchia (28 step) → animazioni calibrate sul video del socio.
- `[Sviluppo]` **App cliente — allineamento al prototipo "34 schermate" (Fase 1)** — dai riferimenti del
  socio (video del flusso + PDF sequenza esatta + prototipo navigabile) il funnel nuovo cliente è di
  **34 step** con barra "Passo N di 34" e tab di sezione. Ricostruita la **Landing (schermo 1)** fedele al
  mockup: brand **MetaboleAI** (teal+viola), claim "Non una dieta: un'AI…", card assistente Gaia con audio,
  **Accedi/Registrati**, prova sociale (★ 24.000 persone), 2 testimonianze. Nuovo schermo **"In cosa siamo
  diversi" (schermo 2)**: 5 punti (Coach sempre presente, Nutrizionista specializzato, App intelligente,
  Dieta personalizzata, Gaia · supervisore AI) + "Sono pronta/o". Rotta `/diversi`. Type-check app ok.
  Resta da allineare (a fasi): 3 Crea account (+Apple/Google), 4 Facciamo conoscenza, le intro sezione +
  domande (5-23) con chrome "Passo N di 34" + tab, 24 colore app, 25 "Sto cucendo il tuo percorso", 26
  percorso pronto, 27-28 video coach/nutrizionista, 29 assaggio menu, 30 scegli piano, 31 riepilogo, 32
  data inizio, 33 tutto pronto (widget). La logica (onboarding, checkout, plan flow) è già a backend.
- `[Sviluppo]` **App staff role-adattiva — Home Coach e Home Nutrizionista** — deciso (con Simone) di NON
  fare tre app React separate: il backoffice diventa **un'unica app staff che cambia in base al ruolo**
  (l'app cliente resta separata, per sicurezza/GDPR e distribuzione store). La Home (rotta `/`) ora è un
  dispatcher (`Home.tsx`): coach → **`CoachHome`** (KPI clienti/avvisi/piani in scadenza/guadagni, lead da
  accettare con Accetta/Rifiuta, coda avvisi con gestito/escalation, elenco clienti, link d'invito con
  copia), nutrizionista/capo → **`NutritionistHome`** (KPI clinici, coda di validazione decisioni
  motore/diete/protocolli con Conferma/Correggi, pazienti che richiedono attenzione), altri → dashboard
  generale. Tutto sul backend Fasi 4/7 già pronto. Il menu era già filtrato per permessi. Type-check ok.
  Prossimo: rendere le viste comode anche da telefono e rifinire i dettagli cliente per coach/nutrizionista.
- `[Sviluppo]` **Backlog #2 — Invito cliente dalla coach (ref code)** — la pagina di registrazione dell'app
  ora accetta il codice invito dal link (`/register?ref=CODICE`, precompilato e con nota "codice applicato");
  ampliato il campo a 8 caratteri per supportare anche i codici "porta un'amica" (8) oltre a quelli coach (6).
  Nuovo endpoint self-service `GET /crm/my-invite` (ruolo coach): restituisce il proprio ref code (creato se
  manca) + il link di registrazione pronto da condividere (base da `APP_URL`). Così la coach ha subito il suo
  link d'invito (la UI dedicata arriverà con l'app coach). Il backend di auto-assegnazione via ref code
  esisteva già. 3 test nuovi.
- `[Sviluppo]` **Backlog #1 — Assegnazione lead a tempo: soglia in config** — il flusso c'era già
  (assegna→pending, la coach accetta/rifiuta entro N giorni, scadenza via cron con notifica alla responsabile
  per riassegnare). Portata la **finestra di accettazione da hardcodata (2 giorni) a config** `lead_accept_days`
  (default 2), usata sia dal conto alla rovescia in "Lead da accettare" sia dalla scadenza del cron; testo
  della notifica reso dinamico. 2 test nuovi. Con questo il #1 è completo.
- `[Sviluppo]` **Backlog #3 — Numero versione app** — la versione (da `app/package.json`) viene iniettata a
  build-time come costante `__APP_VERSION__` (Vite `define`) e mostrata in piccolo/discreto in fondo alla
  pagina Profilo ("Metabole · v0.1.0"). Solo front-end app cliente.
- `[Sviluppo]` **Backlog #0 — Permessi: pulsante "Salva" con conferma** — la matrice Permessi non salva
  più ogni interruttore all'istante: le modifiche si accumulano in locale (celle evidenziate + barra
  "N modifiche non salvate"), poi **Salva** apre un **modale di conferma** e invia il batch dei PATCH
  (una cella per volta, come da API), con toast di esito; "Annulla" scarta le modifiche. Regola "senza
  vede niente gestisce" mantenuta. Solo front-end.
- `[Sviluppo]` **Fix seed admin da Render (password che "non funzionava")** — `ensureAdminFromEnv` prima
  applicava `ADMIN_PASSWORD` SOLO alla creazione dell'account: se l'admin (`ADMIN_EMAIL`, es.
  `admin@metabole.eu`) esisteva già, la password su Render veniva ignorata → login impossibile. Ora il
  seed: promuove ad admin, e **applica `ADMIN_PASSWORD`** se la password non è mai stata impostata
  (placeholder) o se si imposta `ADMIN_PASSWORD_RESET=true` (reset forzato una tantum, poi si rimuove la
  var); riattiva l'account se sospeso/archiviato. Così `admin@metabole.eu` è l'**admin principale
  recuperabile da Render** (e resta non archiviabile, anti-lockout). Documentato in `render.yaml`.
  Gira nel `preDeployCommand` a ogni deploy.
- `[Sviluppo]` **Ruoli Marketing + archiviazione utenti + foto profilo (pulizia account)** — tre interventi
  a supporto della gestione utenti:
  1) **Ruoli Marketing**: nuovi ruoli RBAC `marketing` e `head_marketing` (Responsabile Marketing) —
     enum Prisma + migrazione, `roles.ts`, permessi di default (dashboard/grafici/CRM in lettura, sezione
     `marketing` gestibile; il capo marketing vede anche modelli email e contabilità incassi), etichette,
     voce di menu "Marketing" (pagina placeholder: il modulo vero è da costruire). Così si può creare un
     account "Responsabile Marketing".
  2) **Archivia/ripristina utente** (soft-delete): `DELETE /admin/users/:id` (imposta `deletedAt` + sospeso
     + revoca sessioni) e `POST /admin/users/:id/restore`. **Protezioni anti-lockout**: non ci si può
     archiviare da soli e non si può archiviare l'admin legato alla variabile Render `ADMIN_EMAIL`.
     La tabella Utenti ha "Mostra archiviati", il pulsante Archivia e il Ripristina. 6 test.
  3) **Foto profilo**: campo `photoUrl` su User + migrazione; in Impostazioni si carica un'immagine
     (ridotta a 256×256 lato client come data URL) usata come **avatar** nel menu utente in alto (altrimenti
     iniziali). PATCH `/me/account` accetta `photoUrl` (solo data URL immagine, o null per rimuoverla).
  4) **Impostazioni** tolte dalla sidebar (ora si aprono dal menu utente/avatar in alto).
  Suite 356 verde; migrazioni validate su PG16.
- `[Sviluppo]` **Backlog #6 — Modulo Contabilità (costi + conto economico)** — nuovo modello `CostEntry`
  (costi ricorrenti + una tantum: infrastruttura, marketing, stipendi, tasse, AI…) + migrazione (validata
  PG16). `AccountingService` con aggregazione **pura e testata** (`buildReport`/`costInMonth`/`monthsBetween`):
  conto economico del periodo — incassi (da `LedgerEntry`) vs costi (uscite a ledger provvigioni/compensi +
  costi manuali), per categoria, serie mensile, e KPI **utile, margine, CAC, ARPU, spesa marketing, nuovi/
  paganti**. I costi ricorrenti annuali sono **ammortizzati /12** per un P&L mensile liscio. Endpoint admin
  `GET /admin/accounting/report?from&to` e CRUD costi `/admin/accounting/costs`. Pagina backoffice
  **Contabilità** (`/contabilita`, chiave permesso `accounting_costs`): selettore periodo, KPI, 3 grafici
  mensili (incassi/costi/utile, un asse per grafico riusando `MiniTrend`), costi per categoria, tabella
  costi con aggiungi/modifica/elimina. 13 test backend, suite 350 verde.
- `[Sviluppo]` **Backlog #5 — Avatar/menu utente (backoffice)** — nell'header, al posto di
  "email · ruolo", ora c'è un **avatar a iniziali** (colore stabile dall'email) cliccabile che apre un
  **menu utente** (email+ruolo, **Impostazioni**, **Esci**), con chiusura su click-fuori/Esc. Nuovo
  componente `UserMenu.tsx` + stili. Foto profilo: futura.
- `[Sviluppo]` **Backlog #7 — Calendario CRM cliccabile** — nel calendario promemoria, cliccando su un
  promemoria si apre un **modale** per **modificarlo**, **spostarlo** (nuova data/ora → `PATCH /crm/reminders/:id`,
  già disponibile), segnarlo completato o eliminarlo, con le **azioni rapide di contatto** (chiama /
  WhatsApp / email) del lead collegato. Estratto un componente `ContactActions` riusato anche in
  creazione. Solo front-end (backend già pronto).
- `[Sviluppo]` **Fase 7 (parte 2) — Coda di validazione (diete/protocolli/decisioni) per-paziente** —
  nuovo `GET /nutritionist/validation-queue`: raccoglie ciò che il nutrizionista deve validare —
  **decisioni del motore** marcate per revisione filtrate PER-PAZIENTE (solo i pazienti assegnati; il
  capo/admin le vede tutte), **diete in revisione** da approvare (solo il capo) e **protocolli** in
  attesa (mai i propri) — con nomi paziente e contesto. Nuovi `POST /nutritionist/decisions/:id/confirm|correct`
  che applicano lo **scoping per-paziente** (un nutrizionista revisiona solo le decisioni dei suoi
  pazienti) e delegano la scrittura all'EngineService (idempotenza + audit già lì); le azioni su
  diete/protocolli riusano gli endpoint esistenti (catalog / protocols). 7 test nuovi, suite 337 verde.
  Nessuna migrazione. (Nota sicurezza: gli endpoint `/engine/decisions/:id/confirm|correct` restano
  NON scoped — vedi follow-up in STATO.)
- `[Sviluppo]` **Fase 6 (completamento) — Agente: post-evento, rientro, guardrail conforto** — estesa
  la macchina a stati `DietAgentService`: nuovi stati **post_evento** (evento concluso negli ultimi N
  giorni → spinta efficacia per il recupero) e **rientro**, con due inneschi: il **guardrail** (troppi
  giorni di conforto consecutivi oltre `agent_comfort_max_days` → si esce dai menu "amati" e si torna
  a spingere l'efficacia) e il **recupero** (umore risalito dopo un periodo difficile entro
  `agent_reentry_days`). La "memoria" dello stato si ricava dallo storico dei check-in (nessuna tabella,
  nessuna migrazione). La selezione menu tratta post_evento/rientro come plateau (boost efficacia).
  Priorità: pre_evento > post_evento > plateau > conforto/guardrail/rientro > normale. Nuove soglie in
  config. **Con questo l'agente della Fase 6 è completo.** 8 test (suite 330 verde).
- `[Sviluppo]` **Fase 5 (avanzata) — Attribuzione causale del pasto** — nuova funzione
  `distinctiveCredits`: alla chiusura di un ciclo il merito/demerito non va più in parti uguali a tutte
  le ricette, ma è pesato per **distintività** — la ricetta rara (quella che è CAMBIATA nel ciclo) è la
  causa più probabile di un esito diverso dal solito e prende più credito, quelle sempre presenti lo
  prendono scontato (peso = 1/(1+alpha·samples), normalizzato). Se tutte hanno la stessa frequenza il
  credito torna uniforme. **Opt-in** via `learning_distinctive_weighting` (default false → comportamento
  v1 naive invariato) + `learning_distinctiveness_alpha`. Non è una prova causale: è un modo trasparente
  per far emergere prima il pasto che sposta l'ago. **Con questo il motore v1 della Fase 5 è completo.**
  9 test (suite 327 verde). Nessuna migrazione.
- `[Sviluppo]` **Fase 5 (avanzata) — Giornate bilanciate automatiche (DayCombo)** — nuovo
  `DayComboService` (algoritmo puro, testabile): compone la giornata scegliendo una ricetta per slot
  DENTRO il pool della dieta approvata, in modo che il totale kcal rientri nella banda del target del
  livello (`Diet.levels`), massimizzando il punteggio efficacia+gradimento (modulato dallo stato) e
  ruotando tra le combinazioni migliori per varietà; penalità soft sulla quota proteica giornaliera.
  Pool piccoli → enumerazione completa; pool grandi → greedy. **Opt-in** via `menu_daycombo_enabled`
  (default false): se spento, o se il livello non ha un target kcal, o se nessuna giornata rientra nella
  banda → fallback ai template composti a mano + selettore per-slot (comportamento attuale invariato).
  Refactor: estratto `buildScoringContext` (pool+punteggio) condiviso da selettore e DayCombo. Non
  allarga mai l'insieme ricette approvato dal nutrizionista. 10 test nuovi, suite 322 verde. Nessuna
  migrazione (usa `Diet.levels` e i campi ricetta già esistenti). Resta l'attribuzione causale del pasto.
- `[Sviluppo]` **Fase 8 (parte 1) — "Porta un'amica" (referral cliente)** — ogni cliente ha un
  `referralCode` (8 caratteri, distinto dai ref code coach a 6) sul profilo; nuovo modello `Referral`
  (FK-less: referrer/referred = userId, una invitata = un solo invito) + migrazione (validata PG16).
  `ReferralService`: `ensureCode`, `myReferral` (codice + inviti/conversioni/ricompense), `isClientCode`,
  `linkOnRegister`, `onConvert`. In **registrazione** il codice coach ha la precedenza; se non è un
  codice coach ma di una cliente, si registra l'invito (prima il codice ignoto veniva rifiutato).
  Alla **prima attivazione dell'abbonamento** dell'invitata (`finalizeApproval`) scatta la ricompensa:
  l'abbonamento attivo della referrer viene esteso di `referral_reward_days` (config, default 30);
  se la referrer non ha un abbonamento attivo la ricompensa resta in sospeso (convertita ma non premiata).
  Endpoint cliente `GET /me/referral`. 8 test nuovi, suite 313 verde. (Il resto della Fase 8 — piani,
  checkout, provvigioni, ledger, payout — era già presente.)
- `[Sviluppo]` **Fase 7 (parte 1) — App Nutrizionista: pazienti + dashboard** — nuovo modulo
  `nutritionist`: `GET /nutritionist/patients` (pazienti assegnati con riepilogo clinico: ultima misura,
  escalation aperte, documenti da revisionare, prossima visita, ordinati per attenzione) e
  `GET /nutritionist/dashboard` (pazienti, documenti pending, escalation aperte, protocolli da validare
  `flaggedForReview`, visite in arrivo, guadagni mese/totale). Il dettaglio clinico è già in `health-area`
  (documenti/note/visite/agenda). Nessuna migrazione. 4 test nuovi, suite 303 verde.
- `[Sviluppo]` **Fase 6 (parte 1) — Agente AI: stati + selezione modulata** — nuovo `DietAgentService.stateFor`
  (pre_evento / plateau / conforto / normale, da eventi, cicli senza calo, umore recente). La selezione
  dei menu è modulata dallo stato: conforto → boost gradimento, plateau → boost efficacia, pre_evento →
  bonus proteine (dai macro). Sicurezza/bilanciamento restano prioritari; pesi in config. Le segnalazioni
  sono già coperte dall'Alert engine. 5 test nuovi, suite 299 verde. Restano Rientro/post-evento/guardrail.
- `[Sviluppo]` **Fase 5 (parte 4) — Selezione menu per efficacia+gradimento** — alla composizione della
  giornata, per ogni slot il motore sceglie la ricetta col punteggio migliore
  (`w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)`, default 5★, tie → template), SOLO tra le
  ricette della dieta approvata per quello slot e con vincolo kcal (bilanciamento). Pesi/tolleranza in
  config. Con questo il **nucleo v1 del motore è completo** (esclusioni+sostituzione+learning+selezione).
  1 test nuovo, suite 294 verde.
- `[Sviluppo]` **Backoffice — pagina Chat + auto-riparazione permessi** — nuova pagina `Chat.tsx`
  (staff↔cliente: elenco conversazioni, messaggi, invio) + voce di menu (chiave `chat`) + rotta.
  Risolto anche il problema "sezioni non nel menu" (es. Parametri): `PermissionsService.syncDefaults`
  gira all'avvio e crea le righe permessi mancanti dai default (senza sovrascrivere le modifiche admin),
  così le sezioni aggiunte dopo il seed ricompaiono. Audit menu↔permessi registrato in STATO. Suite 293.
- `[Sviluppo]` **Fase 5 (parte 3) — Learning: esito ciclo + MenuWeight** — nuovi modelli `CycleFeedback`
  (esito peso/cm per ciclo di 2 giorni) e `MenuWeight` (efficacia appresa per ricetta/cliente) +
  migrazione (validata PG16) + soglie config. `DietLearningService.onCycleClose` (trigger da
  `signals.upsertMeasurement`): calcola delta peso/cm vs misura precedente, determina l'esito, e se il
  ciclo è stato seguito aggiorna i MenuWeight delle ricette del ciclo (attribuzione naive). 4 test nuovi,
  suite 292 verde. Manca la selezione per efficacia+gradimento (sostituirà i template fissi).
- `[Sviluppo]` **Fase 5 (parte 2) — Sostituzione equivalente** — se un ingrediente escluso ha un
  sostituto sicuro (mappa: yogurt→senza lattosio, pane→senza glutine, funghi→cavolfiore…) il piatto si
  eroga con la **nota di sostituzione** salvata nello snapshot del pasto e mostrata in Menu; il blocco
  scatta solo se un'intolleranza NON è sostituibile. I cibi non graditi (`dislikedFoods`) si sostituiscono
  ma non bloccano. 2 test nuovi (blocco non-sostituibile / erogazione con sostituzione), suite 288 verde.
- `[Sviluppo]` **Fase 5 (parte 1) — Sicurezza esclusioni (motore menu)** — prima dell'erogazione i piatti
  del ciclo vengono controllati contro le **intolleranze/allergie** della cliente (mappa
  intolleranza→ingredienti, es. lattosio→yogurt/formaggio): se un piatto è incompatibile, il menu NON
  viene erogato e si apre un'**escalation "Piano bloccato" al nutrizionista** (la coach la vede via Alert
  engine, `escalation_open`). `GET /me/menu` ora espone `blocked{active,reason}` e l'app Menu mostra il
  banner "stiamo sistemando il tuo piano". Sostituzione equivalente e giornate/learning = prossimi passi.
  1 test nuovo, suite 287 verde.
- `[Sviluppo]` **App cliente — box "Prossimo appuntamento" in Home** — nuova card nella Home che legge
  `GET /me/agenda?next=1` e mostra tipo/interlocutore/data del prossimo appuntamento; tap → Calendario.
  Type-check app verde.
- `[Sviluppo]` **Fase 4 (parte 3) — Riassunti conversazioni** — nuovo modello `ConversationSummary`
  (titolo AI + data, FK-less) + migrazione (validata PG16). `AiService.summarizeConversation` (titolo
  breve + una frase, con fallback deterministico). `ConversationSummaryService.generateDailyBatch`
  (chiude i thread con messaggi del giorno, upsert per cliente/interlocutore/data) agganciato al cron.
  Endpoint `GET /me/threads/:who/summaries` (cliente) e `GET /staff/threads/:clientId/:who/summaries`
  (staff, con scope; la coach non vede i riassunti col nutrizionista). 4 test nuovi, suite 286 verde.
  Con questo il backend della Fase 4 è sostanzialmente completo.
- `[Sviluppo]` **Fase 4 (parte 2) — Agenda e appuntamenti** — nuova entità `Appointment` (FK-less) +
  migrazione (validata PG16). `GET /coach/agenda` (appuntamenti futuri delle clienti: i propri
  gestibili, quelli col nutrizionista in sola lettura), `POST /appointments` (coach/nutrizionista solo
  per i propri clienti, con validazioni tipo/data), `PATCH /appointments/:id` (solo il proprietario),
  `GET /me/agenda` lato cliente (appuntamenti + scadenza piano; `?next=1` = solo il prossimo, per la
  Home). 7 test nuovi, suite 282 verde.
- `[Sviluppo]` **Fase 4 (parte 1) — App Coach: clienti + dashboard** — nuovo modulo `coach` con
  `GET /coach/clients` (lista clienti assegnate: nome, stato piano, ultima misura, alert aperti,
  ordinata per alert) e `GET /coach/dashboard` (conteggio clienti, piani in scadenza entro
  `expiring_plan_days`, guadagni mese/totale dal ledger, alert aperti). Riusa i guadagni dal
  ledger e l'Alert engine. 4 test nuovi, suite 275 verde. Restano agenda/appuntamenti, chat e
  riassunti conversazioni.
- `[Sviluppo]` **Fase 3 — Alert engine** — nuovo modello `Alert` (coda coach, FK-less) + migrazione
  `alert_engine` (validata PG16) + soglie in config. `AlertsService.recompute(clientId)` sincronizza gli
  alert dai segnali reali (missing_measurements, weight_gain, plateau, inactive, checkin_skipped,
  water_low, low_ratings, dropout_risk, event_incoming, escalation_open, milestone), idempotente e
  auto-risolve quelli non più validi. Endpoint `GET /coach/alerts` (scope coach/manager, ricalcolo lazy)
  e `PUT /alerts/:id` (handled/escalated). Ricalcolo giornaliero nel cron. Refactor Fase 2: il
  `missing_measurements` ora è un Alert vero (rimosso l'avviso via Notification). Suite 271 verde.
- `[Sviluppo]` **Diario di progetto** — creata la cartella `progetto/` (STATO, REGISTRO, README,
  ISTRUZIONI_PER_AI, PROMPT_PER_AI_SOCIO) come
  fonte di verità condivisa; aggiunti al repo i documenti Guida Pubblicazione, Standard CRM/Marketing,
  Schermate Nuovo Cliente. (Nota: il diario sta fuori da `docs/` perché `docs/` è pubblica.)
- `[Prodotto]` **Documenti** — inviati: Guida alla pubblicazione (demo GitHub Pages + deploy produzione),
  Reparto Marketing & Standard CRM (ruolo `head_marketing`, stadi lead, campi, consensi), Schermate
  Nuovo Cliente (sequenza), Punti di forza marketing.
- `[Sviluppo]` **Fase 2 — Misure bloccanti** — l'erogazione del menu richiede la misura del ciclo
  corrente prima di consegnare il ciclo successivo (altrimenti "held"); avviso alla coach
  `missing_measurements` (via Notification); `GET /me/measurement-gate`; sblocco automatico al
  `POST /me/measurements`; popup bloccante nell'app. 6 test nuovi, suite 263 verde. Nessuna migrazione.
- `[Sviluppo]` **Fase 1 — Tracciamento eventi** — modello `AnalyticsEvent` (append-only, idempotente),
  migrazione `analytics_event` (validata su PG16), modulo `tracking` con `POST /api/v1/events` (utente
  dal JWT se presente, sessione+refcod pre-login); client `track()` nell'app (viste, login, register con
  attribuzione refcod, logout). Fix build: campo Json `data` castato `as never` (errore TS su Render).
  7 test nuovi.
- `[Sviluppo]` **Widget su git** — set completo del widget a 3 formati (mascotte Gaia) versionato in
  `docs/android-widget/`; rimozione file spurio `ziSIv8Rd`.
- `[Prodotto]` **Prototipi & docs** — redesign app cliente (nav a icone, header gradiente, 5 sezioni,
  pagina "In cosa siamo diversi"), nuovi prototipi Coach/Nutrizionista, rigenerate le voci Gaia,
  aggiunti 10 documenti di analisi (motore, agente AI, certificazione, mercato, marketing, tracciamento).

## 2026-07-11

- `[Sviluppo]` **Widget home Android** — token widget dedicato (scope widget, 90gg) + endpoint pubblico
  `GET /widget` + file nativi; poi rifatto a 3 formati con la mascotte reale.
- `[Sviluppo]` **AI Claude collegata** — assistente chat con Claude + parametro `ai_assistant_enabled`.
- `[Sviluppo]` **Backoffice** — editor Diete (crea + componi giorni), Ricette (`PATCH /recipes/:id`),
  Protocolli (`PATCH /protocols/:id`); moduli dashboard trascinabili; grafici con assi mesi + tooltip.
- `[Sviluppo]` **App** — Home con dati reali (nome coach, CTA consigli), grafici Obiettivo con date +
  tooltip; guard account staff nell'app cliente (onboarding solo per i clienti).
- `[Sviluppo]` **APK** — progetto Android pronto, build da Android Studio; fix CORS per login da APK
  (origini native `https://localhost` / `capacitor://localhost`).

## Prima dell'11/7 (fondamenta)

- `[Sviluppo]` Backend API-first `/api/v1`: auth JWT+RBAC, onboarding, misure/obiettivi, catalogo,
  erogazione menu, motore a regole (M5), notifiche, CRM/commerce, permessi. Test verdi.
- `[Prodotto]` Prototipo navigabile app cliente, sequenza schermate, specifiche backend, analisi.
