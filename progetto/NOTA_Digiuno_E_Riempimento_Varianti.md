# Il digiuno intermittente è sbagliato, e le 18 varianti da riempire

Scritta prima del codice, 17/8/2026. Tutto quello che segue è **verificato nel codice**, con file e
riga: dove il documento e il codice divergevano, ho tenuto il codice.

---

## 1. Come sono fatte oggi le varianti

Una **famiglia** di dieta (`Diet.name` + `style`) si declina su tre assi:

| asse | valori | dove |
|---|---|---|
| regime | `omnivore`, `vegetarian`, `vegan` | `catalog.service.ts:1256` (`DEFAULT_REGIMES`) |
| obiettivo | `dimagrimento`, `mantenimento` | `Diet.objective` |
| struttura pasti | `3`, `5`, `fasting` | `engine-rules.service.ts:250` |

3 × 2 × 3 = **18**. È la griglia che il backoffice chiama «genera tutte le 18 varianti»
(`CreazioneValidazione.tsx:192`).

La variante `fasting` è una riga `Diet` con `fasting: true` e `mealsPerDay: 3`, e i suoi tre slot
sono **fissi**: `lunch`, `afternoon_snack`, `dinner` (`engine-rules.service.ts:255`,
`giornate-complete.ts:21`, `copertura-catalogo.ts:168`). Cioè: la variante digiuno esistente è, di
fatto, **la variante "salta la colazione"**, e nessun campo lo dice.

---

## 2. ⚠️ In che modo esattamente sono sbagliati i digiuni

L'erogazione fa due cose in fila:

1. `pickDietFor` sceglie la dieta: se `pathType === 'intermittent_fasting'` cerca `{fasting: true}` e
   **ignora `mealsPerDay`** (`pick-diet.ts:49-50`);
2. `menu.service` toglie dalla giornata gli slot della finestra (`slotEsclusiTotali`,
   `menu.service.ts:626`) — quindi filtra un pool che ha **solo pranzo, merenda e cena**.

Il risultato, finestra per finestra (la tabella delle finestre è `finestre-digiuno.ts:52`):

| finestra scelta dalla cliente | cosa dovrebbe mangiare | **cosa riceve oggi** | kcal della giornata |
|---|---|---|---|
| salta colazione | pranzo, merenda, cena | pranzo, merenda, cena | **100%** ✔ |
| salta cena | colazione, spuntino, pranzo | **solo il pranzo** | **45%** ✘ |
| salta pranzo | colazione e cena | **merenda e cena** | 55% ✘ |
| salta colazione e pranzo | solo cena | merenda e cena | 55% ~ |
| salta cena e colazione | solo pranzo | solo pranzo | 45% ✔ |

Le percentuali vengono dalle quote con cui le ricette sono state generate
(`quoteKcalPerSlot`, `engine-rules.service.ts:35`): nella variante digiuno pranzo .45, merenda .10,
cena .45.

**Una cliente che ha scelto «salto la cena» riceve un pasto al giorno.** Non è un'ipotesi: è quello
che esce da quelle tre righe messe in fila. E non lo segnala niente — la rete di sicurezza di
`dayComboPools` (`menu.service.ts:1510`) impedisce solo la giornata **vuota**, non quella monca.

Hai ragione tu, e il modo in cui hai ragione è più grave di come l'hai detto.

---

## 3. ⚠️ La parte che la tua frase non copre: le calorie

«Il digiuno è uguale al 5 pasti, solo che eroga quelli corretti» risolve **quali** pasti. Non
risolve **quanto grandi** sono.

Le ricette nascono dimensionate su una quota della giornata. Nel catalogo a 5 pasti le quote sono
colazione .20, spuntino .10, pranzo .35, merenda .10, cena .25 (`engine-rules.service.ts:37`).
Se da lì si tolgono dei pasti, quello che resta **non si ingrandisce**: `DayCombo` sceglie una
ricetta per slot dentro il pool esistente (`day-combo.service.ts:39`), non moltiplica le porzioni —
non esiste da nessuna parte un moltiplicatore di porzione.

Quindi, servendo il catalogo a 5 pasti a una cliente in digiuno:

| finestra | pasti erogati | somma delle quote |
|---|---|---|
| salta colazione | pranzo, merenda, cena | 70% |
| salta cena | colazione, spuntino, pranzo | 65% |
| salta pranzo | colazione, spuntino, merenda, cena | 65% |
| salta colazione e pranzo | merenda, cena | 35% |
| salta cena e colazione | pranzo | 35% |

E quando la somma non entra nella banda del target, `DayCombo` restituisce `null`
(`day-combo.service.ts:56`) e si ricade sul selettore per-slot: la giornata viene servita **corta,
in silenzio**. Nessun log, nessuna segnalazione.

È lo stesso difetto di famiglia che questo progetto ha già pagato tre volte: **un dato che agisce e
non si vede**. Solo che qui quello che non si vede sono le calorie di una cliente.

⚠️ Nota che questo buco **esiste già oggi** anche fuori dal digiuno, in piccolo: quando Vera toglie
i due spuntini (`pastiEsclusi`), la giornata perde il 20% e nessuno lo dice. Va in elenco lavori a
parte.

---

## 4. Le tre strade, con il loro prezzo

### A. Digiuno = catalogo a 5 pasti (quello che dici tu, alla lettera)

`pickDietFor` smette di cercare `{fasting: true}` e cerca la variante a **5 pasti**; il filtro della
finestra fa il resto.

- ✔ i pasti giusti in **tutte e cinque** le finestre;
- ✔ costo zero: nessuna ricetta nuova, nessuna chiamata all'AI;
- ✘ le kcal restano fra il 35% e il 70% del fabbisogno;
- ✘ **peggiora** chi salta la colazione: oggi ha il 100%, passerebbe al 70%.

### B. Una variante per finestra

Cinque cataloghi di digiuno invece di uno, ognuno con le sue quote che sommano a 1 (per «salta la
cena»: colazione .25, spuntino .10, pranzo .65). La finestra si distingue con `Diet.options.window`,
che già esiste (`engine-rules.service.ts:474`) — nessuna migrazione.

- ✔ pasti giusti **e** calorie giuste, in tutte le finestre;
- ✘ la griglia passa da 18 a 3 regimi × 2 obiettivi × 7 strutture = **42 varianti** per famiglia;
- ✘ le ricette delle finestre nuove **non esistono e non si possono riciclare**: vanno generate
  dall'AI, ~5 pasti × 12 settimane per ogni combinazione nuova.

### C. La porzione si scala all'erogazione

Il menu porta un moltiplicatore («pranzo, porzione ×1,6») e le kcal tornano senza duplicare niente.

- ✔ un catalogo solo, calorie giuste, e risolve anche il buco degli spuntini tolti;
- ✘ è lavoro sul motore, sull'app e sulla lista della spesa, non uno script;
- ✘ una porzione ×1,6 di un piatto pensato per essere piccolo non sempre è un piatto sensato.

**La mia raccomandazione:** A subito, perché tre finestre su cinque oggi sono rotte e A le
raddrizza senza spendere niente; poi B **solo per le finestre che le clienti usano davvero** — che
è un numero che possiamo contare in banca dati prima di spendere un euro di AI.

⚠️ Ma la scelta è tua, perché è una scelta clinica prima che tecnica: A dice «meglio i pasti giusti
un po' scarsi che il pasto sbagliato», e questo lo decide chi firma le diete.

---

## 5. Lo script: cosa può fare, e cosa non può

`prisma/riempi-varianti.ts`, sulla falsariga degli altri: anteprima di default, `CONFERMA=1` per
scrivere, si lancia dalla shell di Render. **Non aggiorna mai una riga esistente, solo aggiunge** —
è la lezione di `accendi-automazioni.ts`.

### Quello che può fare senza AI

Il generatore lo dice chiaro (`engine-rules.service.ts:264`): le varianti che cambiano **solo la
struttura pasti** condividono le ricette — «la Keto Mediterranea onnivora a 3 pasti, a 5 pasti e a
digiuno mangia gli stessi piatti». Quindi, per ogni gruppo **(nome, stile, regime, obiettivo)** che
in banca dati ha già delle ricette, lo script può:

1. creare le varianti di struttura mancanti;
2. riempirle fino a **84 giornate** (12 settimane × 7), pescando dalle ricette delle sorelle, slot
   per slot, senza ripetere dentro la settimana;
3. metterle `approved` + `clientVisible` + `siteVisible`.

Ogni giornata scritta è **completa** secondo `pastiAttesi` (`giornate-complete.ts:20`) — altrimenti
l'erogazione la scarta e il riempimento sarebbe finto.

### ⚠️ Quello che NON può fare

Non può creare le varianti di un **regime** o di un **obiettivo** che non ha già ricette sue.

- Regime: mettere una ricetta onnivora in una dieta vegana è l'errore che il generatore evita
  apposta (`engine-rules.service.ts:396`), ed è silenzioso: nessuno se ne accorge finché non se ne
  accorge una cliente.
- Obiettivo: dimagrimento e mantenimento hanno target diversi (1500 vs 1800 nella Keto-Mediterranea,
  `engine-rules.presets.ts`), quindi porzioni diverse. Riusarle vorrebbe dire servire un
  mantenimento a porzioni da dimagrimento.

Quindi: **le 18 varianti si riempiono tutte solo se in banca dati esistono già ricette per tutti e
sei i gruppi (3 regimi × 2 obiettivi) di quella famiglia.** Dove mancano, lo script non inventa: le
elenca e si ferma. Quelle si generano dal backoffice, con l'AI, e costano.

L'anteprima serve esattamente a questo: dice, famiglia per famiglia, quante varianti mancano
riempibili subito e quante richiedono l'AI. È un numero che oggi non abbiamo.

---

## 6. Cosa non tocco

- nessuna riga esistente viene aggiornata o cancellata — comprese le varianti `fasting: true` di
  oggi, che restano dove sono anche se l'erogazione smette di sceglierle;
- le famiglie mostrate alla cliente si deduplicano per nome (`catalog.service.ts:1332`), quindi
  aggiungere varianti **non** aggiunge prodotti nel Negozio;
- niente migrazioni.

---

# I numeri veri (letti in banca dati il 17/8)

Questa sezione sostituisce le stime della parte sopra: `npm run diag:digiuni` e `npm run diag:settimane`
girati su produzione.

## I digiuni: 7 clienti, 1 rotta

|   | finestra | esito |
|---|---|---|
| 5 | salta la colazione | ✔ pasti giusti, kcal giuste |
| 1 | **salta la cena** — Sonia, `s.sandri66@libero.it` | ✘ **riceve il solo pranzo** |
| 1 | finestra **non impostata** — Maria, `mariabonaccorso@hotmail.it` | non è rotta: nessuno gliel'ha chiesta |

⚠️ Maria era un falso positivo del mio script: senza finestra, «dovrebbe ricevere tutti e cinque i
pasti» è una frase che ho scritto io, non una promessa fatta a lei. Riceve il 16:8 classico, che è il
default sensato. Il suo problema è che la domanda non le è mai stata fatta.

Quindi la strada **B** della sezione sopra (una variante per finestra, ~30 varianti a famiglia) è
sproporzionata: le finestre davvero usate sono due, e una sola è rotta.

## Le varianti: il catalogo è enorme e quasi tutto inutilizzato

- **306 diete in catalogo.** 101 a posto, 205 da rifare.
- **Le varianti con qualcuno sopra sono 16, per 25 clienti in tutto.**
- Quelle 16 stanno in **12 gruppi di ricette** (nome + stile + regime + obiettivo), e dentro un
  gruppo le tre strutture pasti condividono le ricette: **si genera 12 volte, non 16**.

| gruppo da rigenerare | clienti |
|---|---|
| Flexitariana · omnivore · dimagrimento | **11** |
| Pescetariana · omnivore · dimagrimento | 3 |
| Keto (non terapeutica) · omnivore · dimagrimento | 2 |
| Mediterranea · omnivore · dimagrimento | 1 |
| Mediterranea · vegetarian · dimagrimento | 1 |
| Pescetariana · vegetarian · dimagrimento | 1 |
| Keto-Mediterranea · omnivore · dimagrimento | 1 |
| Low carb · omnivore · dimagrimento | 1 |
| Proteica · omnivore · dimagrimento | 1 |
| Vacanze in Serenità · omnivore · dimagrimento | 1 |
| Vegana · vegan · dimagrimento | 1 |
| Digiuno intermittente (16:8) · omnivore · dimagrimento | 1 |

⚠️ **Tutti e dodici sono `dimagrimento`, e undici su dodici sono `omnivore`.** Metà della griglia dei
18 — l'intera colonna `mantenimento`, e quasi tutto il vegano e il vegetariano — oggi non serve
nessuno. Generare «tutte le 18 varianti di tutte le famiglie» vorrebbe dire pagare ricette nuove per
290 diete su cui non mangia nessuno.

Il primo gruppo da solo copre **11 clienti su 25**.

## ⚠️ Perché lo script che era stato chiesto non è il lavoro

Le varianti da rigenerare hanno **28 giornate ma 19 ricette diverse per pasto**: sono state fatte col
metodo vecchio, che ricombinava pochi piatti su tante giornate. Ne servono 7 nuove per pasto per
settimana.

Aggiungere giornate pescando dalle sorelle non aggiunge un piatto: le sorelle hanno le stesse 19
ricette. E non cambierebbe nemmeno cosa vede la cliente, perché il motore non serve le giornate del
catalogo così come sono — ne prende le ricette, fa il pool per pasto e ricompone la giornata a ogni
erogazione (`dayComboPools`). Le giornate in più sono combinazioni in più **degli stessi piatti**.

Che è, alla lettera, il difetto corretto l'8/8: «il catalogo sembrava pieno (28 giorni) ma i piatti
erano pochi, e la stessa colazione tornava cinque o sei volte al mese».

**Quello che serve è il generatore del backoffice, su 12 gruppi, in quell'ordine.** Che sei diete
(Basso indice glicemico, DASH, Detossinante, Mediterranea senza glutine, Flessibile, e le loro
varianti) siano già a 84 giornate con 84 ricette per pasto dimostra che la strada funziona: è stata
percorsa per le famiglie sbagliate, cioè quelle senza clienti.
