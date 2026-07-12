# Metabole — Tracciamento dati (handoff per lo sviluppatore)

Come persistere su database/server **ogni decisione, input e click** che l'utente compie nel
prototipo (`Metabole_Prototipo_Navigabile.html`). Il frontend espone già un unico punto di aggancio
(`track()`); qui c'è la mappa completa evento → dato → entità → endpoint, allineata al modello dati
di `Metabole_Specifica_Backend_Sviluppatore.md`.

---

## 1. Due livelli di registrazione

1. **Eventi (append-only, analitici).** Ogni click/interazione va inviato come evento immutabile a
   `POST /api/v1/events`. Serve per funnel, drop-off, A/B test, audit comportamentale. Nel prototipo
   passa **tutto** dalla funzione `track(event, data)`.
2. **Dati di dominio (autorevoli).** Le decisioni che cambiano lo stato dell'utente (risposte del
   test, misure, obiettivo, valutazioni, acquisti…) vanno **anche** salvate sulle entità di dominio
   via endpoint dedicati (PUT/POST), perché il motore e i professionisti ci lavorano sopra.

Regola pratica: *se una cosa cambia cosa vede o riceve l'utente → dominio + evento; se è solo
navigazione/curiosità → basta l'evento.*

---

## 2. Convenzioni tecniche

**Envelope evento** (già prodotto dal prototipo):
```json
{ "event": "ui_click", "ts": 1720700000000, "session": "sess_ab12",
  "phase": "flow|app", "step": 7, "screen": "home",
  "data": { "nav": null, "store": "why", "value": "Salute ed energia", "text": "…" } }
```
- `user_id`: aggiungerlo lato server dal token JWT (nel prototipo non c'è auth). Prima del login usare
  `session` + eventuale `refcod` per riconciliare al momento della registrazione.
- **Idempotenza**: ogni evento porti un `event_id` UUID (da aggiungere) per gestire i retry.
- **Timestamp**: `ts` client + `received_at` server.
- **refcod**: se l'utente arriva da `?ref=CODICE`, propagarlo su tutti gli eventi e legarlo al cliente
  alla registrazione (attribuzione commerciale/provvigioni).
- **Consensi**: nessun dato sanitario persiste senza consenso privacy registrato (vedi §5).

---

## 3. Mappa onboarding (flusso `F`)

| # | Schermata | Azione utente | Dati da salvare | Entità / campo | Endpoint | Segnale motore |
|---|---|---|---|---|---|---|
| 1 | Benvenuto | view; click "Registrati" / "Accedi" | funnel | Event | POST /events | — |
| 2 | In cosa siamo diversi | view; "Sono pronta/o" | funnel | Event | POST /events | — |
| — | Accedi (login) | email + password | sessione | Auth | POST /auth/login | — |
| 3 | Crea account | Nome, Cognome, Email, Password, **refcod**, Apple/Google | credenziali + profilo base | User, ClientProfile.name, refcod | POST /auth/register | — |
| 4 | Facciamo conoscenza | view | funnel | Event | POST /events | — |
| 5a | Mente · Perché inizi | scelta (`data-store="why"`) | motivazione | ClientProfile.why | PUT /profile | Mente |
| 5b | Mente · Come seguita | frequenza coach | coach_style (`daily/when_needed/on_request`) | ClientProfile.coach_style | PUT /profile | Mente |
| 5c | Mente · Carattere | scelta | character (`follows/needs_push/perseveres/quits`) | ClientProfile.character | PUT /profile | Mente |
| 6 | Vita · Lavoro | lavoro + tempo cucina + dove pranzi (svelamento progressivo) | 3 campi | ClientProfile.work, cook_time, lunch_place | PUT /profile | Vita |
| 7 | Vita · Percorso pasti | 5 pasti / 3 pasti / con integratori (digiuno **disabilitato**) | meals_per_day, supplements, path_type | ClientProfile.meals_per_day, path_type | PUT /profile | Vita |
| 8 | Agenda · Periodi senza dieta | aggiunta eventi (nome + date) | eventi | CalendarEvent[] | POST /calendar-events | Agenda |
| 9 | Gusto · Regime | onnivoro/veg/vegan | regime | ClientProfile.regime | PUT /profile | Gusto |
| 10 | Gusto · Stile | mediterranea/proteica/low-carb/flessibile | diet_style | ClientProfile.diet_style | PUT /profile | Gusto |
| 11 | Gusto · Cibi che non ami | testo libero | esclusioni | ClientProfile.disliked_foods[] | PUT /profile | Gusto |
| 12 | Corpo · Chi sei | Nome, Età, Sesso, Altezza | anagrafica | ClientProfile.age, sex, height_cm | PUT /profile | Corpo |
| 13 | Corpo · Punto di partenza | Peso, Vita, Fianchi iniziali | misure T0 | Measurement (baseline) | POST /measurements | Corpo |
| 14 | Corpo · Intolleranze/allergie | multi-scelta | intolerances[] | ClientProfile.intolerances[] | PUT /profile | Corpo |
| 15 | Corpo · Salute | patologie + farmaci | **dato sanitario** | HealthRecord + screening_flag | POST /health (cifrato) | Corpo (supervisione) |
| 16 | Corpo · Obiettivo | kg, entro settimane, cm vita, cm fianchi (guardrail) | obiettivo iniziale | Goal (initial) | POST /goals | Corpo |
| 17 | Colore app | swatch o **Auto** (`data-c`) | tema | ClientProfile.theme_color (`#hex` o `"auto"`) | PUT /profile | — |
| 18 | Elaborazione | view + countdown | funnel | Event | POST /events | — |
| 19 | Percorso pronto | view | assegnazioni | ClientProfile.assigned_coach_id, assigned_nutritionist_id | (server-side) | — |
| 20 | Coach in video | view / play | funnel | Event | POST /events | — |
| 21 | Nutrizionista in video | view / play | funnel | Event | POST /events | — |
| 22 | Anteprima menu | view; toggle Ricetta/Consiglio | funnel + interesse ricette | Event | POST /events | (Gusto, debole) |
| 23 | Piano | scelta 1 mese / 3 mesi | intenzione acquisto | Cart/PurchaseIntent | POST /purchase-intent | — |
| 24 | Pagamento | Indirizzo spedizione + metodo pagamento | ordine + indirizzo | Purchase, Address | POST /purchases | — |
| 25 | Data inizio | data di partenza | plan_start_date | ClientProfile.plan_start_date | PUT /profile | — |
| 26 | Tutto pronto | "Installa widget" | funnel | Event | POST /events | — |

> Nota: nel prototipo solo `why` e `pasti` sono realmente memorizzati in `state`. In produzione
> **ogni** domanda deve inviare la sua risposta (colonna "Entità/campo"). Le chiavi-campo vanno
> assegnate 1:1 alle domande dell'array `SURVEY`.

---

## 4. Mappa app (dopo il login)

| Schermata | Azione | Dati | Entità / campo | Endpoint | Note |
|---|---|---|---|---|---|
| Home | check-in mattino step 1: **valuta menu di ieri** (stelle + "seguita sì/no") | valutazione + aderenza | RecipeRating (stars, followed) | POST /ratings | segnale Gusto + aderenza |
| Home | check-in mattino step 2: **umore** | mood del giorno | DailyCheckin.mood | POST /checkins | benessere |
| Home | Help → "Ho fame / Mangio fuori / Sostituisci" | richiesta di aiuto | Event (+ eventuale ticket a Gaia) | POST /events | può generare azione AI |
| Home | Lista spesa (spunta item) | stato spesa | ShoppingList.items[].checked | PUT /shopping-list | — |
| Home/hero | tap coach (cambia stato/voce) | funnel | Event | POST /events | — |
| Percorso | apri menu passato (rullino) | consultazione | Event | POST /events | — |
| Percorso | dentro il dettaglio: stelle + "ricetta seguita?" | valutazione storica | RecipeRating | POST /ratings | Gusto |
| Percorso | aggiungi/gestisci evento futuro | evento | CalendarEvent | POST /calendar-events | Agenda |
| Obiettivi | **Misure di oggi** (Peso/Vita/Fianchi) → Invia | misure periodiche | Measurement | POST /measurements | motore (medie mobili) |
| Obiettivi | "Modifica / fissa nuovo obiettivo" | nuovo obiettivo (versionato) | Goal (nuova versione) | POST /goals | guardrail sostenibilità |
| Contatti | apri chat (Gaia / Coach / Nutrizionista) | messaggi | ChatThread + Message | POST /threads/{id}/messages | dati sanitari solo nutrizionista |
| Contatti | **Conversazioni passate** | storico | ConversationSummary (date, titolo AI) | GET /threads/{who}/summaries | 1 conversazione/giorno, titolata dall'AI |
| Shop | Rinnova / Acquista / Invita amica | acquisto/referral | Purchase, Referral | POST /purchases, POST /referrals | provvigioni via refcod |
| Header | Notifiche (segna lette) | stato notifiche | Notification.read_at | PUT /notifications | — |
| Header | Allert (azioni non fatte → "Aggiorna/Valuta/Registra") | to-do generati da regole | Alert (stato) | PUT /alerts | vedi §5 |
| Profilo | cambia Email / Telefono / **Colore app** | profilo | User.email, phone, theme_color | PUT /profile | verifica email/telefono |

---

## 5. Regole speciali (importanti)

**Misure obbligatorie al 2° giorno di ogni menu.** La mattina del secondo giorno compare un popup
**bloccante** che chiede Peso/Vita/Fianchi. Regole backend:
- Il menu successivo **non viene erogato** finché non arrivano le misure (`MenuDay.status = held`,
  `blocked_reason = "missing_measurements"`).
- Alla comparsa/mancata compilazione si genera un **Alert alla coach**
  (`Alert{type:"missing_measurements", client_id, coach_id, due_date}`).
- Il popup **ricompare a ogni riapertura** dell'app finché `Measurement` del ciclo non è salvata.
- Nel prototipo: flag `state.needMeasures`, popup `MEASURES()`, sblocco su `data-savmis`.

**Valutazioni → motore Gusto.** Ogni `RecipeRating` (stelle + "seguita sì/no") alimenta il segnale
Gusto e l'aderenza: piatti con voto alto riproposti più spesso, voto basso evitati. "Non seguita" è
un segnale di attrito da passare a coach/AI.

**Dati sanitari.** Patologie, farmaci, note cliniche: cifrati a riposo, accessibili **solo** a
cliente e suo nutrizionista, mai alla coach. Consenso privacy esplicito prima del salvataggio;
`screening_flag` attiva il percorso supervisionato.

**refcod / commerciale.** Propagare su eventi e legarlo al cliente alla registrazione per
attribuzione e provvigioni (vedi anche `metabole-backlog.md`).

**Colore "Auto".** `theme_color = "auto"` significa rotazione automatica: il colore effettivo è
`PALETTE[floor(giorni_epoch/2) % 6]` (un colore nuovo ogni 2 giorni). Salvare `"auto"`, non il colore
calcolato.

**Chat/AI supervisore.** Gaia registra ogni indicazione e, quando serve, apre un Alert verso la
persona più adatta (coach o nutrizionista). Ogni giorno chiude la conversazione e ne salva un
riassunto con titolo generato dall'AI (`ConversationSummary`).

---

## 6. Entità DB (delta rispetto allo spec backend)

Già previste in `Metabole_Specifica_Backend_Sviluppatore.md`: `User`, `ClientProfile`, `Measurement`,
`Diet`, `Recipe`, `MenuDay`, `RecipeRating`, `Goal`, `CalendarEvent`, `Purchase`, `Consent`, `AuditLog`.

Da aggiungere/estendere per il tracciamento:
- **Event**: `id`, `event`, `user_id?`, `session`, `refcod?`, `phase`, `screen`, `step`, `data` (jsonb),
  `ts`, `received_at`. Append-only, partizionata per data.
- **DailyCheckin**: `client_id`, `date`, `mood`, `menu_rating_done` (bool).
- **Alert**: `id`, `client_id`, `target_role` (coach/nutrizionista), `type`, `payload`, `status`
  (`open/seen/resolved`), `due_date`.
- **ChatThread / Message / ConversationSummary**: thread per interlocutore; summary giornaliero con
  `title` (AI), `date`.
- **ShoppingList**, **Notification**, **Referral**, **PurchaseIntent**: come da tabelle sopra.
- **HealthRecord**: contenitore cifrato dei dati sanitari (separato dal profilo).

---

## 7. Endpoint REST (riepilogo)

```
POST /api/v1/events                      # tutti gli eventi (append-only)
POST /api/v1/auth/register | login
PUT  /api/v1/profile                     # risposte test, anagrafica, coach_style, theme_color, plan_start_date
POST /api/v1/measurements                # baseline + aggiornamenti periodici
POST /api/v1/goals                       # obiettivo iniziale + nuovi (versionati)
POST /api/v1/health                      # dati sanitari (cifrati, consenso obbligatorio)
POST /api/v1/calendar-events
POST /api/v1/ratings                     # RecipeRating (stars, followed)
POST /api/v1/checkins                    # umore giornaliero
POST /api/v1/purchase-intent | purchases | referrals
POST /api/v1/threads/{id}/messages   GET /api/v1/threads/{who}/summaries
PUT  /api/v1/alerts | notifications | shopping-list
```
Tutto sotto auth JWT (tranne register/login/events pre-auth con session+refcod). RBAC per ruolo; i
dati sanitari filtrati per relazione cliente–nutrizionista.

---

## 8. Dove sono le "chiamate" nel prototipo

- **`track(event, data)`** — unico hook: sostituire il corpo con `sendBeacon('/api/v1/events', …)`.
  Cerca `function track(` nel file.
- **Listener delegato** in `wire()` (cerca `root._mbtrack`): cattura ogni click su elementi con
  `data-nav`, `data-store`, `data-chat`, `data-open`, `data-c`, `.opt`, `.sw`, `#cta`, ecc. e chiama
  `track('ui_click', …)`.
- **Decisioni di dominio**: i valori scelti sono negli attributi `data-*` e in `state` (es.
  `state.why`, `state.pasti`, `state.brand`, `state.needMeasures`). In produzione ogni handler che
  oggi aggiorna `state` deve anche chiamare l'endpoint di dominio corrispondente (colonna Endpoint).
- Apri la **console** del browser: vedrai gli eventi `[track] …` in tempo reale mentre navighi — sono
  esattamente i payload da inviare.

---

## 9. Privacy, consensi, audit

- Consenso privacy e (se serve) sanitario **prima** di salvare i relativi dati; versionare i consensi.
- `AuditLog` su accessi ai dati sanitari e su ogni modifica di obiettivo/piano.
- Minimizzazione: gli eventi non devono contenere dati sanitari in chiaro nel campo `data`.
- Hosting UE, cifratura a riposo e in transito (GDPR), come da regole di progetto.
