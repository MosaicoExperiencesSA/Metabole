
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
