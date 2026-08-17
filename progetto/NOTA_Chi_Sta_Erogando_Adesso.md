# Fra due piani attivi, quale «è» il piano? — la scelta che nessuno faceva

Scritta prima del codice, 17/8/2026, dopo il sì di Simone («prima i tre di oggi»). Tutto quello che
segue è **letto nel codice**, con file e riga.

---

## 1. ⚠️ La storia di Lorena è più precisa di come l'avevo scritta

`NOTA_Due_Piani_Attivi_Lorena.md` dice: «nessuno le ha detto che stava disfacendo una decisione presa
48 secondi prima». È vero, ma non è tutto — e la parte che mancava è peggiore.

`pickMainSubscription` (`commerce/commerce.service.ts:134`) sceglie l'abbonamento che la scheda mostra
come **piano corrente**, e la sua prima riga è:

```ts
subs.find((s) => s.status === 'active') ?? …
```

La lista le arriva `orderBy: { createdAt: 'desc' }` (`clients.service.ts:214`). Quindi **fra due righe
`active` vince la più RECENTE.** Alle 20:30:20 la più recente era #2: quello nato 48 secondi prima,
in coda dal **25/08**.

Cioè: la scheda non è che *non avvisava*. La scheda **mostrava il piano in coda al posto di quello in
corso**, e scriveva «Inizio piano: 25/08». Chi l'ha aperta ha letto una data sbagliata e l'ha
corretta — ha fatto la cosa giusta con quello che le era stato mostrato. E la matita
(`clients.service.ts:1166`) usa la **stessa** funzione, quindi ha spostato la stessa riga sbagliata.

⚠️ Questo lo si vede nel codice e combacia con i tempi dell'audit; non ho lo screenshot di quello che
lei ha visto sullo schermo. Ma non serve un dato in più per correggerlo: la riga che sceglie è
sbagliata comunque sia andata quella sera.

---

## 2. Gli altri tre punti, e cosa sbagliano OGGI

Nessuno di questi ha bisogno dello stato `queued` per essere un difetto: bastano due righe `active`,
che oggi sono legittime.

| dove | cosa fa | cosa sbaglia |
|---|---|---|
| `menu.service.ts:356` | `findFirst({clientId, status:'active'})` **senza `orderBy`** | Ne prende una **a caso** (l'ordine è quello che restituisce il database). Da lì escono «piano concluso?» e `planEnd`, cioè **fino a che giorno si erogano i menu**. Con due righe, quanti giorni riceve dipende dall'ordine delle righe. |
| `pause.service.ts:544` | `findFirst(…, orderBy createdAt desc)` | Prende la più **recente**, che è tipicamente quella in coda: i 7 giorni di pausa si sommano alla fine del piano **sbagliato**. La cliente resta senza i giorni che le sono stati concessi, e sulla carta risultano dati. |
| `coach.service.ts:104` | `findMany` + `new Map(subs.map(…))` | Con due righe per la stessa cliente la `Map` **tiene l'ultima**: `planEndDate` in lista clienti può essere la fine del piano in coda. La coach programma il lavoro su una data che non è quella. |

E `data-inizio-chat.service.ts:461` la domanda giusta **se la fa** — attivo, cominciato, non finito —
ma se la fa **a mano, per conto suo**. Quattro punti, quattro definizioni: è il difetto che questo
progetto paga più spesso.

---

## 3. La decisione: una funzione sola, e sceglie per DATE

Modulo puro `commerce/abbonamento-in-corso.ts`. Fra gli abbonamenti `active` di una cliente:

1. **Quelli che stanno erogando oggi** — cominciato (`startDate` nulla o passata) e non finito
   (`endDate` nulla o da oggi in poi), confrontando **per giorno** come fa il resto del motore.
   Se ce n'è più d'uno (lo stato rotto di Lorena) vince **quello che finisce più tardi**.
2. Se nessuno eroga: **il primo che partirà** — la coda.
3. Se non c'è nessun `active`: `null`, e i chiamanti si comportano come oggi.

⚠️ **Perché "finisce più tardi" e non "cominciato prima»:** se due piani si sovrappongono, la cliente
ha pagato fino alla fine del secondo. Prendere la fine più vicina le taglierebbe giorni che ha
comprato — e fra due scelte imperfette si prende quella che non toglie niente a nessuno.

⚠️ **`startDate` nulla vale «già cominciato»**, non «non ancora»: è come si comporta già
`filtroClienteConPianoAttivo` (`common/piano-attivo.ts:89`, che guarda solo la fine), e due regole
diverse sullo stesso campo sono il modo di far divergere l'erogazione dalle diagnostiche.

### Dove entra

- `pickMainSubscription` — al posto di `find(s => s.status === 'active')`. Da qui si sistemano in un
  colpo la **scheda**, la **matita**, l'allineamento della data d'inizio (`profile.service:136`) e il
  cambio data dalla chat (`data-inizio-chat:473`);
- `menu.service:356` — l'erogazione;
- `pause.service:544` — il congelamento;
- `coach.service:104` — una riga per cliente, scelta e non «l'ultima che capita».

### Cosa NON fa

- **Non introduce lo stato `queued`**: quello resta la causa, e si fa dopo (voce del piano in
  `NOTA_Due_Piani_Attivi_Lorena.md` §4a). Questa consegna rende **deterministico** un comportamento
  che oggi dipende dall'ordine delle righe, e non pretende di aver chiuso la causa.
- **Non vieta niente e non tocca nessun dato.** Nessuna migrazione.
- **Non aggiunge l'avviso della matita** (§4b della nota): è una consegna sua.

---

## 4. Le schermate dello staff: un piano in coda conta come «ha un piano»

Decisione di Simone del 17/8: **sì, è un contratto.** Un piano comprato conta anche se parte fra una
settimana.

Cosa vuol dire, punto per punto:

- `clients.service:253` (`hasActivePlan` in scheda) — `active` + fine non passata: **già così**, un
  piano in coda ha la fine nel futuro e conta. Non si tocca.
- `dashboard.service:148` (KPI «Abbonamenti attivi») — conta le righe `active` senza guardare le
  date: **già così**. ⚠️ Ma conta **abbonamenti**, non persone: Lorena, con due righe, contava due
  volte. Con «è un contratto» è difendibile (sono due contratti), e va detto a chi legge il numero —
  non è «quante clienti stanno ricevendo menu».
- `coach.service:104` (pallino e `planEndDate` in lista clienti) — `planActive` resta vero anche se
  l'unico piano è in coda; quello che cambia è che `planEndDate` diventa la fine del piano **in
  corso**, e non quella dell'ultima riga che capita.

⚠️ Il prezzo di questa scelta, scritto perché è reale: nei giorni fra l'acquisto e la partenza la
coach vede «ha un piano» e la cliente non riceve ancora niente. È il compromesso accettato: l'altra
strada — mostrare «senza piano» a chi ha appena comprato — è quella che invita ad attivarne un
secondo sopra, che è esattamente il caso Polidoro.
