# Metabole — Operazioni sul server (handoff aggiornato)

Guida operativa per lo sviluppatore backend: **cosa costruire lato server** perché i prototipi
attuali funzionino con dati reali. I tre front-end esistono già:
app **cliente** `Metabole_Prototipo_Navigabile.html`, app **coach** `Metabole_Coach_App.html`,
app **nutrizionista** `Metabole_Nutrizionista_App.html`. Complementa — non sostituisce — i due documenti esistenti:

- `Metabole_Specifica_Backend_Sviluppatore.md` → modello dati base, RBAC, motore, roadmap.
- `Metabole_Tracciamento_Dati.md` → mappa evento/campo → entità/endpoint per ogni click.

Qui trovi il **delta operativo** introdotto dai nuovi prototipi (Agenda, Alert coach, dashboard
guadagni, escalation, misure bloccanti, riassunti conversazioni) e l'**ordine di implementazione**.

---

## 1. Stato e obiettivo

Frontend pronto: onboarding + app cliente, app coach (mobile) con dashboard/alert/agenda/chat, doc di
tracciamento con hook `track()`. Manca **tutto il backend**. Obiettivo di questa fase: API-first REST
`/api/v1`, JWT + RBAC, dati sanitari cifrati, hosting UE (Neon/Render come da progetto).

## 2. Ruoli e routing al login (i 4 percorsi)

Un unico endpoint di login che, dal ruolo dell'utente, indirizza il client all'app giusta.

- **Nuova registrazione** → solo cliente (self-service, onboarding).
- **Login cliente** → app cliente.
- **Login coach** → app coach (account creato dal web/backoffice, non self-service).
- **Login nutrizionista** → app nutrizionista (idem).

Cosa fare: `POST /auth/login` restituisce `{token, role, home_route}`. Il frontend usa `role`/`home_route`
per aprire l'esperienza corretta. Coach e nutrizionisti si creano da backoffice (`Staff`), non da
registrazione pubblica. RBAC come da spec (client/coach/nutritionist/head/sales/admin).

## 3. Persistenza onboarding cliente

Tutte le risposte del test, misure, obiettivo, tema colore, piano, data inizio: vedi la tabella
completa in `Metabole_Tracciamento_Dati.md` §3 (campo → entità → endpoint). Regole:

- Ogni domanda salva la sua risposta su `ClientProfile`/entità dedicata (non solo evento).
- `theme_color = "auto"` va salvato come stringa `"auto"` (il colore effettivo si calcola client-side:
  un colore ogni 2 giorni dalla palette a 6).
- Dati sanitari (patologie/farmaci) → `HealthRecord` cifrato + `screening_flag`; consenso obbligatorio.

## 4. Motore, menu e misure bloccanti

- **Erogazione menu a 2 giorni** (`MenuDay`, `visible_from` = 2 giorni prima dell'inizio).
- **Misure obbligatorie al 2° giorno**: la mattina del secondo giorno di ogni menu il cliente deve
  inserire Peso/Vita/Fianchi. Finché mancano:
  - il menu successivo resta `MenuDay.status = held`, `blocked_reason = "missing_measurements"` (non
    erogato);
  - si genera un **Alert alla coach** `{type:"missing_measurements", client_id, coach_id, due_date}`;
  - il client mostra un popup bloccante a ogni riapertura finché la `Measurement` del ciclo non arriva.
- Endpoint: `POST /measurements` (baseline e periodiche) → sblocca l'erogazione e chiude l'alert.

## 5. Alert engine (cuore dell'app coach)

Il server genera gli `Alert` che popolano la coda della coach. Ogni alert:
`{id, client_id, coach_id, group, section, type, priority(high|med|low), title, detail, status(open|handled|escalated), created_at, due_date}`.

Regole di generazione (soglie in `config_param`, mai hardcoded):

| Gruppo | Tipo | Trigger (esempio) | Priorità |
|---|---|---|---|
| Corpo & misure | missing_measurements | misure non inserite al 2° giorno | high |
| Corpo & misure | weight_gain / plateau | +peso in 7gg / nessun calo in 14gg | med |
| Aderenza & vita | inactive | app non aperta da N giorni | high |
| Aderenza & vita | checkin_skipped | check-in saltato 3 giorni | med |
| Aderenza & vita | water_low | acqua sotto soglia N giorni | low |
| Gusto & Mente | low_ratings | ≥3 menu sotto 3 stelle | med |
| Gusto & Mente | dropout_risk | umore basso + attività in calo + carattere "quits" | high |
| Agenda/Esc./Op. | event_incoming | evento cliente entro N giorni | med |
| Agenda/Esc./Op. | escalation_open | tema clinico → nutrizionista (coach vede solo lo stato) | med |
| Agenda/Esc./Op. | new_client / milestone | nuova assegnazione / traguardo (es. -3kg) | low |

Endpoint: `GET /coach/alerts` (coda filtrabile per gruppo/priorità), `PUT /alerts/:id` (handled/escalated).
Job scheduler ricalcola gli alert (es. ogni notte + a ogni evento rilevante).

## 6. Appuntamenti / Agenda

Nuova entità **Appointment** (o riuso di `Visit`): `{id, client_id, staff_id, staff_role(coach|nutritionist),
type(call|televisit|in_person), datetime, status, note}`.

- Il **cliente** vede in Agenda i propri appuntamenti (coach + nutrizionista) e la **scadenza piano**.
- La **coach** vede gli appuntamenti delle sue clienti: i propri (gestibili) e quelli **col
  nutrizionista** (sola lettura).
- Prima visita = in presenza; controlli = televisita (come da spec §API `/visits/:id/start`).
- Endpoint: `GET /me/agenda` (cliente), `GET /coach/agenda`, `POST /appointments`, `GET /me/agenda?next=1`
  (box "prossimo appuntamento" in Home).

## 7. Chat e conversazioni

- `ChatThread` per interlocutore (`ai|coach|nutritionist`) + `Message`. L'AI fa da primo filtro
  (FAQ → risponde/instrada; tema sensibile → **escalation** al nutrizionista).
- Chat coach = **non sanitaria**: contenuti clinici non transitano qui.
- **ConversationSummary**: ogni giorno si chiude la conversazione e se ne salva un riassunto con
  **titolo generato dall'AI** + data (mostrato in "Conversazioni passate" lato cliente e coach).
- Endpoint: `POST /threads/:id/messages`, `GET /threads/:who/summaries`.

## 8. Dashboard coach & guadagni (provvigioni)

La dashboard coach mostra: **clienti gestite**, **piani in scadenza**, **guadagno totale**,
**guadagno del mese**. Serve un motore provvigioni:

- **Commission**: `{staff_id, client_id, purchase_id, amount, period, type(coach|nutritionist), status}`.
  Il calcolo rispetta il flag "provvigioni a: team coaching | nutrizionisti | entrambi" definito sul
  prodotto (vedi `metabole-backlog.md` — shop backoffice).
- Aggregati: `GET /coach/dashboard` → `{clients_count, expiring_plans[], earnings_total, earnings_month}`.
- "Piani in scadenza": clienti con `Purchase.expiry` entro N giorni (già visibile in Agenda cliente).

## 8bis. App nutrizionista (parte clinica)

Il prototipo `Metabole_Nutrizionista_App.html` definisce cosa serve per il ruolo clinico. È l'unico
ruolo che accede ai **dati sanitari** (la coach no).

- **Cartella paziente**: quadro clinico **riservato** (`HealthRecord`: patologie, farmaci,
  allergie/intolleranze), andamento misure, **Documenti** (`Document`: `blood_test|photo`, con
  `flags[]` per valori fuori range → genera alert), **note cliniche** (`ClinicalNote`, riservata),
  **dieta assegnata**. Accesso solo al nutrizionista del paziente (+ capo); coach esclusa.
- **Diete/protocolli**: `Diet` con stato `draft|in_review|approved` (il **capo** approva il catalogo).
  I **protocolli del motore** (adattamenti menu ogni 2 giorni) entrano in una coda di **validazione
  per-paziente**: il nutrizionista approva o modifica prima dell'erogazione.
- **Visite**: prima visita `in_person`, controlli `televisit` (`Visit`, `POST /visits/:id/start`).
- **Alert clinici**: `Alert` di tipo `document_out_of_range`, `escalation` (dalla coach),
  `protocol_to_validate`, `new_screening`. Azioni: apri cartella, gestito.
- **Guadagni nutrizionista**: `Commission` distinte (prime visite, televisite, quota percorsi) +
  storico mensile + "richiedi prelievo".
- Endpoint: `GET /nutritionist/patients[/:id]`, `GET /nutritionist/alerts`, `PUT /diets/:id` (valida),
  `POST /clinical-notes`, `PUT /documents/:id` (revisiona), `GET /nutritionist/agenda`,
  `GET /nutritionist/dashboard`.

## 9. Shop / abbonamenti / scadenze

- `Purchase`/`Subscription`: stato, `expiry`, rinnovo, storico ordini, ricevute.
- `Offer` (es. "porta un'amica"), `Referral` (un mese gratis / provvigioni via `refcod`).
- Endpoint: `POST /purchases`, `GET /me/purchases`, `POST /referrals`.

## 10. Eventi / tracciamento

- `POST /api/v1/events` (append-only). Il frontend già invia tutto tramite `track()` (vedi
  `Metabole_Tracciamento_Dati.md`). Aggiungere `event_id` UUID per idempotenza e `user_id` dal token.
- Usarli per funnel, drop-off, A/B test sulle soglie (`config_param`).

## 11. Entità nuove/aggiornate (delta schema)

Da aggiungere a quelle già in spec: **Event**, **Alert**, **DailyCheckin**, **Appointment** (o estensione
`Visit`), **ConversationSummary**, **Commission**, **Offer/Referral**, **Notification**, **ShoppingList**,
**HealthRecord** (contenitore cifrato). Campi chiave indicati nelle sezioni 5–10 e in
`Metabole_Tracciamento_Dati.md` §6.

## 12. Endpoint — riepilogo

```
POST /auth/register | login                      # login restituisce role + home_route
PUT  /profile        POST /measurements  POST /goals   POST /health
GET  /me/agenda[?next=1]   POST /appointments
POST /ratings        POST /checkins
POST /threads/:id/messages   GET /threads/:who/summaries
GET  /coach/alerts   PUT /alerts/:id
GET  /coach/dashboard   GET /coach/agenda   GET /coach/clients   GET /coach/clients/:id
GET  /nutritionist/patients[/:id]   GET /nutritionist/alerts   GET /nutritionist/dashboard   GET /nutritionist/agenda
PUT  /diets/:id (valida)   POST /clinical-notes   PUT /documents/:id (revisiona)   POST /visits/:id/start
GET  /commissions   POST /commissions/withdrawal   # guadagni coach/nutrizionista + richiesta prelievo
POST /purchases   GET /me/purchases   POST /referrals
POST /events
```
Tutto sotto JWT + RBAC; dati sanitari filtrati per relazione cliente–nutrizionista (coach esclusa).

## 13. Sicurezza / GDPR / permessi

- RBAC a livello di risorsa: coach vede solo le sue clienti; nutrizionista solo i suoi pazienti.
- Dati sanitari cifrati a riposo e in transito, accessibili solo a cliente + suo nutrizionista (+ capo);
  la coach vede solo lo **stato** delle escalation, mai il contenuto.
- Consensi versionati; `AuditLog` su accessi ai dati clinici e su modifiche di obiettivo/piano.
- Ogni nuova pagina di backoffice va aggiunta ai permessi (vedi `metabole-backlog.md`).

## 14. Ordine di implementazione (milestone)

1. **Auth + ruoli + routing login** (4 percorsi) + `Staff`/backoffice minimo per creare coach/nutrizionisti.
2. **Persistenza onboarding cliente** (profilo, misure, obiettivo, consensi, tema) + `POST /events`.
3. **Motore menu**: erogazione 2 giorni + **misure bloccanti** + alert `missing_measurements`.
4. **Alert engine** completo (tutte le regole §5) + `PUT /alerts`.
5. **App coach — API**: `/coach/alerts`, `/coach/clients(:id)`, chat non sanitaria, `/coach/agenda`,
   `/coach/dashboard` (con provvigioni).
6. **Appuntamenti/Agenda** lato cliente (+ box "prossimo appuntamento") e visibilità coach.
7. **Shop/abbonamenti/scadenze** + referral/provvigioni.
8. **App nutrizionista — API**: `/nutritionist/patients(:id)` (cartella clinica), `/nutritionist/alerts`,
   validazione diete/protocolli, note cliniche, documenti, `/nutritionist/agenda`, `/nutritionist/dashboard`.
9. **Provvigioni/guadagni** (coach e nutrizionista) + richiesta prelievo.

> Nota: i tre front-end (cliente, coach, nutrizionista) sono già prototipati e allineati nello stile.
> La parte clinica (documenti, note, diete, validazioni) è esclusiva del nutrizionista; la coach vede
> solo lo stato delle escalation, mai il contenuto sanitario.
