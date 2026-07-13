# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

---

## 2026-07-13

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
