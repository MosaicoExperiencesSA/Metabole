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
- 48 unit test totali

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
