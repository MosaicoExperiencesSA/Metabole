# Da riprendere — 8 agosto 2026

Fotografia di fine giornata. Tre elenchi: **cosa aspetta te** (comandi e scelte), **cosa aspetta
me** (codice), **cosa aspetta la nutrizionista** (contenuti).

---

## 1. Cosa aspetta TE — comandi da lanciare

Tutti dalla shell di Render, dentro `~/project/src/backend`. Girano prima in sola lettura:
si scrive solo con `CONFERMA=1`.

| Comando | Cosa fa | Perché ora |
|---|---|---|
| `npm run accendi:automazioni` | Accende l'assistente AI in chat e il motore delle mail con **tre** inneschi (sollecito questionario, compleanno, fine prova) | Finché non lo lanci, Gaia continua a girare alla coach anche «cos'è il bok choy?» e le mail automatiche restano ferme |
| `npm run fix:stato-questionario` | Sposta in «Questionario completato» chi l'ha già compilato | Sulla board quelle clienti sembrano ancora da lavorare |
| `npm run pulisci:spezie` | Toglie curry, cumino & co. dai cibi esclusi delle clienti esistenti | La regola nuova protegge chi arriva da qui in poi; chi ce l'ha già in lista continua a ricevere menu ripetuti |
| `npm run diag:settimane` | Le diete nell'ordine in cui conviene lavorarle | Da rilanciare dopo il lavoro della nutrizionista per vedere dove si è arrivati |

**E su Render → Environment:** `OTA_VERSION = 2.1.1`, dopo che il deploy è finito.
⚠️ Alla prossima pubblicazione sugli store, **svuota `OTA_VERSION`**: un'installazione fresca
scaricherebbe un bundle più vecchio del codice nativo appena preso dallo store.

### Una scelta che devi fare tu

**Le 270 varianti di dieta senza clienti.** Rifarle a mano sono ~1000 generazioni: non è lavoro
da backoffice. Tre strade, e nessuna è ovvia:
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
  pagamento. Mancano: fine prova gratuita e fine piano.
- **Compleanno nel calendario** della coach. La mail di auguri esiste e si accende con lo script;
  il compleanno in agenda no.
- **Data di nascita nel questionario** (oggi si chiede solo l'età): senza, il compleanno lo
  abbiamo solo per chi l'ha messa a mano.
- **«Nuova cliente assegnata da accettare»**: esiste per i *lead* (`lead_assigned`), non per una
  cliente già acquisita riassegnata a un'altra coach. Da chiarire se serve anche quel caso.

### Difetti trovati oggi e non corretti

- 🟠 **Nessuna notifica quando nasce un «Piano bloccato».** Le segnalazioni le scrivono
  `personal-base` e `menu` direttamente a database, senza passare dal servizio che avvisa lo
  staff. Il tipo `escalation_diet_blocked` esiste nel catalogo e non lo manda nessuno. Da oggi
  almeno **si vedono in dashboard**, che era il buco più largo. Per la notifica va sbrogliata
  una dipendenza circolare (NotificationsModule → MenuModule): non è roba da fine giornata.

### Dalla revisione del 7/8 — restano sette punti su nove

Ordine consigliato: **6 → 2 → 3 → 7 → 5 → 4 → 9**. I primi due sono soldi.

- 🟠 **#6 Abbonamento orfano se si perde il primo webhook.** `stripeSubscriptionId` lo scrive
  solo `checkout.session.completed`. Se quel webhook non arriva, resta `null` per sempre: la
  cliente paga ogni mese, la scadenza non si sposta più, e la disdetta dall'app risponde
  «Nessun abbonamento da disdire». Il rimedio è già a portata — `subscription_data.metadata`
  contiene l'id e nessuno lo legge.
- 🟠 **#2 La provvigione del rinnovo può sparire per sempre.** L'idempotenza è marcata *prima* di
  `generateCommissions`, che è l'unica chiamata della catena senza `.catch()`. Se fallisce, il
  webhook rilancia ma `pspRef` esiste già → provvigione, ricevuta e audit non nascono mai.
  In più l'idempotenza qui è `findFirst` + `create` non atomici, senza indice univoco.
- 🟠 **#3 Il Monitoraggio a €19 eroga gli stessi menu del Mantenimento a €49.**
  `deliverIfEligible` guarda solo che l'abbonamento sia attivo, mai il `period` del piano.
  **Da decidere prima di correggere: cosa deve ricevere davvero chi paga €19?**
- 🟠 **#7 Il lead sceglie la password due volte di fila.** `sendCredentials` crea l'account con
  `mustChangePassword: true` e `confirmPasswordReset` non azzera il flag.
- 🟠 **#5 Il rinnovo manda una ricevuta senza PDF.** (La coach adesso viene avvisata — corretto
  oggi — ma il PDF continua a mancare.)
- 🟠 **#4 Il pulsante del report vende solo il mese singolo, mai l'abbonamento.**
  `cart.setPlan` senza `billing` → nel Checkout il toggle non compare. È la strada principale di
  conversione a fine percorso.
- 🟠 **#9 Ordini «Menu di rientro» in sospeso.** Verificare in Acquisti se ce n'è qualcuno prima
  di preoccuparsene.

---

## 3. Cosa aspetta la NUTRIZIONISTA

- **Completare le settimane 1-4** delle diete con clienti. La guida è in
  `progetto/guide/Metabole-Guida-settimane-menu.pdf`, con l'elenco delle **12 diete** in ordine.
  Da rifare partendo dalla variante a **5 pasti**: le altre riusano le sue ricette.
- **Le 142 ricette generate su «Basso indice glicemico · vegana · mantenimento · 3 pasti»** sono
  su una variante senza clienti, e **110 sono ancora bozze**. Vanno rifatte su
  `onnivora · dimagrimento · 5 pasti`.
- ⚠️ **«Vacanze in Serenità · onnivora · dimagrimento · 3 pasti» ha SOLO le colazioni.** Niente
  pranzo, niente cena, e c'è una cliente che la sta ricevendo. Prima cosa da guardare.
- ⚠️ **«Ritorno in Equilibrio · onnivora · mantenimento · 3 pasti» è vuota**: zero giornate.
- **18 diete «Pescetariana» con regime onnivoro/vegetariano/vegano** (dal backlog del 7/8):
  o è sbagliato il nome o è sbagliato il regime. Solo lei può dirlo.
- **20 clienti con famiglia di dieta ambigua** da rivedere (`npm run diag:famiglie`).

---

## Numeri di oggi

661 test (erano 636 ieri sera). 8 punti su 12 delle coach chiusi, 2 dei 9 della revisione,
1 bundle OTA pubblicato, 6 comandi diagnostici nuovi, 1 guida PDF.
