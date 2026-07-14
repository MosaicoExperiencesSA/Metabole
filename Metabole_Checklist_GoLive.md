# Metabole — Checklist Go-Live

Sequenza operativa per il lancio in produzione. Spunta man mano.
Legenda responsabili: **[Sv]** = Sviluppo (Simone) · **[Pr]** = Prodotto (Antonio) · **[Ops]** = configurazione pannelli servizi.
Aggiornata: 2026-07-14 (dopo chiusura blocker di codice).

> **Stato in una riga:** i 3 blocker di **codice** sono chiusi. Restano la **configurazione di produzione** (Neon, Stripe LIVE, Brevo+DNS, segreti, FCM), il **deploy dei due front-end** su Vercel e lo **smoke test finale**. Nessun nuovo sviluppo necessario per aprire.

---

## ✅ Blocker di codice — CHIUSI

- [x] **[Sv] Endpoint pubblico "crea lead"** — `POST /api/v1/public/leads` attivo (rate-limit + honeypot). File: `backend/src/commerce/public-lead.controller.ts` + dto + `crm.service`.
- [x] **[Pr] Form del sito collegati** — `data-endpoint="https://metabole-backend.onrender.com/api/v1/public/leads"` valorizzato in `Metabole_Sito_Presentazione.html` e `Metabole_Lavora.html`.
- [x] **[Sv] Fix sicurezza scoping** — `/engine/decisions/:id/confirm|correct` verifica che la decisione sia di un paziente **assegnato** (scoping per-paziente in `reviewDecision`).

## 🔴 Blocker di configurazione — da chiudere PRIMA di aprire (in quest'ordine)

- [ ] **1 · [Ops] Database Neon** — creare DB prod; impostare `DATABASE_URL` (pooled) e `DIRECT_DATABASE_URL` (direct). Poi `prisma migrate deploy` + `prisma db seed` (il seed carica anche il **catalogo Keto**).
- [ ] **2 · [Ops] Segreti backend** — `ADMIN_EMAIL`, `ADMIN_PASSWORD`; verificare `JWT_ACCESS_SECRET`, `FILE_ENCRYPTION_KEY`, `CRON_SECRET` (auto-gen Render); `AI_API_KEY` (Anthropic).
- [ ] **3 · [Ops] Stripe LIVE** — `STRIPE_SECRET_KEY` (`sk_live_…`) + prodotti/prezzi in live; registrare il webhook di produzione → `STRIPE_WEBHOOK_SECRET` (`whsec_…`).
- [ ] **4 · [Ops] Email Brevo + DNS** — `BREVO_API_KEY`, `MAIL_FROM` (mittente verificato) e **SPF/DKIM/DMARC** sul dominio (senza, le mail vanno in spam).
- [ ] **5 · [Ops] CORS & URL** — `CORS_ORIGINS` con i domini reali (`https://app.metabole.eu`, `https://backoffice.metabole.eu`) e `APP_URL`.
- [ ] **6 · [Ops] Push / Firebase** — configurare le credenziali FCM **oppure** disattivare le push per il lancio (dipendenza presente, config no).

## 🟠 Deploy & pulizie

- [ ] **7 · [Ops] Deploy backend (Render)** — dopo i segreti; verificare `GET /health` (DB up).
- [ ] **8 · [Ops] Frontend Vercel** — impostare `VITE_API_URL` su **entrambi** i progetti (app cliente + backoffice) verso il backend prod; deploy.
- [ ] **[Sv] `app/.env.example`** — crearlo (oggi assente; esiste solo per il backoffice).
- [ ] **[Sv] Pulizia repo** — rimuovere il backup `backend/prisma/schema_1.prisma`.
- [ ] **[Sv] Build/test reale in pipeline** — il client Prisma non si genera in sandbox: confermare che `npm run build` e i test (incl. `seed_keto.spec.ts`) passano su Render.
- [ ] **[Sv] Cron `render.yaml`** — aggiornare l'URL hardcoded se si adotta un dominio custom.

## 🟢 Smoke test pre-lancio (su prod, dopo il deploy)

- [ ] **9 · [Pr/Sv]** Registrazione → verifica email (inbox, non spam) → login.
- [ ] **[Pr/Sv]** Onboarding cliente: risposte salvate 1:1 → Home corretta (role/home_route).
- [ ] **[Pr/Sv]** Acquisto piano (carta Stripe LIVE) → webhook → abbonamento attivo → "clienti gestiti" +1.
- [ ] **[Pr/Sv]** Menu del giorno erogato; test esclusione allergene → blocco/escalation al nutrizionista.
- [ ] **[Pr/Sv]** Backoffice: lead visibile, assegnazione a coach, contabilità, ruoli/permessi.
- [ ] **[Pr]** Sito: selettore 9 lingue + pagine legali + banner cookie; form lead che arriva nel CRM.

## 🔵 Contenuti prima del pubblico

- [ ] **[Pr] Team**: nome e CV reali del responsabile scientifico + foto reali coach/nutrizionista (oggi placeholder).
- [ ] **[Pr] Percorsi non-mediterranei**: menu Proteica/Low-carb/**Keto** validati dal nutrizionista (il Keto è nel motore, manca la firma finale sulle grammature).
- [ ] **[Pr] Revisione madrelingua** delle traduzioni sensibili (RU/ZH/AR) su sito e legali.
- [ ] **[Pr] Prime testimonianze** con consenso e approvate (compaiono in automatico sul sito).

## ⚪ Subito dopo il lancio (non bloccante)

- [ ] **[Sv] Endpoint dinamici del sito** (i18n/stats/paths/testimonials/blog — le "prese" ci sono già).
- [ ] **[Sv] App Coach e Nutrizionista dedicate** (front-end) — i backend sono completi; oggi le Home vivono nel backoffice.
- [ ] **[Sv] Motore Fase B (R8–R12)** — E1 Agente Esclusioni sbloccato (vedi `Metabole_E1_Agente_Esclusioni_Decisioni.md`), poi E2–E5.
- [ ] **[Sv] Modulo Marketing/CRM + Giudice**, **Agenti**, **Blog automatizzato**, **Publisher social**.
- [ ] **[Sv/Pr] Prodotti dinamici zero-redeploy** + **piani stagionali estate**.
- [ ] **[Sv] Certificazione unicità** del motore (R9/Fase 9).

---

### Semaforo
- **Codice**: pronto; blocker di codice **chiusi**.
- **Go-live**: bloccato solo dalle voci di **configurazione 🔴 (1–6)** e dal **deploy 🟠 (7–8)**, poi **smoke test 🟢 (9)**.
- Le voci ⚪ non bloccano il lancio iniziale.
