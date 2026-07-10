# Metabole backend

API REST del backend Metabole. Stack: **NestJS + TypeScript + PostgreSQL (Prisma)**.
Specifica di riferimento: [`../Metabole_Specifica_Backend_Sviluppatore.md`](../Metabole_Specifica_Backend_Sviluppatore.md).

## Stato

Milestone 1 — Fondamenta (completata):

- `GET /health` — stato applicazione + database (`{ status, database, timestamp, version }`)
- Schema Prisma: `user`, `config_param`, `audit_log`, `refresh_token`, `action_token`
- **Auth JWT** (`/api/v1/auth/*`): register, login, refresh con rotazione del refresh token (opaco, salvato hashato), logout, verifica email, reset password (token monouso, nessuna enumerazione utenti). Password con argon2.
- **RBAC**: guardia JWT globale (`@Public()` per le rotte aperte) + `@Roles(...)` sui sei ruoli
- **Utenti**: `GET /api/v1/me` · admin: `GET/POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id` (sospensione/cambio ruolo revocano le sessioni)
- **Audit log**: eventi auth e azioni admin registrati; consultabile da `GET /api/v1/admin/audit-logs`
- **Email transazionali** (Brevo): verifica email e reset password; senza API key valida logga invece di inviare

Milestone 2 — Onboarding + profilo (completata):

- **Questionario** (`/api/v1/onboarding/*`): `GET questions` (schema 15 pagine dal prototipo), `POST answers` (validazione completa, consenso dati sanitari obbligatorio), `GET result` (percorso consigliato + team + prima visita in presenza)
- **Screening sanitario**: patologie/farmaci dichiarati → `screening_flag` + escalation automatica al nutrizionista assegnato
- **Obiettivo sostenibile**: validazione del ritmo con soglie da `config_param` (sostenibile ≤0.7, ambizioso ≤1.0 kg/sett; azione su obiettivo irreale configurabile: warn / block_propose_date / require_nutritionist)
- **Assegnazione team**: coach e nutrizionista attivi meno carichi; riassegnazione admin via `POST /api/v1/admin/assignments`
- **Profilo** (`/api/v1/me/profile|objective|theme`): lettura/modifica con rivalidazione del ritmo; ogni modifica dell'obiettivo torna `proposed` (riconferma coach+nutrizionista) e traccia la history
- **Parametri motore**: `GET/PATCH /api/v1/admin/config` con cache 60s e audit delle modifiche
- Nuove tabelle: `staff`, `client_profile`, `objective`, `escalation`

Backoffice — permessi e impersonazione:

- **Matrice permessi** ruolo × sezione (18 sezioni da specifica): `GET/PATCH /api/v1/admin/permissions` (audit su ogni modifica, anti-lockout sull'admin) e `GET /api/v1/me/permissions` per costruire menu e viste del frontend. Default dal seed: la coach non vede i documenti sanitari, il commerciale non vede i clienti, l'admin non accede alle note cliniche.
- **Impersonazione admin** (`POST /api/v1/admin/impersonate`): token a vita breve (30m, configurabile) per assistere una cliente o un membro dello staff; mai su altri admin, nessun refresh token, claim `impersonatedBy` e tutto tracciato in audit. È la versione sicura della "master password".
Milestone 3 — Segnali (completata):

- **Misure** (`GET/POST /me/measurements`): peso/vita/fianchi/cosce, una per giorno (upsert), mai nel futuro. **Guardrail calo rapido**: oltre `max_weight_change_alert_kg_week` sulla tendenza delle ultime 2 settimane → escalation automatica al nutrizionista (una sola aperta per volta).
- **Check-in giornaliero** (`GET/POST /me/checkins`): umore scala 5 + energia/fame/stress opzionali (1–5), uno per giorno. `GET /me/today` per il popup "una volta al giorno" (check-in, misura, acqua, passi del giorno).
- **Acqua e passi** (`POST /me/water`, `POST /me/steps`): obiettivi da `config_param` (8 bicchieri, 8000 passi).
- **Progressi** (`GET /me/progress`): tutto su **media mobile** (finestra da config, mai il singolo dato) — % verso obiettivo, kg persi/rimanenti, ritmo settimanale, direzione, **proiezione della data obiettivo**, giorni di stallo (soglia coach da config), flag calo rapido, serie per il grafico.
- **Traguardi** (`GET /me/milestones`): automatici — prima misura, -1/-3/-5 kg, metà strada, obiettivo raggiunto.
- 89 unit test totali

Milestone 4 — Diete e menu (completata):

- **Catalogo diete** (`/api/v1/diets`, `/head/diets`, `/catalog`): il nutrizionista crea bozze, template giornata e invia in revisione; **solo il capo approva o rifiuta, mai una propria dieta**; ogni modifica riporta in bozza e azzera l'approvazione. Il motore eroga solo diete `approved`.
- **Ricette** (`/api/v1/recipes`): kcal, ingredienti, metodi di cottura, tag, macro; lettura anche per le clienti.
- **Erogazione menu** (`GET /me/menu`): visibile da `plan_start_date - 2` (config), **2 giorni alla volta** (config); i successivi si sbloccano **solo dopo il check-in del giorno**; rotazione dei template; snapshot dei pasti nel giorno erogato, mai sovrascritto. Scelta dieta deterministica sul profilo (dal M5 deciderà il motore, `source_rule_id`).
- **Valutazioni** (`POST /me/ratings`, `GET /me/ratings/pending`): segnale Gusto, 1–5 stelle + tag, una per pasto/giorno; i pasti non valutati vengono riproposti all'apertura.
- **Lista spesa** (`GET /me/shopping-list`, `PATCH .../items`): ingredienti aggregati dei giorni erogati, spunte persistenti.
- Seed: dieta demo "Equilibrio Mediterraneo" (10 ricette, 2 giornate) solo se il catalogo è vuoto.
- 107 unit test totali

Milestone 5 — Il motore intelligente (completata):

- **Governance in 3 fasi (spec 7.3)**: validazione a monte (`GET/POST /protocols`, `POST /protocols/:id/validate` — mai il proprio protocollo), esecuzione solo dentro protocolli `approved`, controllo a campione (`GET /engine/decisions?flagged=true`, `POST /engine/decisions/:id/confirm|correct`).
- **Motore deterministico** (`POST /engine/run`, singola cliente o batch per il cron): raccoglie i 5 segnali (Corpo su media mobile, Testa dagli ultimi check-in, Vita dal profilo, Agenda — placeholder fino al calendario —, Gusto dalle valutazioni), valuta le regole per priorità e decide **menu, tono e timing**. Idempotente per giorno.
- **Ogni decisione è loggata e spiegabile**: snapshot dei segnali, regola applicata, spiegazione leggibile, audit.
- **Guardrail (spec 7.4)**: screening sanitario → il motore non decide in autonomia; calo troppo rapido con energia non alta → alza calorie + escalation; energia bassa cronica (soglia `low_energy_chronic_threshold` in config) → escalation. Tutti i casi finiscono flagged al nutrizionista.
- **Seed**: le 5 regole della tabella decisionale della specifica (7.2) come protocolli approvati di partenza.
- Regole in `definition` jsonb: `{priority, conditions:[{field,op,value}], action:{menu,tone,timing,levelDelta,flagForReview}}` — nuove regole si scrivono dal backoffice, senza toccare il codice. L'AI generativa arriverà solo come layer di supporto, mai come decisore.
- 130 unit test totali

Milestone 6 — Ciclo di vita e notifiche (completata):

- **Calendario** (`GET/POST/DELETE /me/events`, `GET /me/events/:id/plan`): eventi singoli e periodi senza dieta (max 30 giorni) con piano in tre fasi — "anticipare, non punire". La pausa fotografa il peso di partenza.
- **Segnale Agenda vero nel motore**: `upcomingEvent` (evento nei 7 giorni) e `pausePeriodActive` ora arrivano dal calendario; la regola "in calo + evento in agenda" può scattare davvero.
- **Pause nel menu**: durante un periodo senza dieta l'erogazione si sospende (il monitoraggio no); oltre `pause_deviation_trigger` scatta il **mini-piano** (notifica + fase evento aggiornata).
- **Motore → menu**: la decisione del giorno guida il livello (`levelDelta`, con ripiego sul livello base) e firma il giorno erogato con `source_rule_id`.
- **Notifiche** (`GET /me/notifications`, `PATCH .../read`): promemoria check-in e misure, countdown pre-evento, mini-piano, **alert alla coach** su stallo e assenza di check-in (soglie da config). Mai due notifiche dello stesso tipo nello stesso giorno.
- **Cron giornaliero**: `POST /internal/cron/daily` protetto da `CRON_SECRET` (condiviso via envVarGroup) esegue motore batch + notifiche; nel blueprint c'è il cron Render alle 05:00 UTC.
- 149 unit test totali

Milestone 7 — Area sanitaria (completata):

- **Visite** (`POST /visits`, `/visits/:id/start|complete`, `GET /agenda`, `GET /me/visits`): **la prima visita è sempre in presenza** (il modulo rifiuta la televisita se è la prima — vincolo normativo); televisita solo per i controlli, con stanza video generata all'avvio (provider WebRTC da integrare); alla chiusura note riservate e **riconferma dell'obiettivo** in `Objective.history`.
- **Documenti sanitari** (`POST/GET /me/documents`, `GET /documents/:id/content`, review con flags): contenuto **cifrato AES-256-GCM** (chiave `FILE_ENCRYPTION_KEY` generata da Render), max 10 MB, solo PDF/JPEG/PNG/HEIC. Accesso: cliente e staff sanitario del paziente. **La coach, il commerciale e l'admin non li vedono mai.** Ogni download è in audit.
- **Note cliniche** (`GET/POST /clients/:id/notes`): riservate al nutrizionista assegnato e al capo; ogni lettura tracciata.
- **RBAC a livello di risorsa**: un nutrizionista opera solo sui propri pazienti; il capo su tutti.
- Storage: nel database (UE) dietro un'astrazione che permetterà la migrazione a bucket S3 senza cambiare le API.
- 166 unit test totali

Milestone 8 — Chat (completata):

- **Thread per controparte** (`GET /me/threads`): assistente AI, coach e nutrizionista (creati al primo accesso). `GET/POST /threads/:id/messages` con accesso verificato thread per thread.
- **Assistente AI di primo filtro, deterministico** (spec sez. 5 — l'AI generativa arriverà in M10): **temi sensibili** (condotte alimentari a rischio, sintomi fisici, gravidanza, farmaci) → risposta di presa in carico + **escalation e alert immediato alla nutrizionista**; **FAQ** (menu, lista spesa, misure, acqua, obiettivo, eventi, valutazioni) → risposta immediata dalla libreria; **tutto il resto** → inoltro automatico nel thread della coach (o della nutrizionista per i temi clinici) con notifica.
- **RBAC chat**: la coach entra solo nei thread coach delle proprie clienti, la nutrizionista nei propri, il capo supervisiona i thread sanitari; ogni escalation sensibile è in audit.
- **Notifiche**: nuovo messaggio → avviso allo staff destinatario; risposta dello staff → avviso alla cliente.
- 192 unit test totali

Milestone 9 — CRM, commercio e contabilità (completata):

- **Flusso bonifico**: `POST /me/subscribe` (gating al consenso dati sanitari) → email con gli **estremi bancari** (da `config_param: bank_transfer_details`) e causale → la cliente carica la **contabile** (`POST /me/payments/:id/receipt`, cifrata AES-256) → l'operatore (admin/commerciale) verifica (`GET /admin/payments?status=receipt_uploaded`, download contabile) e **approva o rifiuta**. **Solo all'approvazione**: abbonamento attivo, income a ledger, **provvigioni** coach/nutrizionista (percentuali da config), CRM → `paid`, **ricevuta via email** e notifica. Il **menu si genera solo con abbonamento attivo**.
- **Ordini integratori** (`GET /products`, `POST /me/orders`): stesso flusso bonifico.
- **CRM** (`GET/POST/PATCH /crm/leads`): ogni transizione salva **data + responsabile** (`stage_dates`); `lead_in` automatico alla registrazione, `paid` all'approvazione.
- **Eventi economici automatici** (niente doppio inserimento): pagamento approvato → income + provvigioni; **visita completata → compenso nutrizionista + expense** (importo da config).
- **Dashboard**: `GET /dashboards/sales` (stage, conversione, incasso mese), `/dashboards/accounting` (entrate/uscite per categoria), `/dashboards/compensation` (compensi per staff/periodo); `GET /ledger` con filtri.
- Prezzi sempre in **centesimi**. Seed: 3 piani + 2 prodotti demo (prezzi da confermare), estremi bancari segnaposto da configurare in `admin/config`.
- **Stripe (carta)**: `POST /me/subscribe` con `method: "card"` → sessione **Stripe Checkout** (`checkoutUrl`); `POST /payments/webhook` con **firma verificata** (`STRIPE_WEBHOOK_SECRET`, rawBody) e **idempotente** → alla conferma, stessa catena del bonifico (attivazione, income, provvigioni, CRM, ricevuta). Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (solo pannello Render).
- 212 unit test totali

Milestone 10 — Rifinitura (completata):

- **i18n (spec sez. 12)**: catalogo messaggi **italiano + inglese** (`src/i18n/messages.ts`), `locale` per utente (in registrazione o `PATCH /me/profile`), fallback sempre sull'italiano. Notifiche ed email transazionali arrivano nella lingua dell'utente. Il test del catalogo garantisce che ogni chiave esista in entrambe le lingue.
- **Notifiche intelligenti complete (spec sez. 9)**: messaggio quotidiano del **motore** con tono e timing decisi dalle regole (`engine_daily`, payload con `tone`/`timing`/`decisionId`), richiesta valutazione ricette in sospeso, promemoria **visita di domani** (a cliente e nutrizionista), incoraggiamento a **misure migliorate**, oltre a check-in/misure/pre-evento/mini-piano/alert coach già attivi. Testi con **varianti** scelte in modo deterministico (utente+giorno) per non essere ripetitivi.
- **Preferenze notifiche** (`GET/PATCH /me/notifications/prefs`): opt-out per tipo + **email opzionale** (default spenta; solo per visite, pagamenti e pre-evento). Le preferenze vengono rispettate da ogni notifica.
- **Layer AI di supporto (spec 7.2)**: `MessageComposerService` — il testo parte sempre dai template; se `AI_API_KEY` è configurata su Render **e** `ai_composer_enabled=true` in config, il corpo viene riformulato da Claude **mantenendo il tono deciso dal motore** (l'AI non decide mai); qualsiasi errore → fallback silenzioso al template; tracciabilità nel payload (`composer: template|ai`).
- **Hardening OWASP**: `helmet` (security header), **rate limiting** globale (120 req/min per IP, `THROTTLE_LIMIT` per regolarlo) con limiti stretti su login (10/min), registrazione (5/min) e reset password (5/15min); cron e webhook Stripe esclusi (protetti da segreto/firma). **Limite body 12 MB** esplicito (upload contabili/documenti base64) con `rawBody` preservato per la firma Stripe — verificato a runtime.
- **Load test locale** (`test/load/load-app.ts`, stack API reale con database stubbato, 50 connessioni × 10s, autocannon): `/health` ≈ 2.900 req/s (p99 45ms), `/api/v1/plans` ≈ 3.600 req/s (p99 28ms), rotta protetta con token invalido ≈ 3.100 req/s (p99 39ms). Rate limiter verificato: 120 passano, dalla 121ª in poi 429.
- 231 unit test totali

## Sviluppo locale

Requisiti: Node 22+, un database PostgreSQL (anche Neon dev branch).

```bash
cd backend
cp .env.example .env       # inserire la DATABASE_URL
npm install
npx prisma migrate deploy  # crea le tabelle
npx prisma db seed         # carica le 14 soglie del motore
npm run start:dev          # avvia su http://localhost:3000
curl http://localhost:3000/health
```

Test:

```bash
npm test
```

## Deploy (Render)

Il deploy è configurato dal blueprint [`../render.yaml`](../render.yaml): build, `prisma migrate deploy` + seed in pre-deploy, health check su `/health`. Le variabili `DATABASE_URL` (Neon, pooled) e `BREVO_API_KEY` vanno inserite a mano nel pannello Environment di Render — mai committate.

## Convenzioni

- Ogni soglia del motore vive in `config_param`, mai hardcodata.
- Migrazioni Prisma versionate in `prisma/migrations/`.
- Seed idempotente: aggiorna le descrizioni ma non sovrascrive i valori modificati dall'admin.
- Prossimi passi (roadmap sez. 13 della specifica): auth JWT + RBAC, gestione utenti/profili, audit log applicativo, poi onboarding e segnali.
