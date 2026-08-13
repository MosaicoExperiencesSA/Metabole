# Decisioni di Simone — 13 agosto 2026

Scritte **prima** di toccare il codice. Una decisione presa non si ri-discute la settimana prossima,
e chi legge trova il perché senza dover ritrovare la conversazione.

---

## 1. Le allergie: chi le modifica ✅ DECISO

**Domanda di Simone.** «Nella scheda cliente e scheda lead il nutrizionista li deve leggere e poter
modificare, magari mettiamo l'impostazione nei permessi.»

**Risposta: permesso dedicato `change_allergies` («Modifica allergie»).** Di default a
`nutritionist`, `head_nutritionist`, `admin`.

⚠️ Flag suo e **non** «Clienti: gestisci», che ce l'ha anche la coach: un'allergia è un blocco duro,
e chi ne toglie una decide che da domani quella cliente può trovarsi quell'alimento nel piatto.

**Le intolleranze restano dove sono** (già dentro «Clienti: gestisci», già modificabili anche dalla
coach): restringerle sarebbe una perdita di capacità che nessuno ha chiesto.

**Fatto il 13/8.** Scheda cliente e scheda lead, che scrivono dallo **stesso** endpoint.

---

## 2. `'other'` fra le intolleranze ✅ DECISO

**Simone:** «`'other'` si toglie solo se lei ha detto cosa — sì esatto.»

Se ha spuntato «Altro» senza compilare il campo — o se il questionario arriva da un'app vecchia —
la stringa `'other'` **resta**. È inutile per i menu, ma è l'unica traccia del fatto che c'è
qualcosa che non sappiamo, ed è così che si trova chi ricontattare.

**Fatto il 13/8**, insieme alla colonna `intolerancesOther` e al campo nel questionario.

---

## 3. ⚠️ Il via libera clinico: come la nutrizionista dice «può proseguire» ✅ DECISO

**Domanda di Simone.** «Se poi metti Visita obbligatoria e la nutrizionista decide che la cliente può
proseguire, come fa a dircelo? Questo succede per tutte le persone in percorso, parte il messaggio
sorveglianza sanitaria ma lei come fa a dirci ok può proseguire?»

### Cosa c'era già, e perché non bastava

Il canale esiste: chi dichiara patologie o farmaci nel questionario fa nascere una **segnalazione**
(`source: 'screening'`, `category: 'clinical'`) assegnata alla nutrizionista, che la chiude dalla sua
coda. E dall'11/8 c'è `escalations/riapertura.ts`, la regola «se ha risolto basta fino a nuova
segnalazione».

Tre motivi per cui, da solo, non risponde alla domanda:

1. ⚠️ **La tregua dura 14 giorni, poi la segnalazione si riapre.** Per il calo peso è giusto — quella
   condizione può peggiorare. Per «ha un'allergia, serve la visita» no: **un'allergia non passa, e il
   via libera non scade su un timer**. Al quindicesimo giorno ricomparirebbe identica, e a quel punto
   le segnalazioni smettono di voler dire qualcosa (è la lezione già scritta in `riapertura.ts`).
2. ⚠️ **«Risolta» non dice cosa ha deciso.** Registra uno stato e una data: non se ha visitato la
   cliente, se aspetta un certificato, o se ha deciso che la visita non serve. Fra un mese quella
   distinzione non è più ricostruibile.
3. ⚠️ **Il flag `richiedeVisita` del §8 dell'handoff è derivato** («allergie non vuote e nessuna
   visita registrata»): chiudere la segnalazione non lo spegne, quindi si riaccenderebbe da solo per
   sempre.

### Risposta: un pulsante «Idonea a proseguire» sulla scheda cliente

Una **decisione scritta sulla cliente**, non una segnalazione chiusa:

- **cosa** ha deciso — `idonea` oppure `serve_visita`;
- **chi** l'ha decisa e **quando**;
- una **nota** libera (facoltativa).

⚠️ **Non scade.** È il punto della decisione: una valutazione clinica vale finché non arriva un
fatto nuovo, non finché non scadono quattordici giorni.

⚠️ **Un gesto solo, non due.** Quando decide, le segnalazioni cliniche aperte su quella cliente si
chiudono **da sé**: se dovesse fare la stessa cosa in due posti, prima o poi ne farebbe una sola —
e la coda tornerebbe a riempirsi di casi già visti.

⚠️ **Vale per tutta la sorveglianza sanitaria, non solo per le allergie.** Era già la domanda di
Simone: lo screening del questionario parte per chiunque dichiari patologie o farmaci. Un via libera
che risponde solo alle allergie lascerebbe l'altra metà del problema esattamente com'è.

### E nel frattempo: NESSUN BLOCCO

**Il percorso e i menu continuano.** La cliente compare nella coda della nutrizionista con il motivo,
e nella scheda si legge «visita da fare».

⚠️ È la parte su cui l'handoff insiste (§8), e vale la pena tenerla scritta: bloccare l'erogazione
vorrebbe dire **sospendere piani attivi a clienti paganti** per un campo introdotto oggi — e su chi è
già in percorso sarebbe una sospensione di massa il giorno del rilascio. Il blocco, se sarà blocco,
si aggiunge dopo, in una consegna sua, quando è chiaro cosa succede a chi è già dentro.

### Cosa resta fuori da questa decisione

- ⛔ **Quando far partire il «serve la visita» in automatico** (allergia dichiarata → richiesta di
  visita) è materia clinica: lo decide Nocanty. Qui si costruisce il **modo di rispondere**, che
  serve comunque e non dipende da quella soglia.
- ⛔ Il testo che la cliente legge in app resta per la OTA.
