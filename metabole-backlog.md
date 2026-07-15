
## Shop backoffice (prodotti) — da fare
Quando si crea il backoffice dello shop (creazione prodotti), ogni prodotto deve
avere un flag "provvigioni a": team coaching | team nutrizionisti | entrambi.
Il motore provvigioni (finance.service) dovrà rispettare questo flag per decidere
quali quote pagare.

## Coach — video di presentazione (da fare)
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
