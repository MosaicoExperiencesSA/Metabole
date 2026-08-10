> # ⛔ DOCUMENTO CHIUSO — 12 agosto 2026
>
> **Non usare questo file per decidere cosa fare.** Il punto della situazione, verificato sul ramo
> pubblicato, è in **[`PUNTO_DELLA_SITUAZIONE.md`](PUNTO_DELLA_SITUAZIONE.md)**.
>
> Contiene l'allarme falso su «Vacanze in Serenità» — dice che una cliente la sta ricevendo, ma quel piano è concluso dal 22/07 — ed è la fonte da cui quell'errore è arrivato fino alla lista dell'11/8. Le soglie provvigioni 10/15 delle nutrizioniste, che qui erano l'unica traccia, sono state salvate nel nuovo documento.
>
> Resta qui perché è una fotografia di quel giorno e il `REGISTRO.md` ci si appoggia. Quello che valeva
> per il futuro — le regole ferree, le trappole, i controlli già fatti — è stato travasato nel nuovo
> documento: da qui non serve ripescare niente.

---

# Da riprendere — 9 agosto 2026

Fotografia di fine giornata dell'8 agosto. Tre elenchi: **cosa aspetta te**, **cosa aspetta me**
(codice), **cosa aspetta la nutrizionista** (contenuti). Sostituisce
`DA_RIPRENDERE_20260808.md`: quello che lì era da fare e oggi è fatto qui non compare più.

---

## Fatto stasera, prima di chiudere

- **Push e deploy andati.** Sulla shell di Render `npm run pubblica:tutto` esiste, quindi il
  codice nuovo è in produzione.
- **`CONFERMA=1 npm run pubblica:tutto` lanciato su tutto il catalogo.** Risultato:
  **1468 ricette attivate**, 1477 allergeni confermati, 273 gruppi approvati,
  **30 diete pubblicate** e rese visibili. Firma dell'approvazione: Dr.ssa Capo.
  13 saltate: le 12 «Digiuno intermittente (16:8)» archiviate (giustamente fuori) e
  «Ritorno in Equilibrio · onnivora · mantenimento · 3 pasti», che non ha nessuna giornata.
- **Corretto «Valida e pubblica»** nel generatore: non salta più le varianti già pubblicate
  (era il motivo per cui su una famiglia tutta pubblicata il pulsante non faceva niente) e il
  passo 3 non sparisce più quando nessuna variante è selezionata.
- **Pulsante «Ricalcola provvigioni»** sulla riga dell'acquisto + pagina Acquisti impaginata.

---

## 1. Cosa aspetta TE

### ⚠️ Prima cosa domattina — `lovcarbciccio`

La variante **`lovcarbciccio · omnivore · dimagrimento · 5 pasti`** era in bozza e
`pubblica:tutto` l'ha **approvata e resa visibile alle clienti**. Dal nome sembra una prova.
Se lo è, archiviala: Backoffice → **Catalogo diete** → Archivia (oppure, dal generatore, passo 3,
l'icona rossa accanto alla variante). L'archiviazione la toglie dai menu senza cancellarla.

Se preferisci non cercarla nell'elenco, chiedimi il comando: `archivia:dieta` per nome è
mezz'ora di lavoro.

### Le provvigioni

1. **Correggi le percentuali del piano** «Percorso Metabole 3 mesi»: sono **soglie cumulative**,
   quindi **25 / 35 / 45** per coach / coordinatrice / manager e **10 / 15** per nutrizionista /
   capo nutrizionista. Scritte 25 / 10 / 10 il secondo livello calcola `10 − 25 = −15` e la
   catena si ferma: incassa solo la coach. È il motivo per cui era stata pagata solo Daniela.
2. **Poi** ricalcola i pagamenti già fatti. Due strade, stessi conti:
   - dal backoffice, riga per riga: **Acquisti → icona ↻** sull'acquisto;
   - da shell, in blocco: `npm run ricalcola:provvigioni -- 2026-07-01` (mostra), poi
     `CONFERMA=1 npm run ricalcola:provvigioni -- 2026-07-01`.
   Aggiunge solo il mancante, non toglie niente a nessuno, rilanciarlo non raddoppia.

### Da verificare (non so se l'hai già fatto)

- **`OTA_VERSION = 2.1.1`** su Render → Environment, per la correzione della card referral sulle
  app installate. ⚠️ Alla prossima pubblicazione sugli store, **svuota `OTA_VERSION`**:
  un'installazione fresca scaricherebbe un bundle più vecchio del codice nativo.
- **Prova il generatore** su una famiglia qualsiasi: il passo 3 deve restare visibile e il
  pulsante «Valida e pubblica tutte le N varianti» deve funzionare anche se sono già pubblicate.

### Una scelta che resta tua

**Le varianti di dieta senza clienti** (270 al conteggio di ieri). Rifarle a mano sono ~1000
generazioni. Tre strade, nessuna ovvia:

1. lasciarle magre e completarle quando una cliente le sceglie (costo zero, ma la prima cliente
   prende un catalogo magro);
2. togliere dal questionario quelle che non offrite davvero (meno scelta, ma vera);
3. uno script che le macina in background (costo AI, e nessuno le rivede).

---

## 2. Cosa aspetta ME — codice

### Rimasto dalla lista delle coach (dodici punti, otto chiusi)

- **«Percorso concluso» automatico** a +7 giorni dalla fine piano. La colonna esiste, manca il
  passo nel cron giornaliero.
- **Scadenze nel calendario della coach.** Oggi c'è solo il promemoria a T-7 per i piani a
  pagamento. Mancano fine prova gratuita e fine piano.
- **Compleanno nel calendario** della coach. La mail di auguri c'è, l'appuntamento in agenda no.
- **Data di nascita nel questionario** (oggi si chiede solo l'età): senza, il compleanno lo
  abbiamo solo per chi l'ha messa a mano.
- **«Nuova cliente assegnata da accettare»**: esiste per i *lead* (`lead_assigned`), non per una
  cliente già acquisita riassegnata a un'altra coach. Da chiarire se serve anche quel caso.

### Difetti aperti

- 🟠 **Nessuna notifica quando nasce un «Piano bloccato».** Le segnalazioni le scrivono
  `personal-base` e `menu` direttamente a database, saltando il servizio che avvisa lo staff.
  Il tipo `escalation_diet_blocked` esiste e non lo manda nessuno. Da ieri almeno **si vedono in
  dashboard**. Per la notifica va sbrogliata una dipendenza circolare
  (NotificationsModule → MenuModule).

### Dalla revisione del 7/8 — restano sette punti su nove

Ordine consigliato: **6 → 2 → 3 → 7 → 5 → 4 → 9**. I primi due sono soldi.

- 🟠 **#6 Abbonamento orfano se si perde il primo webhook.** `stripeSubscriptionId` lo scrive
  solo `checkout.session.completed`. Se quel webhook non arriva resta `null` per sempre: la
  cliente paga ogni mese, la scadenza non si sposta più, e la disdetta dall'app risponde
  «Nessun abbonamento da disdire». Il rimedio è a portata: `subscription_data.metadata` contiene
  l'id e nessuno lo legge.
- 🟠 **#2 La provvigione del rinnovo può sparire per sempre.** L'idempotenza è marcata *prima* di
  `generateCommissions`, unica chiamata della catena senza `.catch()`. Se fallisce, il webhook
  rilancia ma `pspRef` esiste già → provvigione, ricevuta e audit non nascono mai. In più
  l'idempotenza è `findFirst` + `create` non atomici, senza indice univoco.
- 🟠 **#3 Il Monitoraggio a €19 eroga gli stessi menu del Mantenimento a €49.**
  `deliverIfEligible` guarda solo che l'abbonamento sia attivo, mai il `period` del piano.
  **Da decidere prima di correggere: cosa deve ricevere davvero chi paga €19?**
- 🟠 **#7 Il lead sceglie la password due volte di fila.** `sendCredentials` crea l'account con
  `mustChangePassword: true` e `confirmPasswordReset` non azzera il flag.
- 🟠 **#5 Il rinnovo manda una ricevuta senza PDF.**
- 🟠 **#4 Il pulsante del report vende solo il mese singolo, mai l'abbonamento.**
  `cart.setPlan` senza `billing` → nel Checkout il toggle non compare. È la strada principale di
  conversione a fine percorso.
- 🟠 **#9 Ordini «Menu di rientro» in sospeso.** Verificare in Acquisti se ce n'è qualcuno.

---

## 3. Cosa aspetta la NUTRIZIONISTA

- ⚠️ **«Vacanze in Serenità · onnivora · dimagrimento · 3 pasti» ha 5 ricette in tutto** ed è
  visibile alle clienti — c'è una cliente che la sta ricevendo. È la prima da guardare.
- ⚠️ **«Ritorno in Equilibrio · onnivora · mantenimento · 3 pasti» è vuota**: zero giornate.
  Va generata dal generatore, `pubblica:tutto` non può farci niente.
- **Completare le settimane 1-4** delle diete con clienti. La guida è in
  `progetto/guide/Metabole-Guida-settimane-menu.pdf`, con le **12 diete** in ordine.
  Partire sempre dalla variante a **5 pasti**: le altre riusano le sue ricette.
- **Le 142 ricette su «Basso indice glicemico · vegana · mantenimento · 3 pasti»** sono finite su
  una variante senza clienti. Il lavoro utile va su `onnivora · dimagrimento · 5 pasti`.
- **18 diete «Pescetariana» con regime onnivoro/vegetariano/vegano**: o è sbagliato il nome o è
  sbagliato il regime. Solo lei può dirlo.
- **20 clienti con famiglia di dieta ambigua** da rivedere (`npm run diag:famiglie`).

---

## Comandi disponibili (shell Render, cartella del backend)

Girano tutti in sola lettura; si scrive solo con `CONFERMA=1`.

| Comando | Cosa fa |
|---|---|
| `npm run pubblica:tutto` | Attiva ricette, conferma allergeni, approva gruppi, pubblica e rende visibile. Con un nome fra virgolette si limita a una famiglia |
| `npm run ricalcola:provvigioni -- <email o data>` | Aggiunge le quote di provvigione mancanti sui pagamenti già approvati |
| `npm run diag:provvigioni -- <email>` | Perché su quel pagamento ha incassato solo una persona |
| `npm run diag:settimane` | Le diete nell'ordine in cui conviene lavorarle |
| `npm run diag:dieta -- "<nome>"` | Dove sono finite davvero le ricette di una famiglia |
| `npm run diag:cliente -- <email>` | Perché quella cliente vede quel messaggio al posto del menu |
| `npm run diag:famiglie` | Clienti con famiglia di dieta ambigua |
| `npm run pulisci:spezie` | Toglie le spezie dai cibi esclusi delle clienti |
| `npm run accendi:automazioni` | ⚠️ Leggere il riepilogo: il motore mail è **a opt-out**, senza `ACCENDI=` spegne quello che oggi parte |

---

## Numeri

661 test verdi. 8 punti su 12 delle coach chiusi, 2 dei 9 della revisione. 7 comandi diagnostici
e operativi. 1 bundle OTA (2.1.1). Catalogo: 285 varianti esaminate, 30 pubblicate stasera.
