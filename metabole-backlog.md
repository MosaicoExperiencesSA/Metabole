
## Shop backoffice (prodotti) — FATTO (superato)
Quando si crea il backoffice dello shop (creazione prodotti), ogni prodotto deve
avere un flag "provvigioni a": team coaching | team nutrizionisti | entrambi.
Il motore provvigioni (finance.service) dovrà rispettare questo flag per decidere
quali quote pagare.

AGGIORNAMENTO: già implementato in modo più completo del flag: ogni piano/prodotto ha gli
importi di provvigione PER RUOLO in centesimi (coach, manager coach, nutrizionista, capo
nutrizionista), impostabili dal Negozio. finance.service.generateCommissions li somma e li
applica (sconti proporzionali, 0 = nessuna). Il vecchio commissionTeam è stato sostituito.

## Coach — video di presentazione (da fare, ~2 settimane)
DECISIONE (Simone): impostazione **via URL** — l'admin incolla il link a un video già
ospitato nella scheda staff del backoffice, mostrato al cliente nella schermata onboarding
"La tua coach". Da fare quando Simone avrà i filmati.
Nella scheda di registrazione/profilo della coach (backoffice) aggiungere il supporto per
il **caricamento del video di presentazione** (upload file video + storage + URL sul profilo).
Il video viene mostrato al cliente nella schermata "La tua coach, Sara" durante l'onboarding
(oggi nel prototipo è un player finto). Prevedere: campo `intro_video_url` sul profilo coach,
upload da dashboard, formato/durata consigliati e fallback se assente.

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
Oggi la registrazione con una email già presente risponde solo con l'errore
"Email già registrata" (ConflictException in auth.service.register). Migliorare
la UX: riconoscere l'utente di ritorno e proporre "Questa email è già registrata:
vuoi reimpostare la password?" con link/azione diretta al flusso di reset
(app: /reset-password; staff: backoffice). Attenzione sicurezza: non rivelare
troppo (enumerazione account) — valutare messaggio neutro lato API e gestione
dell'offerta solo lato UI, oppure inviare comunque la mail di reset senza
confermare esplicitamente l'esistenza dell'account.

FATTO (app Register.tsx): su email già registrata (409) niente errore secco, ma un riquadro "Questa email è già registrata" con "Reimposta la password" (chiama POST /auth/password-reset, che risponde comunque 202 neutro) e "Accedi". L'enumerazione non peggiora perché la registrazione già rivelava l'esistenza; il reset resta neutro.

## App cliente — mostrare la "fase" (dimagrimento/mantenimento) — DA FARE
DECISIONE (Simone, 16/07): per ora la fase del cliente resta **solo staff**.
Il campo `ClientProfile.objective` (dimagrimento | mantenimento) esiste già ed è
gestito dallo staff nella scheda cliente del backoffice ("Fase (obiettivo dieta)");
guida `pickDiet` a scegliere la variante giusta della famiglia (Fase 2, fatta).
DA FARE quando si vuole: mostrare al cliente nell'app la sua fase attuale (es. badge
"Mantenimento" nella home / schermata piano), e valutare se e come comunicargli il
passaggio da dimagrimento a mantenimento (messaggio/notifica "Hai raggiunto il tuo
obiettivo: si passa al mantenimento"). Nessuna azione lato cliente: resta decisione
clinica dello staff, l'app la mostra soltanto.

## Catalogo diete — mancano i tagli a 3 e 4 pasti — DA FARE (importante)
DIAGNOSI (17/07): un cliente che nell'onboarding sceglie il percorso a 3 (o 4) pasti resta
SENZA MENU. Causa: menu.service.pickDiet cerca una dieta approvata con mealsPerDay ESATTAMENTE
uguale al profilo (il filtro `mealsPerDay` è in tutte le query, anche nei fallback), ma nel
Catalogo diete esistono SOLO diete a 5 pasti → pickDiet ritorna null → deliverIfEligible non
genera nulla → nessun menu (e il tile kcal resta "—").
Verificato dal vivo su sim1one.salogni@gmail.com (Onnivora, 3 pasti): sbloccata temporaneamente
portando i suoi "Pasti" a 5 dalla scheda backoffice (match con "DASH Onnivora Dimagrimento 5").
DA FARE (una delle due):
  (a) far creare e approvare al capo nutrizionista le varianti a 3 e 4 pasti (almeno Onnivora,
      meglio tutti i regimi), oppure
  (b) se si vuole offrire solo 5 pasti, togliere dall'onboarding la scelta 3/4 pasti.
Opzionale: valutare un fallback in pickDiet più tollerante sul numero pasti (con cautela: darebbe
un piano con un numero di pasti diverso da quello scelto dal cliente).

## Checkout — indirizzo di spedizione condizionale — DA FARE
(re-inserito: perso in un sync del backlog il 17/07)
All'acquisto di un percorso l'indirizzo di spedizione va chiesto SOLO se non è già in scheda.
Se via/CAP/città/provincia sono già nel profilo → saltare il passaggio e andare al pagamento
(mostrare l'indirizzo salvato in sola lettura con "modifica"). Se manca → mostrare il form
(come Checkout, Passo 32/35), raccoglierlo e salvarlo in scheda per le volte successive.

## Registrazione — telefono con prefisso + login email/telefono — FATTO (17/07)
Telefono obbligatorio in registrazione (prefisso a discesa + numero, unicità sulle cifre); login
con email o telefono (quest'ultimo già lato socio). Consegnato in iCloud.
