# Verificare a voce i cambi concordati in chat — foglio per Simone (14/8/2026)

La voce 245, nata dal tuo screenshot della scheda cliente: la tabella «Cambi concordati in chat»
con ✓ / ✎ / ✗, e la riga di aiuto che dice *«correggendo qui scrivi sulla giornata di questa
cliente, e lei riceve una notifica con la tua nota»*.

---

## Quello che c'è già (verificato)

- Gaia propone la sostituzione **a pari grammatura** e la registra come `da_verificare`.
- In scheda la nutrizionista ha tre gesti: **conferma** (verificata), **correggi** (scrive i grammi
  giusti sulla giornata di quella cliente e le manda una notifica con la nota), **rifiuta**.
- Il quadro della giornata di Vera **conta già** quante sono («3 sostituzioni da verificare»), ma
  non le porta dentro la conversazione.

⚠️ Il caso che rende tutto delicato è scritto nella riga di aiuto della pagina: **70 ml di panna
sono ~200 kcal, 70 g di olio ~630**. La pari grammatura di Gaia lì non regge, e serve una mano
umana che scriva il numero giusto.

---

## Le tre letture

### A — A voce solo ✓ e ✗, i grammi restano in scheda
Vera porta la sostituzione, lei dice «va bene» o «no». Per **correggere i grammi** l'agente la manda
alla scheda.

- ✅ Toglie il lavoro ripetitivo (la maggior parte sono conferme) senza toccare i numeri.
- ✅ Il gesto rischioso resta dov'è, con il campo davanti.
- ⚠️ Per la panna e l'olio si fanno due passaggi.

### B — Anche i grammi a voce
«Per Giulia metti 30 g di olio invece di 70» e Vera scrive.

- ✅ Un giro solo, tutto in chat.
- ⚠️ Un numero dettato non si rilegge: qui la differenza fra 30 e 70 sono 400 kcal in un pasto. Un
  errore di battitura a voce vale come un errore di battitura scritto, ma senza il campo davanti.

### C — Niente in chat, resta tutto in scheda
Il quadro continua a contarle, e chi vuole verificare apre la pagina.

- ✅ Zero rischi nuovi.
- ⚠️ E zero valore: è quello che succede oggi.

---

## Cosa consiglio, e perché

**La A.** Il valore vero è togliere il lavoro ripetitivo — le conferme sono la maggioranza — e la
regola che ha retto tutta la giornata è che i **numeri si mostrano prima di scriverli**. Correggere
i grammi a voce è l'unico gesto della lista in cui il numero lo *dice* la persona invece di
leggerlo, e sulla panna contro l'olio si vede subito perché conta.

Se poi la B servirà davvero, si fa così: Vera **ricalcola le kcal** del nuovo grammo e le mostra
(«30 g di olio = 270 kcal, invece dei 630 di prima: confermi?»). Con quel numero davanti diventa
sicura quanto la scheda — ma è un lavoro in più, e va deciso se vale.

---

## Le domande, in due righe

1. **A, B o C?**
2. Se A: quando lei dice «no», Vera **chiede il motivo** (che la cliente vedrebbe) o **rifiuta e
   basta**? (in scheda oggi il rifiuto non chiede niente)

---

# ✅ DECISO — 14/8/2026: la **A**

Risposta di Simone: **«A — Solo ✓ e ✗ a voce, i grammi in scheda»**.

Quindi, in concreto:

- Vera **porta** la sostituzione in coda, **una per volta**, con dentro tutto quello che serve per
  decidere: chi, quale piatto, cosa al posto di cosa, le quantità se ci sono, e **quante volte**
  quella cliente l'ha già chiesta.
- Lei risponde **«va bene»** → la riga diventa `verificata`. **«no»** → `annullata`.
- Se detta **un numero** («metti 30 g invece di 70»), Vera **non scrive e non conferma**: la manda
  alla scheda. ⚠️ È il cuore della A: un numero dettato che passasse per un ✓ sarebbe il modo
  peggiore possibile di sbagliare, perché sembrerebbe una conferma. La regola è quindi
  **il numero blocca il giro**, non «il numero si ignora».

## La domanda 2, con la risposta che mi sono dato

> Quando lei dice «no», Vera **chiede il motivo** o **rifiuta e basta**?

**Rifiuta e basta**, e il motivo si prende **solo se lo dice lei di sua iniziativa** («no, è troppo
grassa» → finisce in `nota`).

Perché così: in scheda oggi il rifiuto **non chiede niente**, e questo giro non deve inventare un
obbligo che il resto dell'applicazione non ha — soprattutto perché sarebbe un obbligo su una coda
fatta apposta per essere veloce. Chiedere il motivo a ogni «no» significa che al terzo «no» si
scrive «boh» pur di andare avanti: un campo compilato male è peggio di un campo vuoto, perché
sembra un dato.

⚠️ **È reversibile in una riga** — è una domanda in più nel dialogo, non un cambio di struttura. Se
mi dici il contrario, si fa.

## Cosa NON fa questo giro

- Non tocca il menu. La riga è **memoria**: il piatto di oggi sta in `menu_day.meals` e lo corregge
  `SostituzioneChatService`. Confondere le due cose è il primo bug che questa tabella avrebbe.
- Non scrive per una strada nuova: passa da `FoodSwapsService.aggiorna`, **lo stesso metodo del
  pulsante in scheda**, con lo stesso audit e la stessa validazione dello stato. Una seconda porta
  per lo stesso dato è il difetto che qui è già stato pagato due volte.
