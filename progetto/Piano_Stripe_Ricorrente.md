# Piano di implementazione — Stripe pagamenti ricorrenti

**Data:** 20 luglio 2026 · Autore: Claude (per Simone)

## Premessa importante (buona notizia)
Stripe **è già integrato** in Metabole per i pagamenti a carta **una-tantum**: c'è già il
Checkout ospitato da Stripe (`stripe.service.ts`), il webhook con verifica di firma
(`POST /api/v1/payments/webhook`) e tutta la catena post-pagamento (`finalizeApproval`) che
attiva l'abbonamento, eroga i menu, genera provvigioni, manda la ricevuta, ecc. Oggi però
è tutto in modalità **`payment`** (addebito singolo): il rinnovo è un nuovo acquisto manuale.

Il ricorrente **riusa** quasi tutto: si aggiunge la modalità **`subscription`**, si salva
l'id abbonamento Stripe, e si gestiscono 3-4 nuovi eventi webhook. Non si riscrive nulla.

---

## PARTE A — Decisioni da prendere PRIMA (tue/del socio)
Sono scelte di business: senza queste il dev non può partire.

1. **Quali piani diventano ricorrenti?** Es. solo il **Mantenimento** (€29/mese) e i piani
   mensili? I percorsi a 3/6 mesi restano una-tantum o diventano "ogni 3 mesi"? (Consiglio:
   iniziare col solo Mantenimento, che è il caso d'uso naturale del ricorrente.)

2. **Intervallo di addebito** per ciascun piano ricorrente: mensile? ogni 3 mesi?

3. **PROVVIGIONI sul rinnovo** — decisione critica. Oggi le provvigioni si generano su
   OGNI pagamento approvato, senza distinzione primo acquisto/rinnovo. Col ricorrente,
   ogni mese arriva un nuovo pagamento: se non si decide una regola, **si pagherebbero
   provvigioni piene a ogni mese**. Scegli una delle tre:
   - (a) provvigione **solo al primo** addebito (acquisizione), zero sui rinnovi;
   - (b) provvigione **piena ogni** rinnovo (modello "residual", costa di più);
   - (c) provvigione **ridotta** sui rinnovi (es. metà). ← spesso il compromesso.

4. **Pagamento fallito (dunning)**: quando la carta viene rifiutata, cosa succede?
   Stripe ritenta da solo per qualche giorno (retry automatici configurabili). Alla fine,
   se non va a buon fine: (i) sospendi l'erogazione menu? (ii) avvisi la cliente + la coach?
   (Consiglio: Stripe retry ~2 settimane → poi stato "scaduto" + notifica.)

5. **Disdetta**: la cliente disdice quando vuole (obbligo di legge). Alla disdetta il piano
   resta attivo **fino a fine periodo già pagato**, poi si ferma. Confermi questo comportamento.

6. **Prova gratuita**: chi fa la prova e poi passa a un piano ricorrente — l'addebito
   ricorrente parte da subito o dopo il primo mese? (Oggi la prova è gestita a parte.)

7. **Chi paga con bonifico** resta come oggi (il ricorrente vale solo per carta): confermi
   che teniamo entrambe le strade.

---

## PARTE B — Configurazione su Stripe (dashboard, la fai tu)
Nessun codice, solo pannello Stripe. In **modalità test** prima, poi live.

1. **Prodotti e Prezzi ricorrenti**: per ogni piano ricorrente crea un *Product* con un
   *Price* **recurring** (importo + intervallo: es. €29 / month). Segnati l'**ID del Price**
   (`price_...`): serve al dev per collegarlo al piano nel DB.

2. **Customer Portal** (Impostazioni → Billing → Customer portal): attivalo. È la pagina
   pronta di Stripe dove la cliente aggiorna la carta e disdice — evita di scrivere UI da zero.
   Configura: consenti annullamento, consenti aggiornamento metodo di pagamento.

3. **Webhook**: aggiungi (o aggiorna) l'endpoint webhook `…/api/v1/payments/webhook` e
   **abilita anche** gli eventi ricorrenti (oltre a `checkout.session.completed` già usato):
   - `invoice.paid` (rinnovo andato a buon fine)
   - `invoice.payment_failed` (addebito fallito)
   - `customer.subscription.deleted` (disdetta/fine)
   - `customer.subscription.updated` (cambi di stato/piano)
   Copia il **Signing secret** (`whsec_...`) → è l'env `STRIPE_WEBHOOK_SECRET`.

4. **Retry/dunning** (Impostazioni → Billing → Gestione fatture non riuscite): imposta i
   tentativi automatici e cosa fare a esaurimento (es. annulla l'abbonamento).

---

## PARTE C — Modifiche al database (dev)
Piccole aggiunte, tutte additive (migration semplici):

1. **Plan**: aggiungere `stripePriceId String?` (l'id del Price ricorrente creato al punto B1).
   Un piano senza `stripePriceId` resta una-tantum (retrocompatibile).
2. **Subscription**: usare il campo **già esistente** `pspRef` (oggi inutilizzato sulla
   Subscription) per salvare lo `stripeSubscriptionId` (`sub_...`).
3. **User/ClientProfile**: aggiungere `stripeCustomerId String?` (il *Customer* Stripe della
   persona: si crea una volta e si riusa per tutti i suoi addebiti).
4. **SubscriptionStatus**: valutare l'aggiunta dello stato **`past_due`** (addebito fallito,
   in attesa di retry) — oggi l'enum ha solo pending/active/cancelled/expired.

---

## PARTE D — Modifiche al codice backend (dev)

1. **stripe.service.ts**
   - `getOrCreateCustomer(clientId)`: crea il Customer Stripe (email + nome) e ne salva l'id
     su `stripeCustomerId`, oppure riusa quello esistente.
   - `createSubscriptionCheckout(...)`: come l'attuale `createCheckoutSession` ma
     **`mode: 'subscription'`**, con `customer` = il customer id e `line_items` = il
     `stripePriceId` del piano (non più `price_data` inline). Mantieni
     `metadata: { clientId, planId }` per ritrovarli nel webhook.
   - `createBillingPortalSession(customerId)`: genera il link al Customer Portal (per il
     tasto "Gestisci abbonamento" nell'app).

2. **commerce.service.ts → `handleStripeEvent(event)`** — aggiungere i nuovi rami:
   - `checkout.session.completed` **in modalità subscription**: salva
     `stripeSubscriptionId` su Subscription (`pspRef`), attiva come oggi.
   - `invoice.paid`: è il **rinnovo**. Crea un nuovo Payment (`method:'card'`,
     `status:'approved'`, `pspRef` = id fattura) e chiama `finalizeApproval` con
     l'opzione provvigioni scelta al punto A3 (es. `skipCommissions` sui rinnovi, oppure
     una nuova opzione `renewal: true` con aliquota ridotta). **Idempotenza**: usa l'id
     fattura Stripe come chiave per non duplicare (come già fa con `paymentId`).
   - `invoice.payment_failed`: porta la Subscription in `past_due`, notifica cliente+coach,
     eventualmente sospendi l'erogazione menu (decisione A4).
   - `customer.subscription.deleted`: porta la Subscription in `cancelled`/`expired` a fine
     periodo; ferma il rinnovo.

3. **finance.service.ts → provvigioni sul rinnovo**: implementare la regola scelta (A3).
   Punto esatto: `generateCommissions` viene chiamato da `finalizeApproval`; aggiungere il
   ramo "rinnovo" (salta o riduce).

4. **commerce.controller.ts**
   - Nuovo endpoint `POST /me/billing-portal` → restituisce l'URL del Customer Portal per
     la cliente loggata (per disdetta/aggiornamento carta).
   - Il checkout esistente (`/me/checkout`, `/me/subscribe`): se il piano ha `stripePriceId`
     e la cliente sceglie carta → usa `createSubscriptionCheckout` invece di quello one-shot.

5. **Cron/scadenze**: la logica attuale di auto-cancel dei pending e scadenza piani va
   rivista per non entrare in conflitto con gli stati guidati da Stripe (il rinnovo lo decide
   Stripe, non il cron).

---

## PARTE E — Modifiche all'app cliente (dev)
1. **Checkout.tsx**: già gestisce il redirect a `checkoutUrl` — funziona identico anche per
   subscription (Stripe ritorna un url di checkout). Aggiornare solo le copy ("abbonamento
   che si rinnova automaticamente ogni mese, disdici quando vuoi").
2. **Profilo / Percorso**: aggiungere il tasto **"Gestisci abbonamento"** che apre il
   Customer Portal (chiama `/me/billing-portal`). Da lì la cliente aggiorna la carta o disdice.
3. **Consenso chiaro** al momento dell'iscrizione: checkbox/testo "autorizzo l'addebito
   ricorrente" (requisito Stripe + normativa UE).

---

## PARTE F — Env e config
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` → già previsti (aggiornare il secret con quello
  del webhook che include gli eventi ricorrenti).
- Nessun nuovo secret oltre a questi. Gli ID Price ricorrenti si salvano nel DB (Plan), non in env.

---

## PARTE G — Test (prima di andare live)
1. **Modalità test di Stripe** con le carte di prova (es. `4242 4242 4242 4242` = ok;
   `4000 0000 0000 0341` = addebito rinnovo fallito).
2. **Stripe CLI** (`stripe listen --forward-to …/api/v1/payments/webhook`) per simulare gli
   eventi `invoice.paid` / `invoice.payment_failed` senza aspettare i cicli reali.
3. Verificare a ogni ciclo: abbonamento resta attivo, menu erogati, provvigioni corrette
   (secondo la regola A3), ricevuta inviata, disdetta dal Portal ferma il rinnovo.
4. Test del pagamento fallito → stato `past_due` → notifica → esito finale.

---

## PARTE H — Rollout consigliato
1. Fase 1: attiva il ricorrente **solo sul Mantenimento**, in test, poi live per i **nuovi**
   clienti. I percorsi restano una-tantum.
2. Fase 2: se funziona, estendi ai piani mensili.
3. Tieni **sempre** il bonifico e la carta una-tantum come alternative (non tutti vogliono
   l'addebito automatico).

---

## Riepilogo "chi fa cosa"
- **Tu/socio (decisioni A)**: quali piani, intervallo, regola provvigioni rinnovo, dunning,
  disdetta, prova.
- **Tu (Stripe dashboard B)**: Prodotti/Prezzi ricorrenti, Customer Portal, webhook + eventi,
  retry. Copiare gli ID Price e il webhook secret per il dev.
- **Dev (C-D-E-F)**: 3 aggiunte schema, estensione `stripe.service` + `handleStripeEvent` +
  regola provvigioni, endpoint portal, tasti "Gestisci abbonamento" + copy consenso.
- **Insieme (G-H)**: test in modalità Stripe test, rollout graduale dal Mantenimento.

## Stima
Lavoro di sviluppo **contenuto** perché la base c'è già: indicativamente qualche giornata
uomo (schema + eventi webhook + portal + provvigioni-rinnovo + test), esclusa la parte di
decisioni e config Stripe che è tua. La voce che richiede più attenzione è la **regola
provvigioni sul rinnovo** (per non pagare due volte) e il **dunning**.

> Nota: questo è un piano tecnico/operativo. Sull'opportunità commerciale e sugli aspetti
> contrattuali/normativi degli abbonamenti la decisione finale è tua e del socio; non è un
> consiglio finanziario.
