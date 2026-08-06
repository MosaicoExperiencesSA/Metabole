# Stripe ricorrente — le sei domande da chiudere prima di scrivere codice

**Per:** Simone · **Da:** Sviluppo · **Preparato:** sera del 6 agosto 2026
**Serve a:** partire domattina senza fermarsi dopo dieci minuti.

Ogni domanda ha una **proposta già scritta**. Se va bene, basta «sì». Dove dico «da decidere»
è perché la risposta cambia il codice, non il gusto.

Le provvigioni sono **tutte decise** e non si riaprono: nutrizionista **0%** su mantenimento e
monitoraggio; coach **quota piena a ogni rinnovo**; **solo se è ancora la coach assegnata**;
residual **senza scadenza**.

⚠️ **Un solo numero resta scoperto, ed è nuovo:** la **percentuale coach sul monitoraggio**. Sul
mantenimento il 45% di €49 fa €22,05 e a Metabole restano €25,96 al mese. Sul monitoraggio, il
45% di €19 fa €8,55 e restano **€9,91** — su un prodotto che per definizione dura anni e chiede
pochissimo lavoro. Non è detto che la stessa percentuale abbia senso su entrambi: vale la pena
guardarlo prima di scriverlo, non dopo.

---

## 1. Quali piani diventano ricorrenti — ✅ RISPOSTA GIÀ DATA (Simone, 6/8 sera)

| Prodotto | Prezzo | Come si vende |
|---|---:|---|
| **Mantenimento** | **€49/mese** | abbonamento **oppure mese singolo** — entrambi |
| **Monitoraggio** | **€19/mese** | **solo abbonamento**, anche per sempre |
| Percorsi 1/3/6 mesi | invariati | **una tantum**, come oggi |

Il percorso della cliente: raggiunge il peso → **mantenimento per quanti mesi vuole** → poi
**monitoraggio, anche per sempre**. Non è un imbuto a scadenza: sono due prodotti che si possono
tenere a tempo indeterminato.

⚠️ **Due cose da non sbagliare.**
1. **Il mantenimento ha DUE modalità di acquisto.** Non basta marcare il piano come ricorrente:
   la cliente deve poter scegliere fra abbonamento e mese singolo, e il checkout deve usare
   `mode: 'subscription'` o `mode: 'payment'` di conseguenza. È il pezzo di lavoro in più
   rispetto a «tutto ricorrente».
2. **Il monitoraggio a pagamento NON è il monitoraggio gratuito.** Quello che si attiva quando il
   piano viene **sospeso** (pausa vacanza / sorveglianza) resta **gratis** ed è l'unico che esiste
   oggi in `monitoring.service.ts`. Il €19/mese è un prodotto nuovo che segue il mantenimento.
   Due cose diverse con lo stesso nome: è il genere di ambiguità che produce difetti silenziosi.

⚠️ **Nel seed i piani sono ancora a €29** («Mantenimento Metabole» e «Menu di rientro»). I prezzi
veri vanno messi in **Negozio**, non nel seed: il seed non sovrascrive un valore già a database.

---

## 2. Intervallo e giorno di addebito

**Proposta:** mensile, addebito nel **giorno dell'anniversario** dell'attivazione (se attivi il
31, Stripe usa l'ultimo giorno del mese: non serve gestirlo noi).

*Da decidere solo se vuoi il contrario:* addebito a data fissa per tutte (es. il 1° del mese),
che semplifica la contabilità ma obbliga a calcolare il rateo del primo mese.

---

## 3. Dunning — cosa succede se la carta viene rifiutata

**Proposta:** Stripe riprova secondo la sua politica (4 tentativi in ~2 settimane). Durante i
tentativi l'abbonamento resta **attivo**: la cliente continua a ricevere i menu. Alla fine dei
tentativi, se non è rientrato nulla, l'abbonamento passa a **scaduto** e parte:

- una **email** alla cliente al primo rifiuto, con il link per aggiornare la carta;
- un'**attività alla coach** al secondo, perché è lei che la sente.

*Il motivo di tenerla attiva durante i tentativi:* una carta scaduta non è una disdetta, e
togliere i menu a chi ha solo cambiato bancomat è il modo peggiore di farsela dire.

⚠️ **Provvigioni:** si generano **all'incasso**, non all'emissione della fattura. Se il pagamento
non arriva, nessuno prende niente. Vale anche per i rimborsi.

---

## 4. Disdetta — chi può, quando, e cosa succede ai menu

**Proposta:** la cliente disdice **dall'app**, in autonomia, in qualunque momento. La disdetta
vale **a fine periodo pagato**: i menu continuano fino alla scadenza, poi si fermano. Nessun
rimborso pro-quota (è già pagato e già erogato).

*Da decidere:* se vuoi che la disdetta passi **dalla coach** invece che essere self-service.
Trattiene qualcuna, ma è il genere di attrito che le clienti raccontano male, e la carta la
possono comunque bloccare in banca.

---

## 5. Prova gratuita

**Proposta:** **nessuna prova** né sul mantenimento né sul monitoraggio. Chi ci arriva ha già fatto un
percorso pagato: non deve provare niente, e una prova qui non aumenta le conversioni, sposta
solo il primo incasso di un mese.

*Se invece la vuoi:* Stripe la gestisce nativamente (`trial_period_days`) e il codice cambia poco;
serve però decidere se la coach prende provvigione sul primo addebito **dopo** la prova (sì,
secondo me) e cosa succede se la cliente disdice durante la prova (niente provvigione).

---

## 6. Bonifico — resta possibile sul ricorrente?

**Proposta:** **no**. Il ricorrente vive di addebito automatico; un bonifico mensile va inseguito
a mano ogni mese, e i due mondi insieme raddoppiano i casi da gestire (chi paga a metà, chi paga
in ritardo, chi paga due volte). Chi non vuole la carta resta sui **percorsi una tantum**, dove
il bonifico continua a funzionare esattamente come oggi.

*Da decidere solo se hai clienti storiche che pagano solo così:* in quel caso serve un
mantenimento «a bonifico» come piano separato, rinnovato a mano dal backoffice — e va detto
subito, perché è un pezzo di lavoro in più, non una spunta.

---

## Cosa succede appena rispondi

Il lavoro è additivo e non tocca i pagamenti una-tantum già in produzione:

1. `Plan`: prezzo ricorrente Stripe + importi provvigione **per il rinnovo**;
2. checkout: `mode: 'subscription'` per i piani ricorrenti (oggi è `payment` per tutti,
   `stripe.service.ts:40`);
3. webhook: gestire `invoice.paid` e `invoice.payment_failed` (oggi c'è solo
   `checkout.session.completed`), distinguendo primo addebito e rinnovo da `billing_reason`;
4. `generateCommissions`: paga sul rinnovo **solo se la coach assegnata è ancora quella**, e
   applica gli importi «rinnovo» invece di quelli del primo acquisto;
5. app: disdetta e «aggiorna la carta» (portale Stripe, non una schermata nostra).

Il punto 3 è quello che sblocca anche la **voce #10**, il monitoraggio a pagamento.
