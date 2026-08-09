# Metabole — Grammature dei grassi nei cambi in chat: cosa serve per chiudere la regola

**A chi:** Nocanty (capo nutrizionista). **Da:** Sviluppo (Simone + Claude).
**Scopo:** Gaia oggi propone i cambi di ingrediente **a pari grammatura**. Sui grassi non regge, e serve una tua regola per farlo bene. Le risposte a **Q1** e **Q3** sono le uniche bloccanti; le altre hanno già una proposta pronta, spesso basta «ok».

**Tempo di lettura: 6 minuti. Da compilare: una tabella, tante righe quanti sono i gruppi che contengono grassi.**

---

## 1. Cosa fa Gaia oggi

Quando una cliente chiede di cambiare un ingrediente, Gaia:

1. cerca un sostituto **solo** dentro i **gruppi di equivalenza approvati da te** (backoffice → Gruppi di equivalenza) e, se non ne trova, dentro una mappa di sostituzioni sicure condivisa col motore;
2. scarta tutto ciò che tocca un allergene dichiarato o un'esclusione della cliente — su questo non media mai;
3. propone **la stessa quantità** dell'alimento che esce: 70 g di carote → 70 g di biete;
4. scrive il cambio **solo sul menu di quella cliente**, mai sulla ricetta di catalogo, e lo segna `da verificare` in scheda cliente.

Il punto 3 è una scelta dichiarata, e su gruppi tipo «carote / biete / spinaci» va benissimo: sono alimenti con densità energetica simile, e 20 g in più o in meno non cambiano la giornata.

## 2. Dove si rompe, in numeri

Nel collaudo del 9 agosto, su una cliente vera, Gaia ha proposto di sostituire **70 ml di panna fresca con 70 g di olio evo**. Ordini di grandezza (da confermare con la tua fonte, vedi §7):

| Alimento | kcal/100 g | Grassi/100 g | Su 70 g |
|---|---|---|---|
| Panna fresca 35% | ~340 | ~35 g | **~235 kcal** |
| Burro | ~750 | ~83 g | **~525 kcal** |
| Olio EVO | ~890 | ~100 g | **~625 kcal** |

Il piatto era da **500 kcal**. Sostituendo a pari grammatura diventa **~890 kcal: +77%**, su una cliente in deficit. Non è un errore di arrotondamento: è quasi un pasto in più.

Nella direzione opposta il problema è lo stesso al rovescio — chi sostituisce l'olio con la panna a pari grammatura si ritrova un piatto molto più povero di quello che il piano prevedeva.

## 3. Perché il controllo che c'è non se ne accorge

Esiste già una protezione sulle grammature (`grammaturaAmmessa`): rifiuta una quantità che sia **meno di un terzo o più del triplo** di quella di partenza. Serve a impedire che un errore di battitura diventi una porzione tripla, e per quello funziona.

Ma guarda **il rapporto fra le quantità, non le calorie**. 70 → 70 è un rapporto di 1, quindi passa senza dire niente. Il controllo è cieco esattamente sul caso che ci interessa.

## 4. Cosa il sistema sa, e cosa non sa (il vincolo che decide)

Questa è la parte che cambia la tua risposta, quindi la scrivo prima delle domande.

- Le **ricette** hanno kcal e macro **del piatto intero**.
- I **singoli ingredienti** hanno solo nome, quantità e unità: **non c'è nessuna tabella di composizione degli alimenti** nel sistema. Nessun kcal/100 g, nessun grasso/100 g, per nessun ingrediente.

Conseguenza: **il codice non può calcolare da sé un fattore di conversione.** Non può sapere che l'olio è tre volte la panna, perché non sa quante calorie ha né l'uno né l'altra. O quel numero lo dai tu, o i grassi escono dai cambi automatici. Non c'è una terza strada che non passi dal costruire una banca dati alimentare — che è un lavoro suo, e non è questo.

---

## Q1 — [BLOCCANTE] Quale delle due strade

### Opzione A — I grassi escono dall'equivalenza automatica

Togli i grassi dai gruppi approvati (o li marchi «solo con nutrizionista»). Chi chiede di cambiare la panna, il burro o l'olio riceve da Gaia una risposta del tipo: *«su questo non decido io: l'ho chiesto alla tua nutrizionista, ti scrive lei»*, e la richiesta ti arriva come segnalazione.

- **A favore:** zero rischio, zero numeri da produrre, si fa domani.
- **Contro:** ogni «posso mettere l'olio invece della panna?» diventa una richiesta sul tuo tavolo. Sono cambi frequenti e quasi sempre banali; il costo è tuo, tutti i giorni.

### Opzione B — Un fattore di conversione per gruppo (consigliata)

Dentro ogni gruppo dichiari un **alimento di riferimento** e, per ogni altro membro, **quanti grammi equivalgono a 100 g del riferimento**. Gaia applica il rapporto e propone la quantità giusta.

Esempio compilato (numeri da confermare, sono qui solo per far vedere la forma):

| Gruppo: **Grassi da condimento** | g equivalenti a 100 g di panna fresca |
|---|---|
| Panna fresca 35% *(riferimento)* | 100 |
| Burro | 42 |
| Olio EVO | 35 |
| Margarina | 40 |

Con questi numeri, «70 g di panna» diventa «~25 g di olio» invece di «70 g», e le calorie del piatto restano quelle del piano.

- **A favore:** i cambi facili restano automatici e corretti; tu scrivi i numeri **una volta**.
- **Contro:** sono numeri tuoi, e vanno mantenuti se il gruppo cambia.

**Serve una tua scelta: A o B?** Si può anche fare **B sui gruppi che mi dai e A su tutto il resto** — è la strada che consiglierei per partire: cominci dal gruppo dei grassi da condimento, che è quello che genera il 90% dei casi, e il resto resta protetto.

_Proposta di default: **B sul gruppo dei grassi da condimento, A su tutti gli altri gruppi che contengono grassi** finché non ci arrivi._

---

## Q2 — Il fattore su che cosa si equipara?

Se scegli B, il numero può voler dire tre cose diverse:

1. **pari grassi** (grammi di lipidi uguali);
2. **pari calorie** (kcal uguali);
3. **pari resa in cucina** (quello che serve perché il piatto funzioni: una vellutata ha bisogno di un liquido, non di 25 g di olio).

Sui grassi le prime due **quasi coincidono** — la panna prende ~93% delle sue calorie dai lipidi — quindi fra 1 e 2 la differenza è di pochi grammi. La 3 è quella che può divergere davvero, ed è una cosa che sai tu e il codice non può sapere.

**Domanda:** dichiaro il fattore come **pari grassi**? E, dove la resa in cucina non regge (panna in una vellutata, burro in un impasto), preferisci che quella coppia sia semplicemente **fuori dal gruppo**, invece di introdurre una seconda regola?

_Proposta di default: fattore a **pari grassi**; le coppie che in cucina non funzionano escono dal gruppo._

---

## Q3 — [BLOCCANTE] La tabella da compilare

Per ogni gruppo approvato che contiene un grasso (li vedi in backoffice → **Gruppi di equivalenza**), mi serve una riga per membro. Puoi rispondere anche in un messaggio, non serve un formato preciso:

```
Gruppo: <nome del gruppo>
Riferimento: <alimento>
<alimento>  <g equivalenti a 100 g del riferimento>
<alimento>  <g equivalenti a 100 g del riferimento>
Coppie da NON permettere: <es. panna → olio in vellutate>
```

Bastano i **numeri relativi**: non servono le kcal, non serve una tabella nutrizionale. Ed è **un numero per alimento**, non uno per coppia — il rapporto fra due membri qualsiasi il codice lo ricava da sé, e la conversione resta coerente in entrambe le direzioni.

Se un gruppo lo vuoi lasciare fuori, scrivi solo «fuori» accanto al nome: diventa Opzione A per quel gruppo.

---

## Q4 — Quando Gaia non deve decidere da sola

Anche con i fattori, ci sono casi in cui è più sicuro fermarsi. Proposta: Gaia passa la mano a te — senza proporre niente — quando

- il gruppo **non ha** un fattore dichiarato (è la regola che rende l'Opzione A il comportamento di default, e quindi il sistema sicuro finché non compili nulla);
- il fattore porterebbe la quantità **sotto un terzo o sopra il triplo** di quella di partenza.

⚠️ Su questo secondo punto ti devo segnalare una cosa concreta: **il limite di un terzo è già attivo oggi**, e un fattore di 0,35 (panna → olio) ci passa appena. Se qualcuno dei tuoi numeri scendesse **sotto 0,33** — plausibile, per esempio con mascarpone o panna leggera verso l'olio — il controllo attuale lo rifiuterebbe e Gaia ripiegherebbe su pari grammatura, cioè sull'errore che stiamo togliendo. Se mi dici che può succedere, **alzo il limite ai soli gruppi con un fattore dichiarato** (dove la quantità non è più una supposizione, ma la tua regola).

_Proposta di default: sì a entrambe le condizioni, e alzo il limite dove il fattore è dichiarato da te._

---

## Q5 — Cosa dice Gaia quando si ferma

Testo che proporrei, da correggere liberamente — la frase la legge la cliente:

> «Su questo preferisco non decidere io: cambiare un grasso con un altro cambia le calorie del piatto più di quanto sembri. L'ho chiesto alla tua nutrizionista, che ti risponde lei. 💚»

Dice **perché**, che è la parte che evita il «ma allora a cosa servi». Va bene così, o preferisci un'altra formulazione?

---

## Q6 — Quello che nel frattempo puoi già fare (informativa, nessuna risposta richiesta)

Da oggi, in **scheda cliente → card Conversazioni**, ogni cambio nato in chat ha tre pulsanti: **conferma** («va bene così»), **correggi** (cambi il sostituto e/o i grammi, con una nota) e **annulla** (il piatto torna esattamente come era). La cliente riceve una notifica con la tua nota quando correggi o annulli — non quando confermi.

Questo **non risolve** la regola: finché non c'è, ogni cambio sui grassi passa da una persona. Ma toglie l'urgenza — un numero sbagliato oggi si sistema, prima no.

---

## 7. Cosa facciamo noi appena rispondi

- **Nessuna modifica al database.** Il campo `members` dei gruppi è già libero: i fattori ci stanno dentro senza migrazioni.
- Aggiungiamo la colonna del fattore nell'editor dei gruppi in backoffice, così i numeri li tieni tu senza passare da noi.
- Gaia applica il fattore, e il numero che scrive nel menu resta **sempre** verificabile e correggibile da te in scheda.
- Il controllo di plausibilità viene tarato come da Q4.

Sui numeri della tabella al §2: sono ordini di grandezza da fonti generiche, messi lì solo per mostrare la dimensione del problema. **Non li useremo:** i numeri che finiscono nel prodotto sono i tuoi, e la fonte la scegli tu (CREA/INRAN o quella che usi di solito). Se preferisci indicarcela, la citiamo accanto al gruppo — così fra sei mesi si sa da dove vengono.
