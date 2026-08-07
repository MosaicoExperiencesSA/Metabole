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

## ✅ Gate di apertura — CHIUSI il 16/07 (verificato in `progetto/STATO_LANCIO.md`)

> Aggiornato il 6/8: questi quattro punti erano rimasti segnati in rosso pur essendo stati
> confermati il 16 luglio. Li chiudo qui perché una checklist che mente si smette di leggere.

- [x] **[Ops] Stripe in modalità LIVE** — chiave `sk_live` e webhook `checkout.session.completed` su Render; **pagamento reale eseguito** (16/07).
- [x] **[Ops] Email Brevo + DNS** — SPF · DKIM brevo1/2 · DMARC · codice Brevo verificati (16/07).
- [x] **[Ops/Sv] Backoffice raggiungibile** — `backoffice.metabole.eu` live, accessi per ruolo verificati (16/07).
- [x] **[Ops] Push / Firebase** — FCM configurate; Android funzionante, **iOS riparate il 6/8** (mancavano i metodi del delegato: la 2.0 non registrava il token).

## 🟢 Smoke test finale (30 min, su prod)

- [ ] **[Pr/Sv]** Registrazione → email (inbox) → login.
- [ ] **[Pr/Sv]** Onboarding: risposte salvate 1:1 → Home corretta.
- [ ] **[Pr/Sv]** Acquisto piano con **carta reale** → webhook → abbonamento attivo → "clienti gestiti" +1.
- [ ] **[Pr/Sv]** Menu del giorno erogato; test **esclusione allergene** → blocco/escalation al nutrizionista.
- [ ] **[Pr/Sv]** Backoffice: lead visibile, assegnazione a coach, contabilità, ruoli.
- [ ] **[Pr]** Sito: form lead che **arriva davvero nel CRM**.

## 🔵 Contenuti prima del pubblico [Pr]

- [ ] **Team**: nome/CV reali del responsabile scientifico + foto reali coach/nutrizionista (oggi placeholder).
- [ ] **Menu Keto**: già approvati dal nutrizionista e caricati nel motore (nessuna azione contenuti residua).
- [ ] **Revisione madrelingua** traduzioni sensibili (RU/ZH/AR) su sito e legali.
- [ ] **Prime testimonianze** con consenso (compaiono in automatico sul sito).

## 🟠 Pulizie [Sv] (non bloccanti)

- [ ] `app/.env.example` · rimuovere `backend/prisma/schema_1.prisma` · confermare build/test in pipeline (incl. `seed_keto.spec.ts`) · URL cron in `render.yaml` se dominio custom.

## ⚪ Subito dopo il lancio (non bloccante)

- [ ] Endpoint dinamici del sito (i18n/stats/paths/testimonials/blog) · App Coach/Nutrizionista dedicate · **Motore Fase B R8–R12** (E1 in corso: allergeni ricette già fatti da Simone) · Marketing/CRM + Giudice · Blog automatizzato · Publisher social · prodotti dinamici + piani stagionali · certificazione unicità.

---

### Semaforo
- **Infrastruttura**: **live** (backend, DB, pagamenti, app, sito).
- **Go-live**: **aperto**. Le 4 conferme (Stripe LIVE, email/DNS, backoffice, FCM) sono chiuse dal 16/7 e lo smoke test è 🟢. *(questa riga le dava ancora 🔴 fino al 6/8, in contraddizione con la sezione qui sopra nello stesso file)*
- Contenuti 🔵 completabili anche subito dopo l'apertura; voci ⚪ non bloccano.
