# Quando Vera non capisce: una seconda lettura, non una seconda decisione

Scritta il 17/8/2026, dopo tre rotture in un giorno.

---

## 1. Il problema, con le prove di oggi

| ora | frase di Simone | cosa è successo |
|---|---|---|
| 11:02 | «Jolanda Todde non darle più i ceci» | il nome apriva la frase e non veniva letto |
| 11:52 | «quale sostituzione devo verificare?» | la domanda che fa la pastiglia non era fra le forme |
| 13:41 | «a jolanda **sostitusci** ceci con fagioli» | **una lettera**: `sostitusci` invece di `sostituisci` |

Tre volte, tre espressioni regolari aggiunte a mano. Tutte e tre le correzioni sono giuste e
restano. Ma la conclusione da trarne non è «adesso ne mancano meno»: è che **le frasi vere sono
infinite e le forme scritte a mano no**, e chi sta dall'altra parte non impara «ho sbattuto un
tasto» — impara «non funziona».

⚠️ E il costo non è solo la frase persa. È che dopo due «non ci arrivo» una persona smette di
provare, e uno strumento che si usa per metà è peggio di uno che non c'è: occupa il posto.

---

## 2. Cosa NON si deve fare

Far decidere al modello. Vera scrive nel piatto di 315 persone: la regola di casa — *un agente che
indovina quando non ha capito è più pericoloso di uno che chiede* — non è negoziabile, e `null` deve
restare una risposta legittima.

Un modello che legge «a Giulia niente formaggi» e **esegue** è un modello che un giorno leggerà
«a Giulia niente formaggi?» — con il punto interrogativo — e eseguirà lo stesso.

---

## 3. Cosa propongo: il modello TRADUCE, il codice DECIDE

```
frase  →  capisci()  →  intento     ← la strada di oggi, invariata
              ↓ null
         modello: «riscrivi questa frase nella forma canonica»
              ↓
       frase normalizzata  →  capisci()  →  intento
              ↓ ancora null
         «non ci arrivo» — esattamente come oggi
```

Tre proprietà, e sono tutte e tre il punto:

1. **Il modello non vede mai i dati e non tocca mai il database.** Riceve una stringa, restituisce
   una stringa. Non sa chi è Jolanda, non sa cosa c'è in catalogo, non può scrivere.
2. **A decidere resta `capisci`**, con le sue forme dichiarate e i suoi test. Se la riscrittura non
   passa da lì, non succede niente — come oggi.
3. **La riscrittura si mostra prima di eseguire.** «Ho capito così: *a Jolanda, ceci → fagioli*.
   Confermi?» La conferma c'è già in tutti i flussi: qui diventa anche il punto in cui una
   traduzione sbagliata si vede e si ferma.

⚠️ La differenza fra questo e «usare l'AI per capire i comandi» è tutta qui: il modello non allarga
quello che Vera **sa fare**, allarga solo il modo in cui glielo si può **dire**. L'insieme delle
azioni possibili resta quello scritto in `capisci.ts`, riga per riga.

---

## 4. ⚠️ Le tre cose che possono andare storte, e cosa le ferma

**Una riscrittura plausibile ma sbagliata.** «a Giulia togli il pesce» → «a Giulia togli il pesce e
i crostacei». La ferma la conferma, perché la frase riscritta si legge prima di eseguire. Ma va
mostrata **la riscrittura**, non solo l'intento: «ceci → fagioli» non fa vedere che si è aggiunto
qualcosa, la frase sì.

**Una domanda letta come ordine.** «posso togliere il pesce a Giulia?» → «togli il pesce a Giulia».
Questa è la più insidiosa, ed è la ragione per cui `daScartare` deve girare **prima** della seconda
lettura e non dopo: una frase con il punto interrogativo non arriva nemmeno al modello.

**Il modello non risponde.** Credito finito, 503, lentezza. Allora si ricade su «non ci arrivo», che
è il comportamento di oggi: la seconda lettura è un **di più**, e se manca non manca niente.

---

## 5. Cosa costa

Una chiamata al modello **solo** quando `capisci` torna `null` — oggi succede su una frase su
cinque, e su quelle il giro è già perso. Il prompt è corto (la frase più l'elenco delle forme
canoniche), la risposta è una riga.

E c'è un guadagno che non si paga: **ogni riscrittura andata a buon fine è una frase vera da
aggiungere ai test.** Il corpus delle frasi non capite esiste già (`vera/corpus.ts`, il pannello nel
backoffice): con la seconda lettura si riempie da solo di coppie «come l'ha detta» → «come si
scrive», che è esattamente il materiale con cui si allargano le forme deterministiche. Il modello
diventa il modo per **smettere** di aver bisogno del modello.

---

## 6. Cosa serve da Simone

Un sì o un no su questo, e su una cosa sola in particolare: **il modello che riscrive una frase
diretta a 315 clienti va bene, se non decide e se quello che ha capito si legge prima di eseguire?**

Se è sì, si fa così. Se è no, resta la strada di oggi — si aggiungono forme quando si rompono — e va
messo in conto che si romperà ancora, perché è nella natura di un elenco scritto a mano.
