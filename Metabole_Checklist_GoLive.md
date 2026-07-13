# Metabole — Checklist Go-Live

Sequenza operativa per il lancio in produzione. Spunta man mano.
Legenda responsabili: **[Sv]** = Sviluppo (Simone) · **[Pr]** = Prodotto (Antonio) · **[Ops]** = configurazione pannelli servizi.
Aggiornata: 2026-07-14.

---

## 🔴 Blocker — da chiudere PRIMA di aprire al pubblico

- [ ] **[Sv] Endpoint pubblico "crea lead"** — creare un endpoint pubblico (rate-limit + captcha/anti-spam) per i form del sito; oggi `POST /crm/leads` è protetto da ruolo e i form non salvano nulla.
- [ ] **[Pr] Collegare i form del sito** — valorizzare `data-endpoint` in `Metabole_Sito_Presentazione.html` (form lead) e `Metabole_Lavora.html` (candidature) con l'endpoint sopra. Verificare che un invio arrivi davvero nel CRM.
- [ ] **[Sv] Fix sicurezza scoping** — `/engine/decisions/:id/confirm|correct` deve verificare che la decisione sia di un paziente **assegnato** (oggi accesso cross-paziente). Vedi `progetto/STATO.md` §App Nutrizionista.
- [ ] **[Ops] Stripe LIVE** — inserire `STRIPE_SECRET_KEY` (da `sk_test_` a `sk_live_`) e `STRIPE_WEBHOOK_SECRET`; registrare l'endpoint webhook di produzione su Stripe e fare un pagamento di prova reale.
- [ ] **[Ops] Database Neon** — `DATABASE_URL` (pooled) e `DIRECT_DATABASE_URL` (direct, per migrate/seed) di produzione; eseguire migrazioni + seed sul DB prod.
- [ ] **[Ops] Email Brevo + DNS** — `BREVO_API_KEY`, `MAIL_FROM` (mittente verificato) e **SPF/DKIM/DMARC** sul dominio. Test: registrazione → email di verifica arriva in inbox (non spam).
- [ ] **[Ops] Push / Firebase** — configurare le credenziali FCM (service account) **oppure** disattivare le notifiche push per il lancio (la dipendenza `firebase-admin` c'è, la config no).
- [ ] **[Ops] Admin & CORS** — `ADMIN_EMAIL`, `ADMIN_PASSWORD`; `CORS_ORIGINS` con i domini reali (`https://app.metabole.eu`, `https://backoffice.metabole.eu`); `APP_URL`.

## 🟠 Configurazione & deploy

- [ ] **[Ops] Frontend Vercel** — impostare `VITE_API_URL` su **entrambi** i progetti (app cliente + backoffice) verso il backend di produzione.
- [ ] **[Sv] `app/.env.example`** — crearlo (esiste solo per il backoffice) per parità/onboarding sviluppatori.
- [ ] **[Ops] AI (Claude)** — `AI_API_KEY` (Anthropic) e attivare `ai_assistant_enabled` / `ai_composer_enabled` dal backoffice.
- [ ] **[Ops] Segreti auto-generati Render** — verificare `JWT_ACCESS_SECRET`, `FILE_ENCRYPTION_KEY`, `CRON_SECRET`.
- [ ] **[Sv] Cron `render.yaml`** — aggiornare l'URL hardcoded (`metabole-backend.onrender.com`) se si adotta un dominio custom.
- [ ] **[Sv] Pulizia repo** — rimuovere il backup `backend/prisma/schema_1.prisma`.
- [ ] **[Sv] Build/type-check reale su Render** — il client Prisma non si genera in sandbox: confermare che `npm run build` e i test passano in pipeline.

## 🟢 Verifiche funzionali (smoke test pre-lancio)

- [ ] **[Pr/Sv] Registrazione → verifica email → login** completa su ambiente prod.
- [ ] **[Pr/Sv] Onboarding cliente** salva le risposte 1:1 e porta alla Home corretta (role/home_route).
- [ ] **[Pr/Sv] Acquisto piano** (carta Stripe LIVE) → webhook → abbonamento attivo → aumenta "clienti gestiti".
- [ ] **[Pr/Sv] Menu del giorno** erogato; test esclusione allergene → blocco/escalation al nutrizionista.
- [ ] **[Pr/Sv] Backoffice**: lead visibile, assegnazione a coach, contabilità, ruoli/permessi.
- [ ] **[Pr] Sito**: selettore lingua (9 lingue) + pagine legali + banner cookie; form lead che arriva nel CRM.
- [ ] **[Pr] Legale**: privacy/cookie/termini pubblicate; nota "versione italiana vincolante" presente.

## 🔵 Contenuti prima del pubblico

- [ ] **[Pr] Team**: nome e CV reali del responsabile scientifico + foto reali di coach/nutrizionista (oggi placeholder).
- [ ] **[Pr] Percorsi alimentari**: contenuti menu per le diete non-mediterranee (Proteica/Low-carb/Keto) validati dal nutrizionista.
- [ ] **[Pr] Revisione madrelingua** delle traduzioni sensibili (RU/ZH/AR) su sito e legali.
- [ ] **[Pr] Prime testimonianze** raccolte con consenso e approvate (compaiono in automatico sul sito).

## ⚪ Subito dopo il lancio (non bloccante)

- [ ] **[Sv] Endpoint dinamici del sito** — collegare `data-i18n-endpoint`, `data-stats-endpoint`, `data-paths-endpoint`, `data-testimonials-endpoint`, `data-blog-endpoint` (le "prese" ci sono già).
- [ ] **[Sv] App Coach e App Nutrizionista dedicate** (front-end) — i backend sono completi; oggi le Home vivono nel backoffice.
- [ ] **[Sv] Modulo Marketing/CRM funzionale + Giudice compliance** (ruoli/menu già presenti).
- [ ] **[Sv] Agenti (dashboard "Agenti" + runtime)** — vedi `../Metabole_Agenti_AI_Spec_Sviluppo.md`.
- [ ] **[Sv] Blog automatizzato** (agente Redattore, 1/giorno) — vedi `../Metabole_Comunicazione_Blog_Agente.md`.
- [ ] **[Sv] Pubblicazione social via API** (Publisher: Meta/Instagram/TikTok…) — vedi `../Metabole_Testimonianze_Social_Publishing.md` (App Review Meta/TikTok da avviare in anticipo).
- [ ] **[Sv/Pr] Prodotti dinamici zero-redeploy** + **piani stagionali estate**.
- [ ] **[Sv] Fase 9 — Certificazione unicità** del motore.

---

### Semaforo
- **Codice**: pronto (backend/app/backoffice/sito).
- **Go-live**: **bloccato** finché non sono chiuse le voci 🔴 (in particolare lead-capture e fix sicurezza) e configurate le voci 🟠.
- Le voci ⚪ non bloccano un lancio iniziale.
