# Registro — "Rigenera menu" sembra funzionare ma i menu non compaiono

**Data:** 5 agosto 2026 · Segnalazione di Simone su `giusy.vita01@gmail.com`: «non riesco a far
rigenerare i menu» → alla domanda su cosa succede: **«sembra andare, ma i menu non compaiono»**.

## Cosa succedeva davvero

Il tasto **Rigenera menu** funzionava. I menu venivano generati e scritti in tabella. Semplicemente
**non tornavano indietro all'app**, perché la richiesta che l'app fa per leggerli chiedeva i giorni
sbagliati.

`GET /me/menu` → `MenuService.getMenu` leggeva così:

```ts
const menuDays = await this.prisma.menuDay.findMany({
  where: { clientId, visibleFrom: { lte: today }, …from/to },
  orderBy: { date: 'asc' },
  take: 30,
});
```

`take: 30` con ordinamento **crescente** e **nessun limite inferiore sulla data**. Finché una
cliente ha meno di 30 giorni di menu erogati tutto funziona: i suoi giorni ci stanno tutti dentro.
Al trentunesimo giorno la finestra si riempie di **passato** e da lì in poi l'app riceve
sistematicamente **i 30 giorni PIÙ VECCHI** del percorso. Oggi resta fuori. Domani anche.

Da lì in poi il difetto è permanente e peggiora ogni giorno: al sessantesimo giorno la cliente
sta guardando i menu del primo mese.

### Perché sembrava che i menu non venissero generati

Tre schermate diverse sbagliano tutte insieme, e nessuna dice "non trovo il giorno di oggi":

- **Home** cerca esattamente la data di oggi (`days.find(d => d.date.slice(0,10) === iso)`,
  `app/src/pages/Home.tsx`). Non trovandola non mostra nessun pasto.
- **Menu** costruisce `upcoming = days.filter(d => d >= oggi)` e seleziona `upcoming[0]`
  (`app/src/pages/Menu.tsx`). Con soli giorni passati `upcoming` è vuoto: nessun giorno da aprire.
- **Lo stato** ci mette il carico da undici. `getMenu` passa a `menuStatus` il flag
  `hasVisibleMenu` calcolato **su quegli stessi 30 giorni**: risultando `false`, `menuStatus`
  saltava il controllo "menu già visibile" e scendeva fino in fondo, restituendo `preparing` —
  *"il menu è in preparazione, comparirà a breve"*. Un messaggio rassicurante e falso, mentre il
  giorno di oggi era in tabella da ore.

Il backoffice invece i menu li vedeva: `GET /admin/clients/:id/menus` ha una finestra corretta
(da −56 a +7 giorni, `orderBy desc`, `take 70`). Ecco perché dalla scheda cliente sembrava tutto a
posto e dal telefono no.

### Non riguarda solo Giusy

Non c'è niente di specifico su questa cliente: **il difetto colpisce chiunque superi i 30 giorni di
menu erogati**. I giorni si accumulano uno al giorno (`menu_days_delivered` = 2 alla volta, ma
sempre in avanti) e nessuno cancella il passato — la pulizia esistente
(`prune-menu-after-planend`) tocca solo i giorni oltre la fine del piano. Giusy è semplicemente la
prima ad arrivarci. Chi è sotto i 30 giorni non vede nulla di strano, e questo spiega perché non
era mai emerso prima.

## Com'è ora

La finestra **scorre e prende i giorni più recenti**, non i primi:

```ts
orderBy: { date: 'desc' },
take: MENU_WINDOW_DAYS,   // 30
…
menuDays.reverse();       // l'app si aspetta l'ordine crescente
```

Ordinando al contrario, oggi e i giorni già erogati in avanti sono **sempre** dentro la finestra:
sono i più recenti, quindi i primi a essere presi. Lo storico che resta leggibile diventa "l'ultimo
mese" invece di "il primo mese" — che è anche quello che serve davvero a chi guarda indietro.

`MENU_WINDOW_DAYS` è ora una costante con scritto sopra a cosa serve: è un tetto al **peso della
risposta** (ogni giorno si porta dietro lo snapshot dei pasti), non un limite del percorso. Prima
il `30` era un numero nudo in mezzo alla query, ed è esattamente il motivo per cui nessuno si era
chiesto cosa succede al trentunesimo giorno.

### Un secondo difetto trovato nella stessa query

Il filtro sulle date era costruito con due spread separati:

```ts
...(from ? { date: { gte: … } } : {}),
...(to   ? { date: { lte: … } } : {}),
```

Passando **sia `from` sia `to`**, la seconda chiave `date` sovrascrive la prima: il limite
inferiore spariva, in silenzio, senza errori. Oggi nessuna schermata chiama `/me/menu` con un
intervallo (le quattro chiamate in `Home.tsx`, `Menu.tsx`, `Percorso.tsx` e `MenuReviewPopup.tsx`
lo chiamano nude), quindi non ha mai fatto danni — ma è una trappola pronta per il primo che userà
l'intervallo. Ora i due limiti finiscono in **un solo oggetto** `date`.

## Verifiche

- `npx jest src/menu` → **3 suite, 61 test, tutto verde** (erano 57: 4 nuovi).
- `npx tsc --noEmit` backend → **6 errori, tutti preesistenti** e tutti fuori da `src/menu`
  (`prisma/approve-diets.ts`, `prisma/dedupe-diets.ts`, `cron.controller.spec.ts`,
  `escalation-routing.service.spec.ts`, `onboarding.service.spec.ts`).

### Come sono fatti i test nuovi

Il finto Prisma dei test restituiva sempre la stessa lista, quindi non poteva accorgersi della
differenza tra "i primi 30" e "gli ultimi 30". I test nuovi **emulano `orderBy` e `take`** su uno
storico di 45 giorni che finisce dopodomani — una cliente al secondo mese, con i due giorni già
erogati in avanti. È l'unico modo perché il test veda il difetto.

Aggiunto anche `subscription.findMany` ai mock: `menuStatus` lo legge per capire se il percorso è
concluso, e senza di esso i test su `getMenu` morivano prima di arrivare all'asserzione.

### Non-vacuità

I quattro test sono stati messi alla prova rompendo il codice di proposito, uno alla volta:

1. rimesso `orderBy: 'asc'` senza `reverse` (il codice di prima) → rossi **esattamente** i due test
   sulla finestra: "la finestra contiene comunque OGGI" e "lo stato è available, non preparing".
   Cioè il test riproduce la segnalazione, compreso il messaggio sbagliato.
2. tolto solo `menuDays.reverse()` → rosso **solo** il test sull'ordine crescente (1 su 45).
3. rimessi i due spread separati su `date` → rosso **solo** il test su `from` + `to` (1 su 45).

Ripristinato il codice: 45 passati.

## File toccati

| File | Cosa |
|---|---|
| `backend/src/menu/menu.service.ts` | finestra `getMenu` sui giorni più recenti, costante `MENU_WINDOW_DAYS`, `from`+`to` in un solo filtro |
| `backend/src/menu/menu.service.spec.ts` | 4 test nuovi sulla finestra, mock `subscription.findMany` |

## Cosa fare per Giusy

Niente di manuale: **al push il fix va live su Render** e i menu già in tabella ricompaiono da soli
alla prima apertura. Non serve premere di nuovo "Rigenera menu" — anzi, meglio di no: quel tasto
**cancella prima e rigenera dopo** (`deleteMany(date >= oggi)` e poi `deliverIfEligible`), quindi se
per qualsiasi motivo l'erogazione si blocca la cliente resta con zero giorni. Se dopo il push i
menu ancora non si vedessero, allora il problema è un altro e c'è
`npm run diag:rigenera -- --email=giusy.vita01@gmail.com` (commit `c54c53d`) che dice quale
controllo sta bloccando l'erogazione.

Da tenere presente: **l'app installata non c'entra**. Questo è tutto server, arriva col push, e si
vede subito anche sul bundle vecchio — nessuna OTA necessaria per questo fix.
