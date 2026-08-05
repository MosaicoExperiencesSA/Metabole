# Registro — "Ho corretto la data inizio piano ma non cambia niente"

**Data:** 5 agosto 2026 · Segnalazione di Simone su `giusy.vita01@gmail.com`: «ho corretto la data
inizio piano ma non si corregge né la fine né torna attivo il piano».

Nella scheda si leggeva: *Inizio piano 06/08/2026 · attivato il 17/07/2026 · fine 25/07/2026*, con
i badge **"Nessun piano attivo"** e **"Prova Gratuita · Scaduto"**. La matita accettava la nuova
data, compariva il messaggio di conferma, e la scheda restava identica.

## Cosa succedeva davvero

Il salvataggio funzionava. Solo, **spostava le date di un altro abbonamento**.

La scheda cliente e la matita "Inizio piano" leggono la stessa lista di abbonamenti (ordinata dal
più recente) ma sceglievano **con due regole diverse** quale fosse "l'abbonamento della cliente".

La scheda (`getDetail`) usava la catena completa:

```
attivo → in attesa → qualunque stato non terminale → scaduto → il più recente
```

La matita (`updatePlanStart`) si fermava tre gradini prima:

```
attivo → in attesa → il più recente
```

Finché una cliente ha un solo abbonamento le due catene danno lo stesso risultato e non si vede
niente. Ma su Giusy ci sono **due** righe: la **Prova Gratuita scaduta** (attivata il 17/07, fine
25/07) e, creato **dopo**, un checkout da 3 mesi rimasto **annullato** perché mai pagato.

Nessuno dei due è attivo o in attesa. Quindi la scheda scendeva fino a "scaduto" e mostrava la
prova; la matita scendeva a "il più recente" e prendeva **l'annullato**. Ogni correzione della data
finiva sul checkout annullato, che nella scheda non compare nemmeno. La prova restava con le sue
date di luglio, e il piano non tornava attivo perché la riattivazione — giustamente — non tocca gli
abbonamenti annullati (`reactivate` vale solo per `active` e `expired`: un checkout mai pagato non
deve diventare un piano valido).

Dal lato dell'operatore: messaggio di successo, scheda immutata, nessun errore da nessuna parte.

### Da dove viene la differenza

Non è un errore di scrittura, è una **regola copiata tre volte** e aggiornata una volta sola. La
storia in git lo dice con precisione: il commit `f894539` scrive la catena corta in
`clients.service.ts`; il commit successivo `fa08b7e` scrive quella lunga in `profile.service.ts`
(che allinea l'abbonamento quando è la cliente a scegliere la data dall'app) **senza riportarla
indietro**. Da quel momento l'app e il backoffice sceglievano abbonamenti diversi.

## Com'è ora

Una sola funzione, `pickMainSubscription`, in `backend/src/commerce/commerce.service.ts`, con
scritto sopra perché esiste. Tutti e tre i punti la chiamano: la scheda, la matita del backoffice e
l'allineamento fatto dall'app. **Non è più possibile che due schermate scelgano abbonamenti
diversi**, perché la scelta è scritta in un posto solo.

La priorità è quella completa: attivo, poi in attesa, poi qualunque stato non terminale (per
esempio in pausa), poi scaduto, e solo come ultima spiaggia il più recente — che a quel punto può
essere solo un annullato. Cioè: la matita sposta **l'abbonamento che l'operatore vede scritto nella
scheda**, sempre.

### Il messaggio dice anche su cosa ha agito

Prima il messaggio era *"Inizio piano spostato al …"* e basta. Con più abbonamenti in scheda non
bastava a capire se si era toccato quello giusto. Ora `PATCH /admin/clients/:id/plan-start`
restituisce anche il **nome del piano spostato**, il suo **stato** e se è stato **riattivato**, e la
scheda li scrive:

> Inizio piano spostato al 06/08/2026 (fine ricalcolata: 14/08/2026) su «Prova Gratuita» — piano
> riportato ad ATTIVO.

Se invece l'abbonamento resta scaduto o annullato, il messaggio lo dice: è l'informazione che
mancava per accorgersi del difetto senza andare a guardare il database.

E se non c'è nessun abbonamento su cui agire, ora arriva un errore esplicito invece di un silenzio.

## Verifiche

- `npx jest src/clients` → **10 test, tutti verdi** (suite nuova `plan-start.spec.ts`).
- `npx tsc --noEmit` backend → **6 errori, tutti preesistenti** e tutti fuori dai file toccati
  (`prisma/approve-diets.ts`, `prisma/dedupe-diets.ts`, `cron.controller.spec.ts`,
  `escalation-routing.service.spec.ts`, `onboarding.service.spec.ts`).
- `npx tsc --noEmit` backoffice → pulito.

I test ricostruiscono **esattamente la situazione di Giusy**: un checkout annullato da 3 mesi creato
dopo una prova gratuita di 8 giorni scaduta. Verificano che la matita sposti la prova e non
l'annullato, che la fine sia ricalcolata sugli **8 giorni** della prova e non sui 3 mesi dell'altro
piano, che con la nuova fine nel futuro la prova torni attiva, che con la fine ancora nel passato
non si riattivi niente, che un abbonamento in attesa (pagamento non approvato) **non** venga
riattivato, e che venga riallineata anche la data d'inizio del profilo, quella che comanda i menu.

### Non-vacuità

Rimesso il vecchio selettore corto in `updatePlanStart` → rossi **esattamente tre** test, e sono i
tre che descrivono la segnalazione: "sposta la prova scaduta, non il checkout annullato", "ricalcola
la fine dalla durata del piano spostato" e "riporta la prova scaduta ad attivo". Ripristinato il
codice: 10 verdi.

## File toccati

| File | Cosa |
|---|---|
| `backend/src/commerce/commerce.service.ts` | nuova `pickMainSubscription`: la scelta dell'abbonamento principale, in un posto solo |
| `backend/src/clients/clients.service.ts` | scheda e matita usano la stessa scelta; la risposta dice piano, stato e riattivazione |
| `backend/src/profile/profile.service.ts` | l'allineamento fatto dall'app usa la stessa scelta |
| `backoffice/src/pages/ClientDetail.tsx` | il messaggio dice su quale piano ha agito e com'è rimasto |
| `backend/src/clients/plan-start.spec.ts` | nuovo: 10 test, scenario Giusy |
| `backend/prisma/diag-abbonamenti-cliente.ts` | nuovo: diagnostica di sola lettura |

## Cosa fare per Giusy

Il fix è tutto server: **arriva col push su Render**, senza OTA.

Dopo il deploy va **ri-salvata la data d'inizio dalla scheda**. Le correzioni fatte finora sono
finite sull'abbonamento annullato e restano lì: nessuno script le sposta indietro, e non serve —
basta rifare il salvataggio, che ora agisce sulla riga giusta e, se la nuova fine cade nel futuro,
riporta da solo il piano ad **attivo**.

Per vedere com'è messa davvero una cliente prima e dopo:

```
npm run diag:abbonamenti -- --email=giusy.vita01@gmail.com
```

È **sola lettura**, si può lanciare in produzione senza rischi. Stampa tutti gli abbonamenti
nell'ordine in cui il backend li legge, segna con `►` quello principale (cioè quello che la scheda
mostra e la matita sposta), e dice se la data del profilo e quella dell'abbonamento sono
disallineate, se la fine non corrisponde alla durata del piano, e se lo stato è incoerente con le
date.

Una avvertenza onesta: **da qui il database di produzione non si vede**. Che su Giusy ci sia
davvero un checkout annullato creato dopo la prova è la ricostruzione che spiega tutti i sintomi
riportati, ed è esattamente ciò che lo script serve a confermare. Il difetto nella scelta
dell'abbonamento invece è certo e dimostrato dai test, a prescindere da cosa dirà lo script.
