# Da riprendere — revisione del lavoro del 7/8

Revisione ostile di tutto il codice scritto oggi (16 push, 69 file, ~2800 righe), fatta a fine
giornata. **Niente rompe la produzione adesso**, ma sono venute fuori 9 cose vere. Nessuna è
stata corretta: la sessione si è chiusa qui.

Ordine consigliato: **6 → 2 → 1 → 8 → 3 → 7 → 5 → 4 → 9**. I primi due sono soldi, il terzo
manda notifiche doppie alle coach.

**Aggiornamento 8/8:** chiusi **1** e **8**. Restano aperti 6, 2, 3, 7, 5, 4, 9 — i due sui soldi
(6 e 2) sono ancora i primi della lista.

---

## 1. ✅ FATTO (8/8) — Notifiche doppie ogni notte fra le 22:00 e le 24:00 UTC
`backend/src/notifications/notifications.service.ts:69-77`

`notifyOncePerDay` confronta `toDateOnly()` (che da oggi è mezzanotte del giorno **romano**) con
`scheduledFor`, che è un **istante** pieno. Alle 22:30Z `today` vale già la mezzanotte di domani,
cioè **è nel futuro**: la finestra non trova le notifiche appena scritte.

*Scenario:* una cliente scrive alla coach alle 00:10 di Roma e poi alle 00:50 → la coach riceve
**due** notifiche; se riscrive la mattina dopo, una **terza**.
Riguarda tutti i chiamanti senza finestra mobile: `chat.service.ts:154,266`,
`commerce.service.ts:1592,1622`.

**È una conseguenza diretta del cambio di "oggi" di oggi.** Il confronto giusto è fra istanti,
non fra un giorno e un istante.

## 2. 🟠 Rinnovo Stripe: la provvigione può sparire per sempre
`backend/src/commerce/commerce.service.ts:1181-1214`

L'idempotenza è marcata **prima** di `generateCommissions`, che è l'unica chiamata della catena
senza `.catch()`. Se fallisce (timeout, deadlock), il webhook rilancia, Stripe riprova, ma ormai
`pspRef` esiste → `{ idempotent: true }`: provvigione, ricevuta e audit non nascono **mai**.

In più l'idempotenza qui è `findFirst` + `create` **non atomici** e `payment.pspRef` non ha
indice univoco — mentre per il one-time era già stato risolto col claim atomico
(`handleStripeEvent:1017`). Due webhook concorrenti = due pagamenti e due provvigioni.

## 3. 🟠 Il Monitoraggio a €19 eroga gli stessi menu del Mantenimento a €49
`backend/src/menu/menu.service.ts:251-259`

`deliverIfEligible` guarda solo che ci sia un abbonamento `active`: non guarda mai il `period`
del piano. Ora che `subscriptionEnd` riconosce `monitoring`, l'abbonamento parte attivo come gli
altri e i menu partono con lui.

*Scenario:* cliente che ha finito il Mantenimento compra il Monitoraggio a €19 e riceve il
servizio pieno. La documentazione del modulo dice il contrario
(`monitoring.service.ts:23`: «Gaia non eroga menu di piano»).

**Da decidere prima di correggere: cosa deve ricevere davvero chi paga €19?**

## 4. 🟠 Il pulsante del report vende solo il mese singolo, mai l'abbonamento
`app/src/pages/Report.tsx:564` (e `PlanFlow.tsx:36`)

`cart.setPlan({...})` senza `billing` → `isRicorrente` è falso → nel Checkout il toggle
"Passa all'abbonamento" non compare e parte `abbonamento: false`.

*Scenario:* fine percorso, la cliente preme "Attiva il mantenimento" dal report — che è la strada
principale di conversione — e compra €49 una tantum senza mai vedere l'abbonamento. Dal Negozio
invece funziona. **È il buco che vanifica metà del lavoro di oggi sul ricorrente.**

## 5. 🟠 Il rinnovo manda una ricevuta senza PDF (e la coach non lo vede)
`backend/src/commerce/commerce.service.ts:1216-1222` vs `1580-1587`

`finalizeApproval` allega il PDF, `handleInvoicePaid` no. Il rinnovo inoltre non passa da
`notifyCoachOfPayment`: dopo il primo mese la coach non vede più nessun incasso della sua cliente.

## 6. 🟠 Se il webhook del primo pagamento si perde, l'abbonamento è orfano per sempre
`backend/src/commerce/stripe.service.ts:71-81` + `commerce.service.ts:1162,1168`

`stripeSubscriptionId` viene scritto **solo** da `checkout.session.completed`. Se il webhook è
irraggiungibile finché Stripe esaurisce i tentativi (~3 giorni), resta `null` per sempre: da lì
ogni `invoice.paid` esce con «abbonamento sconosciuto» e risponde 200. **La cliente paga €49 al
mese, la scadenza non si sposta più, e la disdetta dall'app risponde «Nessun abbonamento da
disdire».**

Il rimedio è già a portata: `subscription_data.metadata` contiene l'id e nessuno lo legge —
esattamente il caso per cui era stato messo.

## 7. 🟠 Il lead deve scegliere la password due volte di fila
`backend/src/commerce/crm.service.ts:99` + `backend/src/auth/auth.service.ts:437-447`

`sendCredentials` crea l'account con `mustChangePassword: true`, ma `confirmPasswordReset` non
azzera il flag. Il lead clicca il link, sceglie la password, entra… e l'app gli chiede subito di
sceglierne una. Prima aveva senso (password provvisoria → tua); da stamattina no.

## 8. ✅ FATTO (8/8) — Un test diventa instabile fra le 22:00 e le 24:00 UTC
`backend/src/menu/menu-measurement-gate.spec.ts:9,68-75`

L'helper `dayIso` è rimasto sul giorno **UTC** mentre `cycleNeedsMeasure` confronta col giorno
**romano**. Se la CI gira alle 22:30Z, il test «2° giorno nel futuro → non bloccante» fallisce.
Non è successo oggi solo per l'orario.

## 9. 🟠 Ordini "Menu di rientro" ancora in sospeso restano senza menu
`backend/src/monitoring/monitoring.service.ts:265-275` (ramo rimosso)

Il seed disattiva il piano, ma un bonifico da €29 già in attesa resta approvabile. Chi lo approva
attiva un abbonamento di 8 giorni senza le 8 giornate, senza monitoraggio ripartito e senza
notifica. **Verificare in Acquisti se ce n'è qualcuno in sospeso prima di preoccuparsene.**

---

## 🔵 Minori, quando c'è tempo

- `menu.service.ts:698,726`: `statoViaggioAttivo(profile)` chiamato senza `travel_max_days` → usa
  il default 30 mentre l'agente dieta legge il parametro. Se qualcuno lo porta a 60, i due
  sistemi si contraddicono.
- `finance.service.ts:95`: `billingReason` viene selezionato e **mai usato**; il commento lungo
  che segue descrive una regola che il codice già rispettava per altra via. Da chiarire, perché
  sembra una regola attiva e non lo è.
- `monitoring.service.ts:157`: `monitoring_offer_days` letto ma inutile da quando il congelamento
  è stato tolto. Resta nel seed con una descrizione che parla di un flusso che non esiste più.
- `monitoring.service.ts:281`: il passaggio al Monitoraggio a pagamento viene tracciato nel funnel
  come "dimagrimento".
- `handleInvoicePaid` non emette `plan_renewed`: la dashboard marketing vedrà **zero rinnovi** sui
  piani ricorrenti.

---

## Verificato e a posto (non rifare il controllo)

- **`pickDiet` estratto**: confrontato riga per riga con le due copie originali. Ordine dei
  ripieghi identico, i due passi sulla famiglia sono in testa e sono opt-in — con `dietFamily`
  nullo il comportamento è quello di ieri.
- **`@Transform` sui DTO**: controllato campo per campo. Dove `0` è legittimo si usa
  `numeroOpzionaleConZero` o non c'è il Transform. Nessun campo con `@Min(0)` è finito sulla
  variante sbagliata.
- **Rotte**: nessuna collisione; `rotte-uniche.spec.ts` copre il caso.
- **Migrazioni**: complete, indice univoco su `stripe_subscription_id` incluso.
- **App già installate**: nessun 400 nuovo, tranne il caso voluto (bonifico su piano `recurring`).
