# Metabole — Checklist Go-Live

Sequenza operativa per il lancio in produzione. Spunta man mano.
Legenda responsabili: **[Sv]** = Sviluppo (Simone) · **[Pr]** = Prodotto (Antonio) · **[Ops]** = configurazione pannelli servizi.
Aggiornata: 2026-07-14 (verifica live).

> **Stato in una riga:** l'infrastruttura è **in piedi e live**. Restano da confermare **Stripe in modalità LIVE**, la **deliverability email (Brevo+DNS)**, lo **smoke test end-to-end con pagamento reale** e i **contenuti** (team, testimonianze). Tecnicamente si può lanciare.

---

## ✅ Verificato LIVE il 14/07

- [x] **Backend in produzione** — `/health` ok, `/plans` restituisce i **3 piani reali** (€297 / €497 / €797). → DB **Neon prod configurato e seedato**.
- [x] **Pagamenti configurati** — `/payment-methods` = carta + bonifico attivi (Stripe collegato).
- [x] **App cliente live** — `app.metabole.eu` risponde (front-end deployato su Vercel).
- [x] **Sito live** — metabole.eu (9 lingue, legali, form lead) + endpoint pubblico `/public/leads` attivo.
- [x] **Blocker di codice chiusi** — endpoint lead, form sito collegati, scoping per-paziente.
- [x] **Utenze staff reali** create in produzione (admin + Responsabile Coach + 12 coach, obbligo cambio password).

## 🔴 Da confermare prima di aprire al pubblico (verifica, non sviluppo)

- [ ] **[Ops] Stripe in modalità LIVE** — confermare che le chiavi siano `sk_live_…` (non test) e che il **webhook di produzione** sia registrato. Fare **un pagamento reale** di prova.
- [ ] **[Ops] Email Brevo + DNS** — registrazione di prova: l'email di verifica arriva **in inbox, non spam** (SPF/DKIM/DMARC attivi sul dominio).
- [ ] **[Ops/Sv] Backoffice raggiungibile** — confermare deploy e accesso (coach/nutrizionista/admin) su `backoffice.metabole.eu`.
- [ ] **[Ops] Push / Firebase** — FCM configurate **oppure** push disattivate per il lancio (non bloccante).

## 🟢 Smoke test finale (30 min, su prod)

- [ ] **[Pr/Sv]** Registrazione → email (inbox) → login.
- [ ] **[Pr/Sv]** Onboarding: risposte salvate 1:1 → Home corretta.
- [ ] **[Pr/Sv]** Acquisto piano con **carta reale** → webhook → abbonamento attivo → "clienti gestiti" +1.
- [ ] **[Pr/Sv]** Menu del giorno erogato; test **esclusione allergene** → blocco/escalation al nutrizionista.
- [ ] **[Pr/Sv]** Backoffice: lead visibile, assegnazione a coach, contabilità, ruoli.
- [ ] **[Pr]** Sito: form lead che **arriva davvero nel CRM**.

## 🔵 Contenuti prima del pubblico [Pr]

- [ ] **Team**: nome/CV reali del responsabile scientifico + foto reali coach/nutrizionista (oggi placeholder).
- [ ] **Menu Keto**: firma finale del nutrizionista sulle **grammature** (il catalogo è già nel motore).
- [ ] **Revisione madrelingua** traduzioni sensibili (RU/ZH/AR) su sito e legali.
- [ ] **Prime testimonianze** con consenso (compaiono in automatico sul sito).

## 🟠 Pulizie [Sv] (non bloccanti)

- [ ] `app/.env.example` · rimuovere `backend/prisma/schema_1.prisma` · confermare build/test in pipeline (incl. `seed_keto.spec.ts`) · URL cron in `render.yaml` se dominio custom.

## ⚪ Subito dopo il lancio (non bloccante)

- [ ] Endpoint dinamici del sito (i18n/stats/paths/testimonials/blog) · App Coach/Nutrizionista dedicate · **Motore Fase B R8–R12** (E1 in corso: allergeni ricette già fatti da Simone) · Marketing/CRM + Giudice · Blog automatizzato · Publisher social · prodotti dinamici + piani stagionali · certificazione unicità.

---

### Semaforo
- **Infrastruttura**: **live** (backend, DB, pagamenti, app, sito).
- **Go-live**: pronti, subordinato alle **4 conferme 🔴** (Stripe LIVE, email/DNS, backoffice, FCM) e allo **smoke test 🟢**.
- Contenuti 🔵 completabili anche subito dopo l'apertura; voci ⚪ non bloccano.
