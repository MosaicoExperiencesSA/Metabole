# Registro — "Il mantenimento si doveva vedere solo a obiettivo raggiunto, invece lo vedono tutti"

**Data:** 5 agosto 2026 · Segnalazione di Simone durante la revisione del registro lavori: «avevamo
detto che il mantenimento si doveva vedere solo a raggiungimento obiettivo, invece lo vedono tutti».

## La prima cosa da dire: la regola non era stata persa

Il controllo c'era ed era scritto giusto, in `listPlansForClient` (`commerce.service.ts`): il piano
di mantenimento compare solo se la cliente ha raggiunto l'obiettivo di peso. E l'app chiede
davvero l'elenco filtrato — sia il Negozio sia il flusso di acquisto leggono `GET /me/plans`, non
la vetrina pubblica.

Il difetto non era nella regola. Era **nei tre lati intorno alla regola**, ognuno dei quali
bastava da solo a farla saltare.

## Come si riconosce il mantenimento (e perché è il punto)

Il mantenimento **non si riconosce dal nome**. Si riconosce dal campo `period` valorizzato
esattamente a `maintenance`. Su quella parola si reggono **quattro** cose diverse, scritte in
quattro file diversi:

| Dove | Cosa fa |
|---|---|
| `commerce.service.ts` — `listPlansForClient` | mostra il piano solo a obiettivo raggiunto |
| `reports/plan-report.service.ts` | il riquadro "Mantenimento" nel report di fine percorso, col pulsante d'acquisto |
| `monitoring/monitoring.service.ts` | sblocca il monitoraggio del peso |
| `coach-tasks/coach-tasks.service.ts` | fa scattare l'attività coach «peso che risale» |

Nessuno di questi quattro segnala niente se la parola cambia. Semplicemente smettono, in silenzio.

## Lato 1 — il piano non era più salvabile, e chi lo salvava lo rompeva

Il DTO del Negozio validava il periodo con `@MaxLength(10)`. **`maintenance` è di 11 caratteri.**

Il form del Negozio rimanda sempre tutti i campi, periodo compreso, anche quando si tocca solo il
prezzo. E `main.ts` monta la `ValidationPipe` con `forbidNonWhitelisted`, quindi il salvataggio non
veniva "aggiustato": veniva **rifiutato**, con un messaggio che parlava di lunghezza massima.

Da lì la sequenza che spiega tutto: chi voleva cambiare il prezzo del mantenimento non riusciva a
salvare, e per uscirne accorciava il Periodo — a `1m`, o a quello che passava. Il salvataggio
andava a buon fine. E in quel momento, senza nessun avviso, il piano smetteva di essere il
mantenimento: **compariva nello shop a tutte le clienti**, spariva dal report, e monitoraggio e
attività coach non scattavano più.

Un limite di lunghezza messo al posto di un controllo di formato, su un campo che ha un valore
speciale più lungo del limite.

## Lato 2 — la vetrina pubblica lo mostrava a chiunque

`GET /plans` è `@Public()`: risponde **senza login**. Restituiva l'elenco intero, mantenimento
compreso. Un endpoint pubblico non può sapere chi sta chiedendo, quindi non può applicare una
regola che dipende dalla cliente: l'unica risposta corretta è **non mostrarlo**.

## Lato 3 — l'acquisto non ricontrollava niente

Ed è il lato che conta di più. Nascondere un piano da un elenco lo toglie dai suggerimenti, ma
**l'acquisto è una POST con un `planId` dentro**. Né `subscribe` né `checkout` ricontrollavano
l'obiettivo: bastava conoscere l'id del piano — e fino a ieri lo dava la vetrina pubblica — per
comprare il mantenimento saltando del tutto la vetrina.

`checkout` in particolare è **la strada che usa il pulsante dentro il report** di fine percorso.

## Com'è ora

**Il periodo si valida per formato, non per lunghezza.** `PLAN_PERIOD_RE` accetta `Nd`, `Nw`, `Nm`,
`Ny`, un numero nudo (= mesi) e la parola `maintenance`; rifiuta tutto il resto, zero compreso. Il
messaggio d'errore dice cosa scrivere invece di parlare di caratteri. La regola è tenuta allineata
a `subscriptionEnd`/`isKnownPeriod` **da un test**, perché una divergenza fra le due farebbe
scattare in silenzio il fallback di 3 mesi.

**Una funzione sola per riconoscerlo.** `isMaintenancePlan(period)`, esportata da
`commerce.service.ts`, tollerante a spazi e maiuscole. Sopra c'è scritto quali quattro sottosistemi
dipendono da quella parola: chi la tocca lo legge.

**La vetrina pubblica non lo contiene.** `GET /plans` ora chiama `listPublicPlans()`. Le clienti
loggate continuano a usare `GET /me/plans`, che applica la regola per davvero.

**L'operatrice però deve poterlo ancora vendere a mano.** Il modale "Nuovo acquisto manuale" del
backoffice leggeva proprio `GET /plans`: filtrare e basta le avrebbe tolto il mantenimento dal
menu a tendina. Quindi c'è un nuovo `GET /admin/purchases/plans` che restituisce l'elenco completo,
sul controller che è già `@Roles('admin', 'sales')` — non su quello riservato ai soli admin, che
avrebbe tagliato fuori le responsabili.

**La regola è ripetuta dove si decide davvero.** `assertPlanPurchasable` viene chiamata sia da
`subscribe` sia da `checkout`: senza obiettivo raggiunto l'acquisto viene rifiutato con un
messaggio scritto per la cliente, non per il log — *«Il Mantenimento si attiva quando hai raggiunto
il tuo obiettivo di peso. Parlane con la tua coach se pensi sia un errore.»* L'acquisto manuale da
backoffice (`createManualPurchase`) è **deliberatamente esente**: lì c'è un'operatrice che sa com'è
messa la cliente.

**E il Negozio avvisa prima, non dopo.** L'etichetta del campo ora dice che `maintenance` è un
valore ammesso, e se si sta modificando il piano di mantenimento cambiandogli il periodo compare un
avviso arancione che elenca le quattro cose che si stanno spegnendo. Si vede **prima** di salvare.

## Verifiche

- `npx jest src/commerce/maintenance-plan.spec.ts` → **28 test, tutti verdi** (suite nuova).
- `npx jest src/commerce` → 30 rossi, **esattamente gli stessi 30** che erano rossi prima di questo
  lavoro. Confrontati eseguendo la stessa suite su un worktree pulito fermo a `bca3a7f`: sono
  preesistenti (`commerce.spec.ts`, `accounting.service.spec.ts`, `finance-crm.spec.ts`,
  `reminders.service.spec.ts`, `pipeline.service.spec.ts`) e non riguardano il mantenimento.
- `npx tsc --noEmit` backend → **6 errori, tutti preesistenti** e fuori dai file toccati.
- `npx tsc --noEmit` backoffice → pulito.

I test coprono tutti e tre i lati, perché il difetto è nato proprio dall'aver protetto solo la
vetrina: il DTO accetta `maintenance` in creazione **e in modifica** (era il salvataggio che non
riusciva), la vetrina pubblica non lo mostra mai, la cliente senza obiettivo raggiunto non lo vede
e **non lo compra nemmeno conoscendone l'id**, né da `subscribe` né da `checkout`, mentre a
obiettivo raggiunto entrambe le strade funzionano e il percorso da 3 mesi non è toccato da niente.

C'è anche un test che riproduce **la produzione**: un piano salvato per sbaglio con periodo `1m`
non è più il mantenimento e lo vedono tutte. È lì apposta perché resti scritto che il sintomo
segnalato dipende dal dato, non dal codice.

### Non-vacuità

Ogni protezione è stata rotta una alla volta:

| Rottura | Rossi |
|---|---|
| regex del DTO senza `maintenance` | 3 — i due salvataggi e l'allineamento con `subscriptionEnd` |
| `listPublicPlans` senza filtro | 1 — "la vetrina PUBBLICA non lo mostra mai" |
| `listPlansForClient` senza il controllo obiettivo | 1 — "la cliente che NON ha raggiunto l'obiettivo non lo vede" |
| `assertPlanPurchasable` che non blocca | 3 — i due rifiuti all'acquisto e il caso senza obiettivo |

Nessuna rottura ha lasciato la suite verde, e nessuna ha fatto cadere test che non le riguardavano.
Codice ripristinato e confrontato con la copia di sicurezza: identico.

## File toccati

| File | Cosa |
|---|---|
| `backend/src/commerce/dto/shop-admin.dto.ts` | il periodo si valida per formato (`maintenance` incluso), non per lunghezza |
| `backend/src/commerce/commerce.service.ts` | `isMaintenancePlan`, `listPublicPlans`, `assertPlanPurchasable` su `subscribe` e `checkout` |
| `backend/src/commerce/commerce.controller.ts` | `GET /plans` pubblico senza mantenimento; nuovo `GET /admin/purchases/plans` completo |
| `backoffice/src/pages/Acquisti.tsx` | l'acquisto manuale legge il catalogo completo |
| `backoffice/src/pages/GestioneNegozio.tsx` | etichetta del campo + avviso prima di cambiare il periodo del mantenimento |
| `backend/src/commerce/maintenance-plan.spec.ts` | nuovo: 28 test sui tre lati |
| `backend/prisma/diag-mantenimento.ts` | nuovo: diagnostica di sola lettura |

## Cosa fare dopo il push

Il fix è tutto server e backoffice: **arriva col push**, su Render e Vercel, senza OTA.

Poi va guardato **il dato**, perché il codice non lo sistema da solo:

```
npm run diag:mantenimento
```

È **sola lettura**, si può lanciare in produzione senza rischi. Stampa i piani a catalogo segnando
con `►` quelli che il backend riconosce come mantenimento, dice se un piano dal nome giusto ha il
periodo sbagliato (è il caso da correggere a mano dal Negozio, rimettendo `maintenance`), e elenca
chi ha un abbonamento al mantenimento senza aver raggiunto l'obiettivo.

Su quest'ultimo elenco: va guardato riga per riga, **non corretto in blocco**. Un'attivazione senza
obiettivo raggiunto può essere legittima — decisa da un'operatrice, oppure il peso è risalito dopo.

Un'avvertenza onesta: **da qui il database di produzione non si vede**. Che il periodo del piano sia
stato accorciato è la ricostruzione che spiega tutti i sintomi riportati, ed è esattamente ciò che
lo script serve a confermare. I tre difetti nel codice invece sono certi e dimostrati dai test, a
prescindere da cosa dirà lo script: anche col periodo intatto, la vetrina pubblica lo mostrava a
chiunque e l'acquisto non controllava niente.
