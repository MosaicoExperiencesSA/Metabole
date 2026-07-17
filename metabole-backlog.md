
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
lato cliente). NON ancora fatto (opzionale, se si vorrà): notifica al passaggio dimagrimento →
mantenimento ("Hai raggiunto il tuo obiettivo").

## Catalogo diete — servono i tagli a 3 pasti e digiuno intermittente — DA FARE (importante, DATI)
DIAGNOSI (17/07): un cliente che sceglie 3 pasti resta SENZA MENU perché menu.service.pickDiet cerca
una dieta approvata con mealsPerDay ESATTAMENTE uguale al profilo, ma il Catalogo diete ha solo
diete a 5 pasti → pickDiet ritorna null → nessun menu.
FATTO lato onboarding (17/07): le opzioni pasti ora sono **3 / 5 / digiuno intermittente** (tolti
"4 pasti" e "Con integratori").
DA FARE (lato NUTRIZIONISTA/dati): creare e approvare nel catalogo le diete a **3 pasti** e per il
**digiuno intermittente** (almeno Onnivora, meglio tutti i regimi), altrimenti chi sceglie 3 pasti o
digiuno resta comunque senza menu. Da chiarire: a quale mealsPerDay mappa il digiuno intermittente
(oggi le diete "Digiuno intermittente (16:8)" a catalogo sono a 5 pasti).
NOTA: nel backoffice la scheda cliente ha ancora il campo "Pasti" con opzione 4 → allinearlo a 3/5
(codice del socio).

## Checkout — indirizzo di spedizione condizionale — FATTO (17/07)
Checkout ora carica /me/profile: se via/CAP/città/provincia sono già in scheda mostra l'indirizzo in
sola lettura con "Modifica"; se manca, apre il form (via, CAP, città, provincia) e al pagamento lo
salva in scheda (PATCH /me/profile) prima di procedere.

## Registrazione — telefono con prefisso + login email/telefono — FATTO (17/07)
Telefono obbligatorio in registrazione (prefisso a discesa + numero, unicità sulle cifre); login
con email o telefono (quest'ultimo già lato socio).
