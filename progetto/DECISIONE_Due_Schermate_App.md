# I due dati che la cliente non vede — e la scoperta che cambia la domanda

**Scritto la sera del 18/8/2026, prima del codice — e riletto un'ora dopo, che è il motivo per cui
il §2 adesso dice «quattro» dove diceva «due».** Chiude la parte di analisi della voce 253 («App:
restano DUE dati che il server manda e nessuna schermata mostra»). Tutto quello che c'è qui è
**verificato nel codice**, non ricordato: dove serve c'è il nome del file e della funzione.

> ⛔ **Questo documento non va implementato così com'è.** Finisce con **cinque decisioni** (§6): due
> sono di prodotto e una è clinica. Il codice si scrive dopo.

---

## 0. In una riga

Il primo dei due non è una schermata nuova: è una schermata che **c'è già e calcola da sola** un
numero che il server calcola meglio — e in modo diverso. Il secondo è una schermata nuova davvero,
ma ⚠️ **il dato più vistoso che contiene non vuol dire quello che sembra**.

---

## 1. Cosa mandano davvero i due endpoint

### `GET /me/progress` (`signals/progress.service.ts`) — nessuno lo chiama dall'app

| campo | cos'è |
|---|---|
| `measurementsCount` | quante misure ha registrato (conteggio vero, non la finestra) |
| `current.weightKg` · `weightKgMovingAvg` | l'ultimo peso **e** la sua media mobile |
| `start` | peso, vita e fianchi di partenza |
| `progress.weightPercent` | % verso l'obiettivo, **calcolata sulla media mobile** |
| `progress.lostKg` · `remainingKg` | chili persi e chili che restano |
| `trend.weeklyRateKg` · `direction` | quanto sta calando a settimana, e in che verso |
| `trend.projectedTargetDate` | **la data in cui arriverebbe all'obiettivo** di questo passo |
| `alerts.stallDays` · `stalled` | da quanti giorni il peso non si muove |
| `alerts.rapidLoss` · `rapidLossInPausa` | il guardrail del calo troppo rapido |

⚠️ Le stesse righe le leggono **il motore** (`engine/signals-collector.service.ts:39`) e **l'allarme
di stallo della coach** (`signals/signals.service.ts:332`). Cioè: questo calcolo **agisce già su di
lei**, e lei è l'unica a non vederlo. È il difetto di famiglia del progetto, alla terza ricorrenza.

### `GET /me/cycle` (`cycle/cycle.service.ts`) — mai chiamato da nessuno

Torna: `cycleStart`/`cycleEnd`, lo `state` del ciclo, le **due cotture** (`cooking.g1Label`,
`g2Label`), un `gradimento`, l'`lastOutcome` del ciclo precedente (`esitoPeso`, `esitoCm`,
`followed`) e i `days` con i pasti.

⚠️ **Due cose da sapere prima di disegnarci sopra:**

1. **È un GET che SCRIVE.** `getActiveCycle` fa `clientCycle.update` o `.create` a ogni chiamata
   (`cycle.service.ts:77-81`). ⚠️ E la prima versione di questo foglio scriveva «oggi lo chiama solo lo staff, quindi
   succede di rado»: **non è vero, oggi non lo chiama nessuno** — né `me/cycle` né
   `clients/:id/cycle` compaiono in `app/src` o `backoffice/src`. Quella scrittura oggi ha
   frequenza **zero**; se lo chiama l'app diventa **a ogni apertura**. La scrittura è idempotente
   sul ciclo corrente, quindi non sporca i dati — ma va detto, perché una schermata che scrive
   quando la guardi è una cosa che si scopre sempre nel momento sbagliato.
2. ⚠️ **`gradimento` non è il gradimento.** È il **minimo**, fra le ricette del ciclo, del massimo
   delle stelle che ognuna ha preso — con **default 5 quando una ricetta non è mai stata valutata**
   (`menuGradimento`, `cycle_default_rating`). Serve al motore per capire se il ciclo ha un piatto
   che non le piace. Mostrarlo come «il tuo gradimento: 5 ⭐» a chi non ha votato niente sarebbe
   **esattamente il difetto delle tre stelle inventate** (voce 270), fatto una seconda volta e in
   una schermata.

---

## 2. ⚠️ La scoperta che cambia la domanda sul primo

`app/src/pages/Obiettivo.tsx:465-473` calcola la barra «verso il tuo obiettivo» **da solo**, così:

```ts
const start = series[0];
const current = series[series.length - 1];   // l'ULTIMA misura, quella di stamattina
const pct = ((current - start) / (target - start)) * 100;
```

Il server, per la stessa domanda, usa `progressPercent(start, currentMA, target)` — cioè la **media
mobile**, perché la regola del progetto (spec 7.2, scritta in cima a `progress.service.ts`) è
«**si ragiona sempre sulla tendenza, mai sul singolo dato**».

Quindi oggi:

- la cliente vede una percentuale che **balla con l'acqua**: due etti di ritenzione e la barra torna
  indietro, in una giornata in cui non è successo niente;
- il motore e l'allarme di stallo della coach vedono un'altra percentuale, più stabile, **sulla
  stessa cliente**;
- e nessuno dei due sa dell'altro.

⚠️ **Non è una schermata mancante: sono risposte diverse alla stessa domanda**, che è la cosa che
questo progetto ha deciso di non fare più (17/8: se due punti rispondono alla stessa domanda, uno dei
due deve chiamare l'altro). Il lavoro vero, qui, è **togliere il conto locale**, non aggiungere una
pagina.

### ⚠️ E la prima versione di questo foglio diceva «due»: sono QUATTRO

Rileggendo un'ora dopo ne sono saltate fuori altre due, tutte e due sull'**ultima misura**:

| dove | come | chi lo legge |
|---|---|---|
| `app/src/pages/Obiettivo.tsx:465-474` | ultima misura | la cliente, in «I tuoi obiettivi» |
| `backend/src/signals/progress.service.ts:171` | **media mobile** | il motore, l'allarme di stallo |
| `backend/src/signals/signals.service.ts:685-692` (`widget`) | ultima misura | la cliente, dal widget |
| `backend/src/coach/coach.service.ts:177-180` (elenco clienti) | ultima misura | **la coach** |

Due conseguenze, e cambiano la decisione n.1: **togliere il conto locale da `Obiettivo.tsx` non
basta** — resterebbero tre numeri invece di due; e «la coach vede un numero più stabile» è vero per
l'**allarme di stallo**, ma **falso** per quello che legge nella sua lista clienti. Se si passa alla
media mobile, si passa in tutti e quattro i posti.

---

## 3. Proposta per `/me/progress` — dentro «I tuoi obiettivi», non altrove

1. La barra smette di calcolare e usa `progress.weightPercent` (e `lostKg`/`remainingKg`) del server.
   ⚠️ Sotto la barra si scrive **su cosa** è calcolata («sulla media degli ultimi giorni, non sul peso
   di stamattina»), o il giorno che il numero non si muove dopo una pesata buona sembra rotto.
2. Sopra la barra, **una riga di tendenza**: «−0,4 kg a settimana» con la freccia. È il numero che le
   dice se sta funzionando, ed è quello che il motore usa per decidere.
3. ⚠️ Le misure senza traguardo (le **cosce**) restano come sono: nessuna barra, perché una barra
   senza traguardo misura la distanza da niente (deciso il 18/8).

**Tre stati, come sempre:** meno di `MIN_PESATE_DEFAULT` pesate → non si mostra tendenza né
proiezione e si dice **perché** («ancora poche pesate: fra qualche giorno te lo dico»); dati
sufficienti → i numeri; peso in aumento → si dice, senza girarci intorno e senza colpevolizzare.

**⛔ Quello che NON propongo di mettere lì, e sono due domande per te:**

- **la proiezione della data** (`trend.projectedTargetDate`). Scritta a una cliente diventa **una
  promessa**: «arrivi il 14 novembre». Se rallenta, quella data si sposta e la delusione è nostra,
  non sua. Il Report periodico una proiezione la disegna già (`Report.tsx`, la curva tratteggiata),
  ma lì è **una figura dentro un documento firmato**, non un numero fisso in home;
- **i giorni di stallo** (`alerts.stallDays`). È il dato che fa suonare l'allarme alla coach.
  Mostrarlo alla cliente («ferma da 11 giorni») può essere la spinta giusta o la frase che la fa
  smettere, e questa non è una scelta di software.

---

## 4. Proposta per `/me/cycle` — una scheda dentro il Menu, non una pagina nuova

Quello che ha senso per **lei**, del ciclo:

- **le due cotture** («questi giorni: al forno e in padella»): è la cosa che cambia cosa fa in
  cucina, e oggi non gliela dice nessuno;
- **l'esito del ciclo precedente** (`lastOutcome`): come è andato il ciclo appena chiuso, in una
  riga. ⚠️ Con le parole del prodotto, non i codici (`esitoPeso` è un enum);
- **le date** del ciclo, perché «questi giorni» abbia un confine.

⛔ **Fuori**: il `gradimento`, per il motivo del §1.2 — a meno di non mostrarlo per quello che è
(«il piatto che ti è piaciuto meno di questo ciclo»), e solo **se** quella ricetta è stata davvero
valutata. Con il default a 5 non lo è quasi mai.

⚠️ E prima di collegare l'app a quell'endpoint va deciso cosa fare della **scrittura** (§1.1): o la
si accetta dichiarandola, o `getActiveCycle` si separa in due (una lettura pura per la cliente, la
scrittura dove serve allo staff). La seconda è più lavoro, ma è l'unica che rende quella rotta
quello che sembra.

---

## 5. Cosa non propongo, e perché

- **Una pagina «Progressi» nuova.** I numeri di `/me/progress` rispondono alla domanda di «I tuoi
  obiettivi»: metterli altrove vorrebbe dire due posti dove si guarda la stessa cosa — e uno dei due
  continuerebbe a calcolare per conto suo.
- **Un grafico nuovo.** Il grafico c'è già nel Report. Un secondo grafico, con una serie calcolata
  diversamente, è il modo più rapido di far dire due cose diverse agli stessi dati.

---

## 6. ⛔ Le cinque decisioni

1. **La percentuale in app passa alla media mobile del server?** (proposta: sì — è la stessa domanda
   e oggi ha due risposte). ⚠️ Conseguenza da accettare: per qualche cliente il numero **cambierà**
   il giorno del rilascio, e in qualche caso all'indietro.
2. **La proiezione della data obiettivo si mostra?** No · sì · solo nel Report com'è adesso.
3. **I giorni di stallo si mostrano?** No · sì · sì ma solo sopra una soglia, con una frase scritta
   dalla nutrizionista.
4. **Del ciclo, cosa vede?** Solo le cotture · cotture + esito precedente · anche il gradimento
   (⚠️ e allora bisogna decidere cosa farne del default a 5).
5. **`getActiveCycle` resta un GET che scrive** o si separa in lettura e scrittura prima di
   collegarci l'app?

Le prime tre le può decidere Simone; la **3** vale la pena chiederla alla nutrizionista, perché è
una frase che arriva a una persona che sta facendo fatica.
