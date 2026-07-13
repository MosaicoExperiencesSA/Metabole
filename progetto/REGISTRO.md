# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

---

## 2026-07-13

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
