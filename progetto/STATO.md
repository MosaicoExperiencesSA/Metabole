# Metabole — Stato del progetto

Ultimo aggiornamento: 2026-07-13 · Aggiornare la voce quando qualcosa cambia (e loggare in `REGISTRO.md`).

Legenda: ✅ fatto · 🟡 in corso/parziale · ⬜ da fare

---

## Infrastruttura / Stack
- Stack: **NestJS + TypeScript + PostgreSQL (Prisma 6)**, JWT, hosting UE. ✅
- Database **Neon** (Francoforte), pooled `DATABASE_URL` + direct `DIRECT_DATABASE_URL`. ✅
- Backend **Render** (`backend/`, blueprint `render.yaml`) + cron giornaliero 07:00 CEST. ✅
- Frontend **Vercel**: app cliente (`app/`) e backoffice (`backoffice/`). ✅
- Email **Brevo**, pagamenti **Stripe** (+ webhook), AI **Anthropic/Claude**. ✅
- Demo prototipi via **GitHub Pages** su `docs/` (cartella pubblica). ✅
- Regola: chiavi/segreti solo nei pannelli servizi, mai nel repo né in chat. Dettagli: `../Metabole_Guida_Pubblicazione.pdf`.
- Migrazioni versionate in `backend/prisma/migrations`; il type-check reale gira su Render (client Prisma non generabile in sandbox).

## Backend (NestJS) — moduli presenti
Auth (JWT+refresh rotante, RBAC), Users/Profile, Onboarding, Signals (misure/checkin/acqua/passi/progress),
Catalog (diete/ricette), Menu (erogazione), Engine (motore a regole M5), Notifications, Cron, Chat (+AI),
Clients, Commerce/CRM, Reports, Health/HealthArea, Escalations, Visits, Compensation/Payouts,
Analytics (grafici), Dashboard, Permissions/Roles, Signals/Widget, **Tracking (eventi)**, **Alerts (coda coach)**. ✅
- Ruoli RBAC: client, coach, nutritionist, head_nutritionist, sales, **marketing, head_marketing**, admin. ✅
  (marketing = reparto in arrivo: ruoli+permessi+menu attivi, modulo funzionale da costruire).
- Gestione utenti: creazione staff, cambio ruolo/responsabile, sospendi, **archivia/ripristina** (soft-delete,
  con protezione dell'admin `ADMIN_EMAIL` e anti-auto-archiviazione). Foto profilo (avatar) in Impostazioni. ✅
- Dati sanitari cifrati, accessibili solo a cliente + suo nutrizionista. ✅

## App cliente (React + Vite + Capacitor)
- Onboarding, Home (dati reali), Menu, Obiettivo (grafici), Calendario, Assistente (chat AI),
  Negozio, Profilo, Checkout/Pagamento. ✅
- Tab bar e icone allineate al prototipo. ✅
- Widget home Android (3 formati, mascotte Gaia). ✅
- Tracciamento eventi via `track()` (viste, login, registrazione, logout). ✅
- Popup bloccante misure al 2° giorno del ciclo. ✅
- APK Android generabile da Android Studio (guida in `../docs/APK_Build_Guida.md`). ✅

## App Coach (nuova) 🟡
- Prototipo pronto: `../Metabole_Coach_App.html` (+ web).
- Backend fatto finora: `GET /coach/alerts` + `PUT /alerts/:id` (Alert engine, Fase 3),
  `GET /coach/clients` (lista clienti assegnate con riepilogo), `GET /coach/dashboard`
  (clienti, piani in scadenza, guadagni mese/totale, alert aperti). Dettaglio cliente via `admin/clients/:id`.
- Agenda/appuntamenti: entità `Appointment` + `GET /coach/agenda` (propri gestibili, nutrizionista sola
  lettura), `POST/PATCH /appointments`, `GET /me/agenda` (cliente, con `?next=1` per la Home).
- Chat: base in `staff/threads` (coach) + `me/threads` (cliente). Riassunti conversazioni giornalieri
  (`ConversationSummary`, titolo AI) generati dal cron: `GET /me/threads/:who/summaries` (cliente) e
  `GET /staff/threads/:clientId/:who/summaries` (staff; la coach non vede i riassunti del nutrizionista).
- Home cliente: box "Prossimo appuntamento" (usa `GET /me/agenda?next=1`, tap → Calendario). ✅
- **Backend Fase 4 completo.** Ancora da fare: l'**app front-end coach** (React).

## App Nutrizionista (nuova) 🟡
- Prototipo pronto: `../Metabole_Nutrizionista_App.html`. Unico ruolo con accesso ai dati sanitari.
- Già esistente (modulo `health-area`): agenda, visite (`POST /visits`, `/visits/:id/start` televisita,
  `/visits/:id/complete`), documenti clinici cifrati con revisione e flag fuori-range
  (`GET /clients/:id/documents`, `POST /documents/:id/review`), note cliniche (`clients/:id/notes`).
- Aggiunto: `GET /nutritionist/patients` (pazienti assegnati con riepilogo: ultima misura, escalation
  aperte, documenti da revisionare, prossima visita) e `GET /nutritionist/dashboard` (pazienti, documenti
  pending, escalation, protocolli da validare, visite in arrivo, guadagni mese/totale).
- **Coda di validazione** ✅ (`GET /nutritionist/validation-queue`): decisioni del motore marcate per
  revisione filtrate PER-PAZIENTE (solo pazienti assegnati; capo/admin tutte), diete in revisione (solo
  il capo approva), protocolli in attesa (mai i propri). Azioni: `POST /nutritionist/decisions/:id/confirm|correct`
  con scoping per-paziente (delega all'EngineService); diete/protocolli via endpoint esistenti.
- Ancora da fare: **app front-end nutrizionista** (React).
- ⚠️ Follow-up sicurezza: gli endpoint diretti `/engine/decisions/:id/confirm|correct` (ruolo
  nutritionist) NON verificano che la decisione sia di un paziente assegnato — un nutrizionista potrebbe
  revisionare decisioni di pazienti altrui. La via `/nutritionist/...` è scoped; valutare se stringere
  anche quella diretta (o rimuoverla a favore della scoped).

## Backoffice (React + Vite)
- Dashboard (moduli configurabili/trascinabili, grafici con assi mesi + tooltip), CRM/Lead,
  Acquisti, Calendario/Reminder (tipi telefonata/messaggio/email), Impostazioni. ✅
- Editor: Diete (crea + componi giorni), Ricette, Protocolli (regole motore). ✅
- Matrice permessi ruolo × sezione. ✅ Le righe permessi **si auto-riparano all'avvio** del backend
  (`PermissionsService.syncDefaults` crea solo le righe mancanti dai default, senza toccare le modifiche
  dell'admin) — così le sezioni aggiunte dopo il primo seed ricompaiono nel menu.
- **Chat staff ↔ cliente** (pagina `Chat.tsx`, voce di menu): elenco conversazioni + messaggi + invio,
  su API `staff/threads` / `threads/:id/messages`. ✅
- **Menu utente** (header): avatar a iniziali cliccabile → dropdown (email/ruolo, Impostazioni, Esci). ✅
- **Calendario CRM cliccabile**: click sul promemoria → modale modifica/sposta/completa/elimina +
  azioni rapide (chiama/WhatsApp/email) del lead collegato. ✅
- **Contabilità** (`accounting_costs`, admin): registrazione costi (ricorrenti + una tantum) e conto
  economico del periodo (incassi vs costi, per categoria, serie mensile, KPI utile/margine/CAC/ARPU).
  Backend `CostEntry` + `AccountingService`; pagina `/contabilita` con grafici. ✅
- Audit menu↔permessi (13/7): sezioni permessi ancora senza pagina backoffice (feature future):
  `engine_reviews`, `health_documents`, `assignments`, `assign_coach`, `assign_nutritionist`.

## Shop / Abbonamenti / Provvigioni (Fase 8) 🟡
- Già presente (commerce): piani/prodotti, checkout (carta Stripe + bonifico), abbonamenti, ordini,
  pagamenti, ricevute PDF, approvazione/rifiuto in backoffice, provvigioni + ledger, payout/wallet/prelievi,
  buoni sconto, ref code coach (assegnazione lead).
- **Referral cliente "porta un'amica"** ✅: ogni cliente ha un `referralCode`; un'altra cliente può
  indicarlo in registrazione (il codice coach ha la precedenza). Alla prima attivazione dell'abbonamento
  dell'invitata, la referrer riceve `referral_reward_days` giorni extra sull'abbonamento attivo (config,
  default 30); se non ne ha uno attivo la ricompensa resta in sospeso. `GET /me/referral` per l'app.
- Ancora da fare: schermata "porta un'amica" nell'app cliente (front-end) + eventuale notifica alla
  referrer quando la ricompensa scatta.

## Motore / AI
- Motore a regole (Engine, M5): protocolli condizioni→azione, decisioni per cliente. ✅ (base)
- Assistente AI (Claude) per chat e instradamento. ✅
- **Motore di personalizzazione dei menu** (catalogo→dieta cliente→giornate→learning): 🟡 (Fase 5).
  - Sicurezza esclusioni (v1): intolleranze/allergie in un piatto → **blocco erogazione + escalation al
    nutrizionista** (la coach la vede via Alert engine); `GET /me/menu` espone `blocked` e l'app mostra
    "stiamo sistemando il tuo piano".
  - Sostituzione equivalente (v1): se l'ingrediente escluso ha un sostituto sicuro (es. yogurt → yogurt
    senza lattosio, pane → pane senza glutine, funghi → cavolfiore) il piatto si eroga con la **nota di
    sostituzione** (visibile in Menu); si blocca solo se un'intolleranza NON è sostituibile. I cibi non
    graditi si sostituiscono ma non bloccano.
  - Learning (v1): alla chiusura di un ciclo (arrivo misura al 2° giorno) si calcola l'**esito peso/cm**
    del ciclo (`CycleFeedback`: perso/stabile/preso, con soglie config) e — se seguito (proxy: check-in
    nel ciclo) — si aggiornano i **MenuWeight** (efficacia appresa per ricetta/cliente, attribuzione naive
    all'intera giornata). Trigger da `signals.upsertMeasurement`.
  - Selezione (v1): alla composizione della giornata, per ogni slot il motore sceglie — **dentro la
    dieta approvata** (pool dai template) e con **vincolo kcal** (bilanciamento) — la ricetta col
    punteggio migliore = `w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)` (default 5★, tie →
    resta il template). Pesi e tolleranza in config.
  - **Nucleo v1 del motore completo** (sicurezza esclusioni + sostituzione + learning + selezione).
  - **Giornate bilanciate automatiche (DayCombo)** ✅ (opt-in): il motore compone la giornata scegliendo
    una ricetta per slot DENTRO il pool della dieta approvata puntando alle kcal del livello
    (`Diet.levels`), col punteggio efficacia+gradimento e varietà tra i giorni; penalità soft sulla quota
    proteica. Attivo solo con `menu_daycombo_enabled=true` e se il livello ha un target kcal; altrimenti
    (o se nessuna giornata rientra nella banda) fallback ai template composti a mano. Non allarga mai
    l'insieme ricette approvato dal nutrizionista.
  - **Attribuzione causale del pasto** ✅ (opt-in): alla chiusura del ciclo il credito ai MenuWeight è
    pesato per distintività — la ricetta rara (cambiata nel ciclo) prende più merito/demerito di quelle
    abituali (`learning_distinctive_weighting`, `learning_distinctiveness_alpha`). Se spento → credito
    uniforme (v1 naive). **Motore v1 Fase 5 completo.**
  - Idee future (non urgenti): composizione DayCombo dall'intero catalogo (oggi il pool = ricette dei
    template della dieta); attribuzione causale con veri controfattuali (oggi è euristica osservazionale).
- **Agente AI della dieta** (stati, scoring): 🟡 (Fase 6).
  - `DietAgentService.stateFor` determina lo stato (in priorità): **pre_evento** (evento entro N giorni),
    **post_evento** (evento concluso negli ultimi N giorni), **plateau** (ultimi N cicli senza calo),
    **conforto** (umore basso recente sotto il guardrail), **rientro** (guardrail conforto superato,
    oppure umore risalito dopo un periodo difficile), altrimenti **normale**.
  - La selezione dei menu è **modulata dallo stato**: conforto → boost gradimento (menu più amati),
    plateau/post_evento/rientro → boost efficacia (menu più dimagranti/recupero), pre_evento → bonus
    proteine (dai macro). Sicurezza e bilanciamento restano prioritari. Pesi/soglie in config.
  - **Guardrail conforto** (`agent_comfort_max_days`): dopo troppi giorni di umore basso di fila si esce
    dal conforto e si rientra (spinta efficacia), per non lasciare la cliente ferma nei menu amati.
    **Rientro** dopo il recupero entro `agent_reentry_days`. La "memoria" dello stato si ricava dallo
    storico dei check-in (nessuna tabella dedicata). **Agente Fase 6 completo.**
  - Le segnalazioni (aderenza→coach, mood/plateau) sono già coperte dall'Alert engine (dropout_risk,
    plateau, ecc.).
- **Certificazione unicità** (seed, collision check, registro firmato): ⬜ (Fase 10).

## Marketing / CRM (nuovo, da `../Metabole_Reparto_Marketing_e_Standard_CRM.pdf`) 🟡
- Ruoli `marketing` + `head_marketing` **aggiunti** all'RBAC, ai permessi di default e al menu (voce
  "Marketing", pagina placeholder). ✅ Resta da costruire il **modulo funzionale**: ↓
- Sezione backoffice marketing: campagne, segmenti, automazioni, KPI, gestione consensi (no dati sanitari).
- Standard lead/pipeline: stadi (nuovo→contattato→qualificato MQL→opportunità SQL→cliente→a rischio→churn→in rientro);
  campi lead (fonte/canale, campagna+utm, refcod, consensi email/sms/marketing con timestamp+base giuridica, owner).
- SLA marketing↔vendite e regola di recycle (collegato al backlog "assegnazione lead a tempo").

---

## Piano di lavoro a 10 fasi (dai handoff del socio)
Dettaglio in `metabole-piano-lavoro.md` (memoria) e in `../Metabole_Backend_Operazioni.md`.

| Fase | Cosa | Stato |
|---|---|---|
| 0 | Consolidamento: ogni risposta test salvata 1:1; login → role/home_route (4 percorsi) | 🟡 |
| 1 | **Tracciamento eventi** (POST /events + client track()) | ✅ (13/7) |
| 2 | **Misure bloccanti** al 2° giorno del ciclo | ✅ (13/7) |
| 3 | **Alert engine** (coda avvisi coach, tutte le regole) | ✅ (13/7) |
| 4 | App Coach — API (clienti, agenda, dashboard guadagni, chat, appuntamenti, riassunti) | 🟡 clients+dashboard fatti |
| 5 | Motore di personalizzazione menu — v1 "naive" | ✅ completo v1 (esclusioni+sostituzione+learning+selezione+DayCombo+attribuzione causale) |
| 6 | Agente AI della dieta (stati, scoring, escalation) | ✅ stati completi (pre/post-evento, plateau, conforto+guardrail, rientro) + selezione modulata |
| 7 | App Nutrizionista (cartella clinica, validazione diete/protocolli, televisite) | 🟡 pazienti+dashboard+coda validazione (scoped per-paziente) fatti; resta l'app front-end |
| 8 | Shop / abbonamenti / provvigioni | 🟡 commerce già presente; aggiunto referral cliente "porta un'amica" |
| 9 | Certificazione unicità (seed, collision check, registro firmato) | ⬜ |

> Trasversali: privacy/consensi + AuditLog; tutte le soglie in `config_param`; notifiche push (backlog);
> numero versione app (backlog); avatar/menu utente in alto nel backoffice (backlog).
