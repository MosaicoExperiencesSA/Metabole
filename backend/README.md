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
