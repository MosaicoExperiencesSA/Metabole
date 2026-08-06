
## Shop backoffice (prodotti) — FATTO (superato)
Quando si crea il backoffice dello shop (creazione prodotti), ogni prodotto deve
avere un flag "provvigioni a": team coaching | team nutrizionisti | entrambi.
Il motore provvigioni (finance.service) dovrà rispettare questo flag per decidere
quali quote pagare.

AGGIORNAMENTO: già implementato in modo più completo del flag: ogni piano/prodotto ha gli
importi di provvigione PER RUOLO in centesimi (coach, manager coach, nutrizionista, capo
nutrizionista), impostabili dal Negozio. finance.service.generateCommissions li somma e li
applica (sconti proporzionali, 0 = nessuna). Il vecchio commissionTeam è stato sostituito.

## Coach — video di presentazione — ANNULLATO (17/07)
Idea abbandonata (Simone, 17/07): il video di presentazione della coach NON si fa. Non era
comunque implementato nell'app (nessun player), quindi niente da rimuovere lato codice.

## Impostazioni backoffice — moduli dashboard trascinabili — FATTO
Riordino drag & drop dei moduli in Impostazioni (lista trascinabile + chip "Aggiungi");
l'ordine si salva in `dashboardModules` e la dashboard lo rispetta.

## PROMEMORIA — permessi pagine
Ogni NUOVA pagina del backoffice va aggiunta alla lista permessi:
1. backend/src/permissions/pages.ts → BACKOFFICE_PAGES + DEFAULT_PERMISSIONS
2. backoffice/src/lib/labels.ts → PAGE_LABEL (etichetta)
3. menu (Layout.tsx) e rotta (App.tsx) devono usare la nuova chiave pageKey
Il seed (seedPermissions) crea le righe ruolo×pagina mancanti al deploy.

## Registrazione con email già esistente — UX reset password — FATTO
Su email già registrata (409) niente errore secco, ma un riquadro "Questa email è già registrata"
con "Reimposta la password" (POST /auth/password-reset, risposta 202 neutra) e "Accedi".

## App cliente — mostrare la "fase" (dimagrimento/mantenimento) — FATTO (17/07)
`/me/today` ora espone `objective` (dimagrimento | mantenimento) dal ClientProfile; la Home mostra
un badge con la fase attuale (Dimagrimento / Mantenimento). Resta gestita dallo staff (sola lettura
lato cliente). FATTO anche l'opzionale (17/07, Cowork): al passaggio di fase dimagrimento →
mantenimento dalla scheda cliente, la cliente riceve la notifica "Hai raggiunto il tuo obiettivo! 🎉"
(in-app + push, tipo `objective_reached`, best effort: mai bloccante per il salvataggio).

## Catalogo diete — tagli a 3 pasti e digiuno intermittente — CODICE FATTO (17/07), restano i DATI
DIAGNOSI (17/07): un cliente che sceglie 3 pasti resta SENZA MENU perché menu.service.pickDiet cerca
una dieta approvata con mealsPerDay ESATTAMENTE uguale al profilo, ma il Catalogo diete ha solo
diete a 5 pasti → pickDiet ritorna null → nessun menu.
FATTO lato onboarding (17/07): le opzioni pasti ora sono **3 / 5 / digiuno intermittente** (tolti
"4 pasti" e "Con integratori").
FATTO lato codice (17/07, Cowork): terza dimensione **Pasti** (3/5/digiuno) nel wizard famiglie
(`RulePreset.meals` + `Diet.fasting`, migrazione `20260717230000_meals_variant`); generazione con
slot giusti (3 = colazione/pranzo/cena; digiuno 16:8 = pranzo/merenda/cena finestra 12-20);
pickDiet (menu + personal-base) instrada `pathType=intermittent_fasting` → varianti fasting e 3/5
sul numero pasti, con fallback per regime (nessuna cliente resta senza menu); "rigenerare = integra"
(le varianti esistenti non si toccano, si aggiungono solo le mancanti); campo Pasti allineato a 3/5
in scheda cliente e Nuova dieta (+ flag digiuno). Le due domande onboarding "Pasti al giorno" e
"Percorso" sono state UNIFICATE in un'unica scelta 3/5/digiuno (mealsPerDay dedotto dal percorso).
DA FARE (lato NUTRIZIONISTA/dati): aprire le famiglie esistenti nel wizard, spuntare **3 pasti** e
**Digiuno intermittente**, "Genera tutte le varianti" (aggiunge SOLO le mancanti), validare e
pubblicare. Le vecchie diete "Digiuno intermittente (16:8)" a 5 pasti nel catalogo andranno
sostituite/archiviate a mano.

## Lead da backoffice — invia credenziali — FATTO (17/07)
CONCETTO (Simone, 17/07): NON "crea cliente" ma "invia credenziali". Un lead diventa cliente
("Acquisito") SOLO al pagamento (verificato: `crm.autoAdvance('paid')` in commerce.service);
"invia credenziali" crea solo l'accesso, il lead resta lead.
FATTO (17/07, Cowork — commit 311f84a):
- `crm.sendCredentials(leadId)`: se il lead non ha account lo crea (email reale, password provvisoria
  argon2 CASUALE `genTempPassword`, `role=client`, `mustChangePassword=true`, `emailVerifiedAt=now`,
  nome/telefono dal lead) oppure rigenera la provvisoria se esiste già; collega `CrmRecord.clientId`;
  NON cambia lo stage. Endpoint `POST /crm/leads/:id/send-credentials` + flag `sendCredentials` sul create.
- Email `lead_credentials` (mail.service + i18n `mail.credentials.*`, modello editabile dal backoffice):
  nome, email, password provvisoria, link app, nota su questionario/reset password.
- UI in 3 punti: app rubrica staff (ContactActions → "Invia credenziali"); backoffice "Inserisci e
  invia credenziali" (LeadForm) e "Invia credenziali" nella barra verde (LeadDetail).
Si aggancia a `mustChangePassword`: a fine questionario l'app impone la password personale
(`PATCH /me/password/initial`, schermata SetPassword). Nessuna migration.
NOTA MERGE: il socio aveva costruito in parallelo "Crea account cliente" (endpoint `create-account`,
commit `ed1ac9f`); nel merge è rimasta la versione "invia credenziali" (quella richiesta da Simone).
Il vecchio `Metabole_Handoff_Lead_Backoffice_Password.md` è superato da questa implementazione.

## Checkout — indirizzo di spedizione condizionale — FATTO (17/07)
Checkout ora carica /me/profile: se via/CAP/città/provincia sono già in scheda mostra l'indirizzo in
sola lettura con "Modifica"; se manca, apre il form (via, CAP, città, provincia) e al pagamento lo
salva in scheda (PATCH /me/profile) prima di procedere.

## Registrazione — telefono con prefisso + login email/telefono — FATTO (17/07)
Telefono obbligatorio in registrazione (prefisso a discesa + numero, unicità sulle cifre); login
con email o telefono (quest'ultimo già lato socio).

## Registrazione — una card per PRODOTTO, non per stile — DA FARE (deciso 6/8)
Segnalato da Simone il 6/8: i percorsi che la cliente vede in registrazione non corrispondono
alle diete del backoffice. Metà del problema era cosmetica ed è risolta (il nome mostrato ora è
quello vero della dieta, non il codice stile). Resta la parte strutturale.

**Cosa succede.** `GET /onboarding/diet-products` scorre le diete pubblicate e ne tiene **una per
stile** (`if (seen.has(style)) continue`). Le famiglie che condividono lo stesso codice stile si
schiacciano in una voce sola: Vegana, Vegetariana (latto-ovo), Flexitariana e Flessibile sono tutte
`flexible`; Mediterranea, Mediterranea ipocalorica e Pescetariana sono tutte `mediterranean`. Il
backoffice ne mostra 18, l'app 8.

**Perché non basta togliere il dedup.** La registrazione salva `dietStyle`, e il motore abbina la
dieta con `pickDiet` su stile + regime + obiettivo + pasti. Se in registrazione comparissero due
prodotti con lo stesso stile e lo stesso regime (Flessibile e Flexitariana, entrambe onnivore), la
cliente ne sceglierebbe uno e il motore potrebbe servirle l'altro: peggio della situazione attuale.

**Come si fa.** La scelta deve identificare il PRODOTTO, non lo stile:
1. la registrazione salva anche `dietProductId` (o il nome della famiglia) accanto a `dietStyle`,
   che resta per compatibilità con le clienti già registrate;
2. `pickDiet` filtra prima per prodotto scelto, e ricade su stile+regime+obiettivo+pasti se il
   campo è vuoto (tutte le clienti esistenti);
3. `dietProducts()` smette di deduplicare per stile e restituisce una voce per famiglia
   (nome + stile), come le vede il nutrizionista;
4. il "?" continua a leggere lo STILE (spiega il tipo di alimentazione, non il singolo percorso):
   nessuna modifica a `dietInfo.ts`.
Serve una migrazione (campo su ClientProfile/OnboardingAnswer) e un giro di verifica sul motore:
non è un lavoro da sera di pubblicazione.

## Test rossi e `continue-on-error` in ci.yml — 17 rimasti (erano 99), 6/8
Misurato il 6/8 facendo girare la suite: **99 test rossi in 18 suite**, non «~30 in src/commerce»
come dicevano gli appunti. Sistemate le due famiglie meccaniche — provider dimenticati nei moduli
di test (6 suite) e finti Prisma senza i modelli che i servizi hanno imparato a leggere (7 suite):
**99 → 28 → 17**, con sette suite tornate verdi (auth, utenti, signals, promemoria, pipeline,
nutrizionista, alert). Da qui in poi non è più meccanico:

1. **Dodici asserzioni che ADESSO girano e falliscono** — commerce (5), finance-crm (4), area
   sanitaria (2), catalogo (2), contabilità (1), coach (1). Prima di oggi queste suite non
   partivano proprio, quindi questi rossi non li aveva mai visti nessuno. Vanno letti uno per
   uno: qui la domanda «ha ragione il test o il codice?» ha davvero due risposte possibili, e
   almeno un paio potrebbero essere difetti veri.
2. **Tre suite che NON compilano**: descrivono un'API che non esiste più. `cron.controller.spec`
   si aspetta `result.engine.run` e `result.notifications`, che la risposta del cron non ha più.
   È riscrittura, non riparazione: va deciso cosa debbano verificare adesso.
   Suite: cron, escalations, onboarding.
3. **Due da leggere prima di toccare**:
   - `menu-measurement-gate.spec`: si aspetta 0 e riceve 3. È il gate misure reso severo il 6/8
     (voce #6). O il test racconta la regola vecchia, o il gate lascia passare più del dovuto:
     è l'unico test che presidia una regola clinica, quindi va capito, non allineato.
   - `referral.service.spec`: confronta un istante fisso (`1788134400000`) con l'orologio reale.
     Rosso per costruzione. Serve congelare il tempo (`jest.useFakeTimers`).

`continue-on-error: true` (`.github/workflows/ci.yml`) si toglie **quando sono zero**, non quando
sono pochi: finché c'è, la pipeline non può fallire e il numero cresce senza che nessuno lo veda —
da 30 a 99 è successo così. ⚠️ I file `.github/` non li scrive il bridge: si modificano
dall'editor web di GitHub.

## Catalogo ricette — filtri e ordinamento sul SERVER — DA FARE (emerso 6/8)
Lo screenshot di Simone del 6/8 mostra il banner di troncamento **con il solo regime Vegetariana**:
le ricette vegetariane hanno già superato le 1000, cioè il tetto alzato quella mattina da 200.
Conseguenza: nella pagina Ricette (catalogo per regime) i filtri e gli ordinamenti di colonna
lavorano sulle prime 1000 righe caricate, non su tutto il catalogo — e lo dicono, ma non è la
stessa cosa che funzionare.

Alzare ancora `take` è un rattoppo che si ripresenterà. La strada è portare filtri, ordinamento e
paginazione su `GET /recipes` (già filtra `regime`, `mealSlot`, `q`, `dietId`): mancano
`difficulty`, `season`, `tag`, `active`, `kcalMin/kcalMax`, `orderBy`, `skip/take`, e il conteggio
totale. La tabella diventa "interroga a ogni cambio filtro" invece di "filtra in memoria".

NON urgente per il nutrizionista: dentro **Gestione dieta** l'elenco parte dalle ricette della
singola dieta (`dietId`, dal 6/8), che sono decine — lì il tetto non si tocca mai. Il problema
resta solo nella pagina Ricette generale.

## iOS — deployment target da 13.0 a 15.0 — DA FARE entro primavera 2027
Warning ricevuto da App Store Connect all'upload della 2.1 (6/8/26):

> MinimumOSVersion too low. This app has a MinimumOSVersion of 13.0. Starting in Spring 2027,
> all iOS apps must have a MinimumOSVersion of 15.0 or later in order to be uploaded to App
> Store Connect or submitted for distribution.

Oggi **non blocca**: la 2.1 è stata accettata. Ma dalla primavera 2027 gli upload verranno
rifiutati, quindi va fatto prima — meglio in una sessione tranquilla che sotto scadenza.
Si cambia in Xcode (`IPHONEOS_DEPLOYMENT_TARGET`) e conviene farlo fare a
`scripts/install-ios.mjs`, perché `ios/` viene rigenerato e la modifica si perderebbe.
Impatto sulle clienti: chi ha iOS 13 o 14 non riceverebbe più aggiornamenti — da verificare nei
dati di App Store Connect prima di procedere (verosimilmente nessuna).
