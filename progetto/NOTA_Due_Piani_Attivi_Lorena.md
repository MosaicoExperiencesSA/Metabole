# Due piani attivi sulla stessa cliente — caso Lorena Polidoro

Scritta prima del codice, 17/8/2026. La causa non è dedotta: è letta in audit, riga per riga
(`npm run diag:storia`).

---

## 1. Cos'è successo davvero

| quando | chi | cosa |
|---|---|---|
| 09/08 16:21 | Lorena (questionario) | nasce **#1 Conosciamoci** — attivazione gratuita |
| 09/08 16:26 | (automatico) | `profile.plan_start.align_subscription` → #1 dal 10/08 al 18/08 |
| 09/08 17:42 | giusy@metabole.eu | matita: #1 dal **17/08** al **25/08** |
| **16/08 20:29:32** | Admin Metabole | «+ Attiva un piano» → nasce **#2 Conosciamoci**, e la coda scatta: `commerce.plan.queued`, `inizioEffettivo: 25/08` → dal 25/08 al 01/09 |
| **16/08 20:30:20** | Admin Metabole | **48 secondi dopo**, matita su #2: dal **17/08** al 25/08 |
| 17/08 05:22:35 | (automatico) | pausa di 7 giorni approvata → #2 finisce il **01/09** |

**La coda ha funzionato.** Il secondo piano era stato messo in fila correttamente, con inizio il
25/08. Quarantotto secondi dopo la matita l'ha riportato al 17/08, e da quel momento i due piani si
sovrappongono esattamente.

⚠️ E la «fine incoerente» che avevo segnalato **non era incoerente**: 25/08 + 7 giorni di pausa =
01/09. `pause.service` fa quello che dice di fare. L'avviso di `diag:abbonamenti` non sapeva delle
pause e mi ha mandato a cercare la causa nel posto sbagliato — l'ho corretto.

---

## 2. ⚠️ Perché non è colpa di chi ha usato la matita

Alle 20:29:32 il sistema decide di mettere il piano in coda dal 25/08. Alle 20:30:20 una persona
apre la scheda, legge «Inizio piano», e lo porta al 17/08 — perché voleva che partisse subito.

**Nessuno gliel'ha detto che stava disfando una decisione presa 48 secondi prima.** La scheda non
aveva modo di dirglielo, e la matita non aveva modo di saperlo: per il codice #2 era un abbonamento
`active` con una data d'inizio nel futuro, cioè **indistinguibile** da un piano normale che si vuole
legittimamente spostare.

---

## 3. La causa vera: «in coda» non è uno stato

`SubscriptionStatus` ha `pending | active | cancelled | expired`. Un piano messo in fila si scrive
**`active` con una data d'inizio futura** (`commerce.service.ts`, `finalizeApproval`). Da questa
singola scelta discende tutto il resto:

- **il database non può vietare due attivi**, perché due attivi sono legittimi — uno sta correndo e
  l'altro aspetta. Nessun vincolo è scrivibile finché lo stato non li distingue;
- **la scheda mostra due «Attivo» con la stessa data**, che è la cosa che ti ha fatto scrivere. Non
  è un difetto di grafica: la scheda sta dicendo la verità su un dato che non sa esprimere;
- **la matita non può avvisare**, perché non sa che quel piano è in coda;
- ⚠️ **`menu.service` fa `findFirst({ status: 'active' })`** e ne prende **uno a caso** per decidere
  quando finisce il piano di quella persona. Con due righe, la fine del piano dipende dall'ordine in
  cui il database restituisce le righe.

L'ultimo punto è quello che tocca il piatto, ed è il motivo per cui questa non è una pulizia.

---

## 4. Cosa propongo

### a) `queued` diventa uno stato

Migrazione additiva: un valore in più nell'enum. `NULL`/valori esistenti non cambiano.

- `finalizeApproval` scrive `queued` invece di `active` quando mette in fila;
- un lavoro giornaliero (dentro `daily`, dove ci sono già le scadenze) promuove a `active` i `queued`
  la cui data d'inizio è arrivata;
- ⚠️ **tutte le letture di `status: 'active'` vanno riviste una per una.** È la parte che richiede
  attenzione: un `queued` che passa per attivo in una query di fatturato conta un incasso che non
  c'è; uno che non passa dove doveva fa sparire un piano dalla scheda. Si contano, si guardano, e
  si scrive per ognuna cosa deve fare.

### b) La matita dice cosa sta per rompere

Se la data nuova fa sovrapporre questo piano a un altro non concluso, si chiede conferma con le
parole giuste — «questo piano è in coda dietro a *Conosciamoci*, che finisce il 25/08; portandolo al
17/08 la cliente ne avrà due attivi insieme» — e si registra chi ha confermato.

⚠️ Conferma e non divieto: chi gestisce le schede a volte deve davvero forzare, e un divieto secco
si aggira facendo peggio (una riga a mano nel database, che non lascia traccia).

### c) La cancellazione da admin

Chiesta da Simone. Serve per rimediare, e serve **adesso**: oggi l'unico modo di togliere il secondo
piano di Lorena è toccare il database a mano. Cancellazione logica (`cancelled`), con audit, dietro
permesso.

### d) La porta del backoffice si guarda intorno

«+ Attiva un piano» non controlla se la cliente ha già un piano dello stesso tipo attivo. Il
questionario lo fa (*«un abbonamento attivo qualunque: non le si mette una prova sopra»*), il
backoffice no. Non un divieto — un avviso prima di procedere.

---

## 5. Cosa NON faccio

- **Non tocco i dati di Lorena da qui.** Li sistema Simone dalla scheda, con (c) quando c'è.
- **Non aggiungo il vincolo in banca dati nella stessa consegna di (a).** Prima lo stato vive e si
  vede che nessuno è finito nel posto sbagliato; il vincolo si accende dopo, quando i dati sono
  puliti — accenderlo subito trasforma ogni riga storta esistente in un errore in faccia a una
  cliente.
