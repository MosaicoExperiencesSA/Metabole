# Metabole — Smoke test go-live

Due parti: **(A) smoke API automatico** (script) e **(B) flussi funzionali manuali**. In fondo, i **risultati della sonda live** di oggi.

Backend prod: `https://metabole-backend.onrender.com` · App: `app.metabole.eu` · Backoffice: backoffice Vercel.

---

## A. Smoke API automatico — `scripts/metabole_smoke.sh`

Esegui **da una macchina con rete** (tuo Mac o Simone), non serve login:
```bash
BASE=https://metabole-backend.onrender.com ./scripts/metabole_smoke.sh
```
Controlla: `/health` (status+db), `/api/v1/plans`, `/api/v1/products`, `/api/v1/payment-methods`, `POST /api/v1/public/leads` (blocker #1: 2xx quando pronto, 404 se ancora assente), e che un endpoint protetto risponda 401/403 senza token. Esce 0 se tutto ok.

> L'ho lanciato dalla sandbox ma la rete è ristretta (curl bloccato): giralo tu in locale. I risultati reali via fetch sono qui sotto.

---

## B. Flussi funzionali manuali (da fare quando chiavi/config sono live)

### B1 — Account & email
- [ ] Registrazione nuovo cliente su `app.metabole.eu` → arriva **email di verifica** (inbox, non spam) → conferma → **login** ok.
- [ ] Reset password: richiesta → email → nuova password → login.
> Se le email non arrivano/finiscono in spam ⇒ manca SPF/DKIM su Brevo (blocker).

### B2 — Onboarding
- [ ] Completo l'onboarding: le risposte si **salvano 1:1** e l'utente arriva alla Home corretta (in base al ruolo).
- [ ] Ricarico la pagina: i dati inseriti restano.

### B3 — Pagamento (Stripe LIVE)
- [ ] Acquisto un piano → redirect a Stripe Checkout → pago con **carta reale** (o carta di test se ancora in test).
- [ ] Torno all'app: **abbonamento attivo**; in backoffice l'acquisto risulta e il pagamento è registrato (webhook ok).
- [ ] Ricevuta PDF generata.
> Se l'abbonamento non si attiva dopo il pagamento ⇒ webhook non configurato (blocker).

### B4 — Motore menu
- [ ] Home cliente mostra il **menu del giorno**.
- [ ] Imposto un'**allergia/intolleranza** presente in un piatto → il piatto viene **sostituito** (nota) o, se non sostituibile, **bloccato** con escalation al nutrizionista (la coach lo vede negli alert).

### B5 — Backoffice
- [ ] Login staff → **lead visibile** in CRM; assegnazione a una coach.
- [ ] Contabilità, ruoli/permessi, calendario reminder funzionano.
- [ ] Dashboard grafici caricano dati reali.

### B6 — Sito pubblico
- [ ] Selettore lingua (9 lingue) + banner cookie + pagine legali aprono.
- [ ] **Form lead** del sito: invio con dati veri → il lead **arriva nel CRM** (dipende dall'endpoint pubblico, blocker #1). Con endpoint assente, il form mostra il **fallback email** (corretto) e NON un falso "Grazie".
- [ ] Form **Lavora con noi**: stesso comportamento.

### B7 — Sicurezza (spot check)
- [ ] Un nutrizionista **non** può aprire/validare decisioni di pazienti **non assegnati** (fix scoping `/engine/decisions`).
- [ ] Endpoint protetti rispondono 401/403 senza token.

---

## C. Sonda live di oggi (2026-07-14, via fetch)

| Check | Esito |
|---|---|
| `GET /health` | ✅ `{"status":"ok","database":"up","version":"0.1.0"}` — backend up, DB up |
| `GET /api/v1/plans` | ✅ 3 piani reali (3m €297 · 6m €497 · 12m €797) |
| `GET /api/v1/payment-methods` | ✅ `{"card":true,"bank_transfer":true}` |
| `POST /api/v1/public/leads` | ⚠️ non risponde — **endpoint non ancora implementato** (blocker #1, atteso: lo fa Simone) |

**Lettura:** l'infrastruttura backend è **online e funzionante** (health, DB, piani, metodi di pagamento). Restano da verificare, con ambiente configurato, i flussi B1–B7; l'unico gap API già evidente è l'endpoint pubblico lead (in carico a Simone, verifica pianificata per domani).
