# Feedback delle clienti — registro

Segnalazioni arrivate dalle clienti, con lo stato di lavorazione e — dove l'ho già verificata —
la porzione di codice che le riguarda. Il registro serve a non perderle: una segnalazione
raccolta a voce e non scritta da qualche parte, dopo due settimane non esiste più.

---

## 1. Sostituzioni: manca l'opzione "solo per oggi"

> «Sostituzioni: aggiungerei la casella SOLO PER OGGI. Se mi piace l'alimento ma per tot motivo
> non ce l'ho nella giornata odierna, non significa che devo toglierlo per più gg.»

**Stato:** risolto — segnalazione fondata, il comportamento era esattamente quello descritto.

**Cosa succedeva.** In Home, "Sostituisci un ingrediente" chiamava `POST /me/menu/substitute`,
che applicava la sostituzione a **oggi e ai due giorni successivi** (`take: 3` fisso in
`substituteDisliked`). Poi un popup chiedeva se escludere il cibo *per sempre*, e il pulsante di
rifiuto diceva "No, solo per questi giorni" — cioè tre. Non esisteva alcun modo di dire "oggi non
ce l'ho in casa, domani sì".

La distinzione che chiede la cliente è reale e importante: **"non ce l'ho" non è "non mi piace"**.
Le due cose finivano nello stesso posto, e la seconda ha conseguenze pesanti — i cibi non graditi
sono la causa del problema di ripetitività documentato in `REGISTRO_Varieta_Menu.md`, dove 13
esclusioni hanno ridotto a 1 su 5 i pranzi utilizzabili di una cliente. Ogni esclusione aggiunta
per errore restringeva permanentemente il suo menu.

**Cosa ho fatto.** La portata ora è una scelta a tre valori, e la cliente la fa **prima** di
applicare, non dopo:

| Scelta | Etichetta in app | Effetto |
| --- | --- | --- |
| `today` | Solo per oggi | Solo il menu di oggi. Da domani il cibo torna. |
| `days` | Questi giorni | Oggi e i due successivi (comportamento storico). |
| `forever` | Non mi piace | Come sopra, **e** entra fra i cibi esclusi del profilo. |

Il default nell'app è `today`, cioè l'opzione meno invasiva: se la cliente non ci pensa, il menu
non si restringe. Solo `forever` scrive in `dislikedFoods`, ed è l'unica strada che tocca il pool
dei menu futuri.

Il messaggio di risposta ora dice per quanto vale davvero: chi ha chiesto "solo oggi" legge
«nel menu di oggi… da domani torna disponibile», non più «nei prossimi menu».

**Compatibilità.** Il vecchio campo booleano `forever` resta accettato dal DTO ed è tradotto in
`scope` dal controller, così le app già installate continuano a funzionare senza cambiamenti di
comportamento. In `Profilo.tsx`, nella sezione "Cibi esclusi", si invia `scope: 'forever'`:
lì l'esclusione permanente è l'intenzione dichiarata.

**File toccati.** `menu.controller.ts` (DTO + rotta), `menu.service.ts` (`substituteDisliked`),
`app/src/pages/Home.tsx` (lista di scelta al posto del popup), `app/src/pages/Profilo.tsx`.

---

## 2. Campanella: non si può ripulire la cronologia

> «Nella campanella avere la possibilità di poter cancellare la cronologia, una sfilza di
> messaggi.»

**Stato:** risolto — la funzione non esisteva proprio.

**Cosa succedeva.** `notifications.controller.ts` esponeva solo `GET /`, le preferenze e
`PATCH /:id/read`. Nessuna rotta per rimuovere o archiviare. Le notifiche si accumulavano
all'infinito, e siccome il sistema ne genera parecchie al giorno (promemoria misure, piano di
oggi, richieste di valutazione), dopo qualche settimana la campanella era illeggibile.

**Cosa ho fatto — archiviazione, non cancellazione.** Nuovo campo `Notification.archivedAt`
(migrazione `20260804120000_notification_archived_at`, con indice su `user_id, archived_at`).
La cliente non vede più il messaggio, ma il dato resta: serve per lo storico, e serve allo staff
quando una cliente contesta un messaggio ricevuto — è la traccia di cosa il sistema ha detto.
È anche reversibile, mentre una `DELETE` non lo è.

Due rotte nuove: `PATCH /me/notifications/:id/archive` per la singola, e
`POST /me/notifications/archive-read` per lo "svuota le lette". `listForUser` filtra sempre
`archivedAt: null`.

**Una scelta deliberata.** Lo svuotamento in blocco tocca **solo le notifiche già lette**. Una
campanella ripulita non deve poter far sparire un messaggio che la cliente non ha mai aperto —
un promemoria misure o una risposta della coach. In app: "Svuota le lette" in testa allo sheet,
più una ✕ su ogni riga.

**File toccati.** `prisma/schema.prisma` + migrazione, `notifications.service.ts`,
`notifications.controller.ts`, `app/src/components/AppHeader.tsx`.

---

## 3. Peso: nessun messaggio per chi è aumentata (e messaggi fuori luogo)

> «Se quando si inserisce il peso l'IA dovrebbe mandare un messaggio specifico per chi è
> aumentato. I miei dati quando non erano modificati mi diceva questo, e mi sembra quasi una
> presa in giro.»

**Stato:** corretto il difetto; il messaggio nuovo per chi è aumentata resta da scrivere.

**Cosa succedeva.** L'unico messaggio legato alle misure è `progress_cheer`
(`notifications.service.ts`), e si attivava **solo** se `weightDrop >= 0.3 || waistDrop >= 1`.
Quindi: peso in calo → «Le misure parlano chiaro 🎉»; peso invariato o in aumento → **silenzio
totale**.

**Il difetto, ora corretto.** Quell'`||` faceva scattare i complimenti anche a chi era
*aumentata* di peso ma aveva perso un centimetro di vita — e viceversa. Con la formulazione
attuale («le tue misure sono migliorate») è proprio il caso che la cliente descrive come presa in
giro, e aveva ragione: il messaggio era falso. Ora la condizione è `improved && !worsened`, con
soglie di peggioramento speculari (`-0,3 kg`, `-1 cm`), così la zona neutra delle oscillazioni di
bilancia non conta né come progresso né come regresso. Chi peggiora in modo netto non riceve più
complimenti.

**Cosa resta aperto — di proposito.** Chi è aumentata continua a non ricevere nulla. Il silenzio
dopo un dato faticoso da inserire è la metà valida della segnalazione, ma un testo automatico per
chi è aumentata va scritto con molta cura: fattuale, senza giudizio, né consolatorio né
allarmista, e senza promettere risultati. Una frase sbagliata qui fa più danno del silenzio.
**Va scritto e approvato dalla nutrizionista prima di andare in produzione**, e per questo non
l'ho improvvisato.

**Cosa non ho potuto verificare.** «I miei dati quando non erano modificati mi diceva questo»:
dal codice, a dati invariati `progress_cheer` non parte (`weightDrop` risulta 0). Il messaggio che
ha ricevuto potrebbe essere un altro — il promemoria quotidiano del piano, o la richiesta di
valutazione — arrivato subito dopo la pesata e letto come commento a quella. Per chiudere questo
punto **serve sapere quale messaggio ha visto**: basta chiederle uno screenshot della campanella,
o cercare le sue notifiche di quel giorno dal backoffice.

---

## Test

I tre interventi sono coperti da test nuovi, tutti validati **rompendo il codice** e verificando
che il test giusto — e solo quello — diventasse rosso.

- `menu.service.spec.ts` (+5): portata `today` tocca un giorno solo, `days` tre, il default resta
  `days`, solo `forever` scrive nei cibi non graditi, e il messaggio dice per quanto vale.
- `notifications.service.spec.ts` (+7): niente complimenti a chi è aumentata di peso pur avendo
  perso centimetri (e viceversa), complimenti confermati quando una misura migliora e l'altra è
  invariata, la campanella esclude le archiviate, archiviare marca anche come letta, non si
  archivia la notifica di un'altra utente, e lo "svuota le lette" non tocca le non lette.

**Nota su una suite che era rossa.** `notifications.service.spec.ts` non si avviava affatto:
`PushService` era entrato nel costruttore di `NotificationsService` senza essere aggiunto ai
provider del test, e mancava il mock di `recipeRating`. Erano **13 test che da tempo non
verificavano più niente**. Ho aggiunto lo stub e il mock: la suite è tornata verde, e i miei 7
test si aggiungono a quelli.

Totale su `src/menu`, `src/engine-rules`, `src/notifications`: **92 test verdi, 6 suite**.
