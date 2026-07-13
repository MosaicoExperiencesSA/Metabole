# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

---

## 2026-07-13


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
