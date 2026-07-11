# Metabole — Specifica tecnica del backend

Documento di handoff per lo sviluppatore backend. Metabole è una **web app** (desktop + mobile) di dimagrimento "stile di vita": un percorso continuativo in cui un **motore intelligente** adatta il menu giorno per giorno, una **coach** motiva e un **nutrizionista** presidia la parte sanitaria. Il frontend/prototipo cliccabile esiste già (`Metabole_Prototipo_Navigabile.html`): questo documento definisce cosa deve fare il **backend**.

> Nota: questa è una specifica di ingegneria, non una consulenza legale. Le regole su dispositivo medico, prima visita e dati sanitari sono un orientamento: i testi di consenso e gli obblighi esatti li fornisce il legale/consulente privacy del cliente.

---

## 0. Come usare questo documento con Claude Code

1. Metti questo file nel repository (es. `docs/BACKEND_SPEC.md`) e referenzialo da un `CLAUDE.md` di progetto.
2. Sviluppa **per domini** seguendo la Roadmap (sezione 13): un dominio per volta, con test.
3. Il frontend è già prototipato: il backend è **API-first** (REST/JSON). Il prototipo HTML mostra schermate e flussi; questo doc definisce dati e contratti.
4. Ogni valore-soglia del motore è **configurabile a runtime** (tabella `config_param`), mai hardcodato.

Esempio di `CLAUDE.md` iniziale da mettere in root:

```
# Metabole backend
Stack: Node.js + TypeScript + NestJS + PostgreSQL (Prisma). Auth JWT. Hosting UE.
Regole: API-first REST, RBAC per ruolo, tutti i dati sanitari cifrati, ogni soglia del motore in config_param.
Segui docs/BACKEND_SPEC.md. Sviluppa un dominio alla volta con test (Jest). Migrazioni Prisma versionate.
```

---

## 1. Contesto e obiettivo

- **Posizionamento:** benessere/stile di vita, NON dispositivo medico. Nessun claim terapeutico. I casi clinici vengono instradati al nutrizionista.
- **Cuore differenziante:** il motore che, ogni 2 giorni, combina i segnali della persona (corpo, testa, vita, agenda, gusto) e adatta *cosa* mangiare, *come* comunicarlo e *quando* notificare — dentro protocolli validati dal nutrizionista.
- **Scala attesa:** decine di migliaia di clienti (la piattaforma precedente aveva 24.000 utenti). Progettare per multi-tenant leggero (un'unica azienda, molti utenti) e multilingua.

---

## 2. Architettura generale

- **API-first**: backend REST/JSON stateless; il frontend web (e in futuro eventuali app) consuma le stesse API.
- **Separazione ruoli**: un unico backend, autorizzazioni per ruolo (RBAC). Aree: Cliente, Coach, Nutrizionista, Nutrizionista Capo, Commerciale, Amministrazione/Admin.
- **Componenti principali:**
  - API applicativa (dominio clienti, menu, motore, chat, calendario, documenti).
  - Motore di regole (rules engine) configurabile, con logica deterministica + eventuale layer AI di supporto.
  - CRM + fatturazione/contabilità.
  - Job scheduler (notifiche, sblocco menu, medie mobili, alert).
  - Storage file cifrato (documenti sanitari).
  - Modulo televisite (video) per i controlli.
- **Ambienti:** dev, staging, prod. Tutto in **UE** (hosting e storage) per il GDPR.

---

## 3. Stack tecnologico consigliato

Scelta pensata per produttività con Claude Code e maturità dell'ecosistema. Sono indicazioni: verificare le versioni correnti.

| Area | Consigliato | Alternative |
|---|---|---|
| Linguaggio/Runtime | Node.js + TypeScript | Python |
| Framework API | NestJS (strutturato, DI, RBAC) | Express, Fastify · FastAPI (Python) |
| Database | PostgreSQL | — |
| ORM/Migrazioni | Prisma | TypeORM, Drizzle |
| Auth | JWT (access + refresh), password hashing (argon2/bcrypt) | OAuth2/OIDC provider gestito |
| File storage | S3-compatibile in UE (cifratura a riposo) | storage del cloud provider UE |
| Pagamenti | Stripe (o PSP con SEPA) | provider locale |
| Video televisite | Provider WebRTC (es. Daily/Whereby/Twilio) | integrazione dedicata |
| Notifiche | Web Push + email transazionale; SMS opzionale | provider gestito |
| Job/cron | Coda (BullMQ/Redis) + scheduler | cron gestito |
| Cache/coda | Redis | — |
| Hosting | Cloud con region UE | — |
| Osservabilità | Log strutturati + Sentry + metriche | — |

**Principi:** privacy by design; cifratura dati a riposo e in transito (TLS); segreti in vault/variabili d'ambiente; migrazioni versionate; test automatici.

---

## 4. Ruoli, autenticazione e permessi (RBAC)

Gerarchia: **Nutrizionista Capo → Nutrizionisti → Coach → Clienti**; a supporto **Commerciale** e **Amministrazione/Admin**.

| Ruolo | Può fare | NON può |
|---|---|---|
| `client` | Gestire il proprio profilo, misure, check-in, menu, valutazioni, chat, calendario, documenti, acquisti | Vedere dati di altri |
| `coach` | Vedere le clienti assegnate (andamento, aderenza, alert), chat non sanitaria, escalation al nutrizionista | Vedere note cliniche e documenti sanitari riservati |
| `nutritionist` | Cartelle dei propri pazienti, validare protocolli/regole Aui, verifiche a campione, televisite di controllo, proporre diete | Approvare le proprie diete nel catalogo (lo fa il capo) |
| `head_nutritionist` | Tutto del nutrizionista + supervisione team, approvazione diete nel catalogo, gestione escalation | — |
| `sales` | Gestione lead, CRM, dashboard incassi/conversioni | Dati sanitari clinici |
| `admin` | Utenti, assegnazioni, parametri motore, contabilità, catalogo | Accesso alle note cliniche se non autorizzato |

Requisiti:
- **RBAC a livello di risorsa**: un coach vede solo le clienti assegnate; un nutrizionista solo i propri pazienti.
- **Separazione dati sanitari**: note cliniche e documenti (analisi, foto) sono accessibili solo a cliente e suo nutrizionista (e capo). La coach NON li vede.
- **Audit log** di ogni accesso/azione su dati sanitari e di ogni decisione del motore.
- Auth: login email/password (+ social opzionale), verifica email, reset password, access token breve + refresh token, logout/revoca.

---

## 5. Modello dati

Entità principali (campi essenziali; aggiungere `id`, `created_at`, `updated_at`, soft-delete dove utile). Nomi in inglese.

### Utenti e profili
- **User**: `id`, `email` (unique), `password_hash`, `role`, `locale`, `status`, `email_verified_at`.
- **Staff** (per coach/nutritionist/head/sales): `user_id`, `display_name`, `specialties`, `bio`, `head_nutritionist_id` (per i nutrizionisti), `active`.
- **ClientProfile**: `user_id`, `name`, `age`, `sex`, `height_cm`, `regime` (`omnivore|vegetarian|vegan`), `diet_style`, `meals_per_day` (3/4/5), `path_type` (`classic3|five|supplements|intermittent_fasting`), `coach_style` (`daily|when_needed|on_request`), `character` (`follows|needs_push|perseveres|quits`), `intolerances[]`, `disliked_foods[]`, `theme_color`, `plan_start_date`, `assigned_coach_id`, `assigned_nutritionist_id`, `consents` (jsonb: versioni consensi accettati), `screening_flag` (bool: condizione clinica dichiarata → percorso supervisionato).

### Segnali e progressi
- **Measurement**: `client_id`, `date`, `weight_kg`, `waist_cm`, `hips_cm` (opz. `thighs_cm`). Inserite ~ogni 2 giorni.
- **DailyCheckin**: `client_id`, `date`, `mood` (scala 5: `great|good|ok|hard|stressed`), `energy`, `hunger`, `stress` (opzionali).
- **WaterLog**: `client_id`, `date`, `glasses`, `goal`.
- **StepLog**: `client_id`, `date`, `steps`, `goal`, `source`.
- **Objective**: `client_id`, `target_weight_kg`, `target_waist_cm`, `target_hips_cm`, `target_date`, `status`, `confirmed_by_coach_at`, `confirmed_by_nutritionist_at`, `history[]` (riconferme dopo ogni visita).
- **Milestone**: `client_id`, `type`, `label`, `achieved_at`.

### Diete, ricette, menu
- **Diet**: `id`, `name`, `regime`, `style`, `meals_per_day`, `levels[]` (livelli calorici/composizione), `options` (integratori, digiuno intermittente), `author_id` (nutrizionista), `status` (`draft|in_review|approved`), `approved_by_id` (capo).
- **Recipe**: `id`, `name`, `regime`, `meal_slot`, `kcal`, `ingredients[]`, `cooking_methods[]` (veloce/forno/meal-prep con passaggi), `tags[]` (es. "da portare"), `macros`.
- **DietDay/Template**: struttura giornata per una dieta+livello: elenco `meal_slot → recipe_id`.
- **MenuDay** (erogato al cliente): `client_id`, `date`, `diet_id`, `level`, `meals[]` (slot→recipe), `status`, `visible_from` (2 giorni prima dell'inizio piano), `source_rule_id`. **Erogazione 2 giorni alla volta**.
- **RecipeRating**: `client_id`, `recipe_id`, `stars` (1–5), `tags[]`, `date`. (Segnale "Gusto".)

> **Ricetta vs Consiglio (UI menu/anteprima).** Nel prototipo i pulsanti "Ricetta"/"Consiglio" e i loro
> contenuti sono un **esempio statico**. In produzione ogni `meal_slot` risolve una `Recipe` reale: se la
> ricetta ha `cooking_methods`/passaggi (piatto da cucinare) il frontend mostra **"Ricetta"** (ingredienti +
> preparazione); se è un piatto da comporre senza preparazione, mostra **"Consiglio"** (una nota/tip
> associata alla ricetta, es. "yogurt + noci"). Il contenuto va gestito da dashboard (nutrizionista) e
> assegnato dal motore vicino a ogni menu, così ogni piatto porta con sé la sua ricetta o il suo consiglio.
- **ShoppingList**: `client_id`, `date_range`, `items[]` (nome, checked).

### Calendario / eventi
- **Event**: `client_id`, `type` (`wedding|baptism|dinner|monthly_cheat|vacation|other`), `start_date`, `end_date`, `mode` (`single_event|pause_period`), `plan_phase_state`.
- (I "periodi senza dieta" sono `Event` con `mode=pause_period`: sospendono l'erogazione ma monitorano le misure e attivano un mini-piano oltre soglia.)

### Motore
- **Protocol/Rule**: `id`, `name`, `type` (`menu_correction|threshold|library|...`), `definition` (jsonb: condizioni sui segnali → azione), `thresholds` (jsonb), `status` (`pending|approved|rejected`), `validated_by_id`, `applies_to` (es. "senza condizioni cliniche").
- **EngineDecision** (log): `client_id`, `date`, `inputs` (snapshot segnali), `rule_id`, `action` (menu/tono/timing), `flagged_for_review` (bool), `reviewed_by_id`.
- **ConfigParam**: `key`, `value`, `type`, `updated_by_id`. (Tutte le soglie — vedi Appendice A.)

### Sanitario / visite / documenti
- **Visit**: `client_id`, `nutritionist_id`, `type` (`in_person|televisit`), `datetime`, `status`, `notes` (riservate), `video_room_id`.
- **Document**: `client_id`, `type` (`blood_test|photo|other`), `file_key` (storage cifrato), `status` (`pending|reviewed`), `flags[]` (es. valore fuori range → alert nutrizionista), `uploaded_at`.
- **ClinicalNote**: `client_id`, `nutritionist_id`, `text`, `date` (accesso riservato).
- **Escalation**: `client_id`, `reason`, `source` (`screening|coach|engine`), `assigned_to_id`, `status`.

### Chat
- **ChatThread**: `client_id`, `counterpart_type` (`ai|coach|nutritionist`), `counterpart_id`.
- **Message**: `thread_id`, `sender`, `body`, `sent_at`, `meta` (es. instradamento/filtro). L'assistente AI fa da primo filtro (FAQ → instrada a coach/nutrizionista; temi sensibili → escalation).

### CRM, commercio, contabilità
- **Lead/CrmRecord**: `client_id?`, `stage`, `dates` (jsonb: `lead_in`, `worked_by_sales`, `paid`, `assigned_coach`, `coach_call`, `assigned_nutritionist`, `first_visit`, `next_visits[]`), `owner_id`, `value`.
- **Plan**: `id`, `name`, `price`, `period`, `meals_per_day`, `features[]`.
- **Subscription**: `client_id`, `plan_id`, `status`, `start_date`, `renewal`, `psp_ref`.
- **Payment**: `client_id`, `amount`, `date`, `method`, `psp_ref`, `subscription_id`.
- **Product** (integratori): `id`, `name`, `price`, `description`, `stock?`.
- **Order/OrderItem**: acquisti integratori.
- **LedgerEntry** (contabilità): `type` (`income|expense`), `amount`, `category` (abbonamento/visita/compenso/marketing/costi fissi), `date`, `ref` (payment/visit/…).
- **StaffCompensation**: `staff_id`, `period`, `patients`, `visits`, `amount` (regole compenso configurabili).

### Notifiche
- **Notification**: `client_id`, `type`, `payload`, `channel` (`push|email|inapp`), `scheduled_for`, `sent_at`, `read_at`.

**Relazioni chiave:** Client 1—N Measurement/Checkin/MenuDay/RecipeRating/Event/Document; Client N—1 Coach e Nutritionist; Nutritionist N—1 HeadNutritionist; Diet N—1 author (Nutritionist); MenuDay N—1 Diet.

---

## 6. API REST

Contratto REST/JSON, versione `/api/v1`. Tutte le rotte protette da JWT + RBAC. Payload principali indicati; usare paginazione, filtri e `ETag` dove utile.

### Auth
- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/verify-email` · `POST /auth/password-reset`.

### Onboarding / questionario
- `GET /onboarding/questions` — schema del sondaggio (15 pagine).
- `POST /onboarding/answers` — salva risposte, calcola `screening_flag`, propone percorso e team, verifica sostenibilità obiettivo.
- `GET /onboarding/result` — percorso consigliato + coach/nutrizionista + prima visita.

### Profilo cliente
- `GET/PATCH /me/profile` · `GET/PATCH /me/objective` (con validazione ritmo sostenibile) · `POST /me/theme`.

### Segnali
- `GET/POST /me/measurements` (POST = invia misure del giorno) · `GET/POST /me/checkins` (check-in giornaliero) · `POST /me/water` · `POST /me/steps`.
- `GET /me/progress` — % verso obiettivo, tendenze (medie mobili), proiezione data.

### Menu e ricette
- `GET /me/menu?from&to` — menu dei prossimi 2 giorni (rispetta `visible_from`).
- `GET /recipes/:id` · `POST /me/ratings` (valutazione ricetta + tag).
- `GET /me/shopping-list` — lista spesa dei 2 giorni.

### Motore (interno + admin)
- `POST /engine/run` (job) — per un cliente: raccoglie segnali, applica regole validate, genera `MenuDay` + messaggio + timing, logga `EngineDecision`, marca gli anomali per revisione.
- `GET /engine/decisions?flagged=true` (nutrizionista) — verifiche a campione; `POST /engine/decisions/:id/confirm|correct`.
- `GET/POST /protocols` (nutrizionista propone) · `POST /protocols/:id/validate` (approva/rifiuta a monte).

### Calendario / eventi
- `GET/POST/DELETE /me/events` (eventi e periodi di pausa) · `GET /me/events/:id/plan` (fasi prima/durante/dopo).

### Chat
- `GET /me/threads` · `GET/POST /threads/:id/messages` · l'assistente AI risponde/instrada; escalation automatica su temi sensibili.

### Documenti
- `POST /me/documents` (upload cifrato) · `GET /me/documents` · lato nutrizionista: `GET /clients/:id/documents`, flag valori fuori range.

### Visite
- `GET /me/visits` · lato nutrizionista: `GET /agenda`, `POST /visits`, `POST /visits/:id/start` (avvia televisita — solo controlli; prima visita = in presenza).

### Aree professionali
- Coach: `GET /coach/clients` (con semaforo/alert), `GET /coach/clients/:id`, `POST /coach/clients/:id/escalate`.
- Nutrizionista: `GET /nutritionist/patients`, cartella, protocolli, verifiche, agenda, escalation.
- Capo: `GET /head/team`, `GET /head/diets?status=in_review`, `POST /diets/:id/approve`, `GET /catalog`.
- Backend/Admin: `GET/POST /admin/users`, `POST /admin/assignments` (cliente→coach/nutrizionista), `GET/PATCH /admin/config` (parametri motore), catalogo diete, editor dieta.

### Commercio, CRM, contabilità
- `GET /plans` · `POST /me/subscribe` · `POST /payments/webhook` (PSP).
- CRM: `GET/POST /crm/leads`, `PATCH /crm/leads/:id` (avanza stage con data+responsabile).
- Dashboard: `GET /dashboards/sales`, `GET /dashboards/compensation`, `GET /dashboards/accounting`.
- Contabilità: `GET /ledger`, export report.

---

## 7. Il motore intelligente

### 7.1 I cinque segnali
| Segnale | Dati | Uso |
|---|---|---|
| Corpo | peso, vita, fianchi (ogni 2 gg) | direzione oggettiva (su medie mobili) |
| Testa | umore, energia, fame, stress (giornaliero) | spingere o sostenere |
| Vita | lavoro, tempo, pasti fuori | menu eseguibili |
| Agenda | eventi, periodi di pausa | anticipare, non punire |
| Gusto | valutazioni ricette | riproporre ciò che piace |

### 7.2 Logica
- Ragionare sulla **tendenza** (media mobile su N rilevazioni, `config`), non sul singolo dato.
- Ogni 2 giorni il motore combina i segnali e sceglie: **menu** (dieta+livello), **tono** del messaggio, **timing** delle notifiche.
- **Ordine di implementazione:** prima un **sistema a regole deterministiche** (trasparente, testabile, validato dal nutrizionista); l'AI generativa si aggiunge dopo, solo come layer di supporto (messaggi naturali, riconoscimento sfumature) — mai come decisore autonomo non supervisionato.

Tabella decisionale (esempi, tutte le soglie in `config`):

| Condizione (segnali) | Azione |
|---|---|
| stallo + umore basso + settimana intensa | non stringe: menu pratici, messaggio di sostegno, correzione rimandata |
| stallo + sereno + tempo per cucinare | variante di correzione (più proteica/minor carico) |
| in calo secondo obiettivo + evento in agenda | alleggerisce prima, libertà il giorno, rientro dopo |
| calo troppo rapido + energia bassa | alza calorie, rallenta, **alert al nutrizionista** |
| aderente + umore alto + obiettivo vicino | celebra + step successivo |

### 7.3 Governance AI (obbligatoria)
1. **Validazione a monte**: il nutrizionista approva protocolli/regole/librerie PRIMA che il motore li usi (`Protocol.status=approved`).
2. **Esecuzione**: sui casi normali il motore decide dentro i protocolli approvati.
3. **Controllo**: verifica a campione (`EngineDecision.flagged`) + escalation.

### 7.4 Guardrail (soglie configurabili — Appendice A)
- Ritmo sostenibile max (kg/settimana) → definisce quando un obiettivo è **irreale** (azione: avviso / blocca+proponi data / richiede ok nutrizionista).
- Calorie minime; variazione peso max per periodo; finestra media mobile; giorni di stallo/senza check-in per alert coach; scostamento che attiva il mini-piano in pausa; soglia stelle sotto cui riproporre di rado.
- **Stop automatismo** e passaggio al nutrizionista se: `screening_flag`, energia bassa cronica, segnali di rapporto problematico col cibo, patologie/farmaci dichiarati.
- Ogni decisione è **loggata e spiegabile** (`EngineDecision`).

---

## 8. Logica di business e ciclo di vita

- **Data di inizio piano**: il cliente sceglie `plan_start_date`. Il **menu diventa visibile 2 giorni prima** (`MenuDay.visible_from = plan_start_date - 2`). Erogazione **2 giorni alla volta**; i successivi si sbloccano dopo il check-in.
- **Valutazione ricetta**: richiesta via notifica **subito dopo il pasto**; se non data, **riproposta all'apertura dell'app**. Aggiorna il segnale Gusto.
- **Check-in giornaliero**: popup una volta al giorno, alla prima apertura (in base alla data dell'ultimo check-in), prima della dashboard.
- **Obiettivo**: creato nel questionario, **confermato da coach + nutrizionista**, **riconfermato dopo ogni visita** (aggiorna `Objective.history`).
- **CRM**: ogni transizione di stage salva **data + responsabile** (`lead_in` → `worked_by_sales` → `paid` → `assigned_coach`/`coach_call` → `assigned_nutritionist` → `first_visit` (in presenza) → `next_visits` (televisita)).
- **Eventi economici automatici**: `paid` → `LedgerEntry(income)`; visita → compenso (`StaffCompensation`) + `LedgerEntry(expense)`. Niente doppio inserimento.

---

## 9. Notifiche

Motore di notifiche **personalizzate** (contenuto, tono, orario decisi dai segnali). Tipi: promemoria pasto, richiesta valutazione post-pasto, promemoria check-in/misure, incoraggiamenti, alert misure migliorate, countdown/consigli pre-evento, alert alle coach (stallo/assenza check-in), avvisi visite. Canali: push web, email transazionale, in-app; SMS opzionale. Rispettare le preferenze/consensi dell'utente e non essere ripetitivi.

---

## 10. Integrazioni esterne

- **Pagamenti**: PSP con SEPA (webhook per stato pagamento → CRM/contabilità).
- **Video televisite**: provider WebRTC UE-compatibile (solo per i controlli; la prima visita è in presenza).
- **Email/Push**: provider transazionale.
- **Storage file**: bucket UE cifrato per documenti sanitari (URL firmati a scadenza).
- (Opzionale futuro) passi/attività da HealthKit/Google Fit.

---

## 11. Compliance, privacy e sicurezza

- **Benessere, non dispositivo medico** (MDR): niente finalità di diagnosi/cura; nessun claim terapeutico; filtro dei casi clinici verso il nutrizionista.
- **Prima visita in presenza obbligatoria** (linee guida biologi nutrizionisti): il modulo visite deve impedire la prenotazione della *prima* visita in modalità telematica; l'online è ammesso solo per i **controlli**.
- **Dati sanitari = categorie particolari (GDPR)**: misure, umore, note, analisi, foto. Servono: consenso esplicito e informato (testi forniti dal legale), possibilità di **gating dell'acquisto al consenso**, DPIA, cifratura a riposo/in transito, **accessi per ruolo** (la coach non vede note cliniche né documenti), hosting UE, **audit trail**, diritti dell'utente (accesso, rettifica, cancellazione, portabilità).
- **Tracciabilità decisioni AI** (spiegabilità) per controllo del nutrizionista e tutela legale.
- Sicurezza applicativa: hashing password, rate limiting, validazione input, protezione OWASP Top 10, segreti in vault, backup cifrati.

---

## 12. Requisiti non funzionali

- **Scala**: progettare per 25k+ clienti attivi; indicizzare le query sui segnali; job asincroni per il motore e le notifiche.
- **Multilingua (i18n)**: contenuti (menu, messaggi, notifiche) e UI localizzabili; `locale` per utente. Nome brand internazionale (Metabole).
- **Performance**: risposte API rapide; il calcolo del motore è batch/asincrono (non in linea con la richiesta utente).
- **Affidabilità**: retry sui job, idempotenza dei webhook, monitoraggio ed errori tracciati.
- **Testing**: unit + integrazione sulle regole del motore e sui flussi critici (attivazione, sblocco menu, pagamenti, RBAC dati sanitari).

---

## 13. Roadmap di sviluppo backend (milestone)

1. **Fondamenta**: auth + RBAC, modello utenti/profili, config_param, audit log.
2. **Onboarding + profilo**: questionario, obiettivo sostenibile, assegnazione team, screening → escalation.
3. **Segnali**: misure, check-in, acqua, passi; medie mobili; progressi.
4. **Diete/menu**: catalogo diete (author→approvazione capo), ricette, erogazione menu 2 giorni, valutazioni (Gusto), lista spesa.
5. **Motore (regole)**: rules engine deterministico + guardrail configurabili + validazione protocolli + log decisioni + verifiche a campione.
6. **Ciclo di vita**: data inizio + sblocco menu 2 giorni prima; notifiche essenziali.
7. **Sanitario**: cartelle, note (RBAC), documenti cifrati, visite (prima in presenza / televisite), escalation.
8. **Chat**: thread AI/coach/nutrizionista con filtro e instradamento.
9. **CRM + commercio + contabilità**: lead lifecycle, piani/abbonamenti/pagamenti, ledger, compensi, dashboard.
10. **Rifinitura**: notifiche intelligenti complete, layer AI di supporto, i18n, hardening sicurezza/privacy, load test.

Consegnare ad ogni milestone: migrazioni, endpoint documentati (OpenAPI), test, seed di esempio.

---

## Appendice A — Enumerazioni e parametri configurabili

**Enum**
- `role`: client, coach, nutritionist, head_nutritionist, sales, admin
- `regime`: omnivore, vegetarian, vegan
- `diet_style`: mediterranean, protein, low_carb, flexible
- `meals_per_day`: 3, 4, 5
- `path_type`: classic3, five, supplements, intermittent_fasting
- `coach_style`: daily, when_needed, on_request
- `character`: follows, needs_push, perseveres, quits
- `mood` (scala 5): great, good, ok, hard, stressed
- `event_type`: wedding, baptism, dinner, monthly_cheat, vacation, other
- `event_mode`: single_event, pause_period
- `visit_type`: in_person, televisit
- `document_type`: blood_test, photo, other
- `protocol_status`: pending, approved, rejected
- `crm_stage`: lead_in, worked, paid, coach_assigned, coach_call, nutritionist_assigned, first_visit, follow_up

**config_param (valori iniziali indicativi, tutti modificabili da admin, validati dal nutrizionista)**
- `sustainable_rate_max_kg_week` = 0.7 → definisce l'obiettivo irreale
- `ambitious_rate_max_kg_week` = 1.0
- `unreal_objective_action` = warn | block_propose_date | require_nutritionist
- `min_daily_kcal` = 1200
- `max_weight_change_alert_kg_week` = 1.5
- `moving_average_window` = 3
- `stall_days_before_coach_alert` = 6
- `no_checkin_days_before_alert` = 4
- `pause_deviation_trigger` = 1.5 (kg/cm)
- `menu_days_delivered` = 2
- `menu_visible_days_before_start` = 2
- `low_rating_threshold_stars` = 2
- `water_goal_glasses` = 8
- `steps_goal` = 8000

---

_Riferimenti nel progetto: `Metabole_Prototipo_Navigabile.html` (prototipo cliccabile end-to-end), `Metabole_Specifica_Prodotto.docx` (specifica funzionale), `Metabole_Motore_Intelligente.docx` (motore), `Metabole_Modello_Economico.xlsx`. Le parti su normativa e dati sanitari vanno confermate con il legale/consulente privacy del cliente._
