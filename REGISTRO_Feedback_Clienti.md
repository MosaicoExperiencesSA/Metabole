# Feedback delle clienti — registro

Segnalazioni arrivate dalle clienti, con lo stato di lavorazione e — dove l'ho già verificata —
la porzione di codice che le riguarda. Il registro serve a non perderle: una segnalazione
raccolta a voce e non scritta da qualche parte, dopo due settimane non esiste più.

---

## 1. Sostituzioni: manca l'opzione "solo per oggi"

> «Sostituzioni: aggiungerei la casella SOLO PER OGGI. Se mi piace l'alimento ma per tot motivo
> non ce l'ho nella giornata odierna, non significa che devo toglierlo per più gg.»

**Stato:** da fare — segnalazione fondata, il comportamento attuale è esattamente quello descritto.

**Cosa succede oggi.** In Home, "Sostituisci un ingrediente" chiama `POST /me/menu/substitute`,
che applica la sostituzione a **oggi e ai due giorni successivi** (`take: 3` in
`substituteDisliked`). Poi un popup chiede se escludere il cibo *per sempre*, e il pulsante di
rifiuto dice "No, solo per questi giorni" — cioè tre. Non esiste alcun modo di dire "oggi non ce
l'ho in casa, domani sì".

La distinzione che chiede la cliente è reale e importante: **"non ce l'ho" non è "non mi piace"**.
Oggi le due cose finiscono nello stesso posto, e la seconda ha conseguenze pesanti — i cibi non
graditi sono la causa del problema di ripetitività documentato in `REGISTRO_Varieta_Menu.md`,
dove 13 esclusioni hanno ridotto a 1 su 5 i pranzi utilizzabili di una cliente. Ogni esclusione
aggiunta per errore restringe permanentemente il suo menu.

**Dove si interviene.** `DislikeIngredientDto` (`forever: boolean` → serve una portata a tre
valori), `MenuService.substituteDisliked` (il `take: 3` diventa parametrico), e lo sheet
`SubstituteIngredient` in `app/src/pages/Home.tsx`.

---

## 2. Campanella: non si può ripulire la cronologia

> «Nella campanella avere la possibilità di poter cancellare la cronologia, una sfilza di
> messaggi.»

**Stato:** da fare — confermato, la funzione non esiste proprio.

**Cosa succede oggi.** `notifications.controller.ts` espone solo `GET /`, le preferenze e
`PATCH /:id/read`. Non c'è nessuna rotta per rimuovere o archiviare. Le notifiche si accumulano
all'infinito, e siccome il sistema ne genera parecchie al giorno (promemoria misure, piano di
oggi, richieste di valutazione), dopo qualche settimana la campanella è illeggibile.

**Nota di metodo.** Da implementare come *archiviazione*, non come cancellazione definitiva:
la cliente non vede più il messaggio, ma il dato resta per lo storico e per lo staff. È
reversibile, e le notifiche sono anche una traccia di cosa il sistema ha comunicato.

---

## 3. Peso: nessun messaggio per chi è aumentata (e messaggi fuori luogo)

> «Se quando si inserisce il peso l'IA dovrebbe mandare un messaggio specifico per chi è
> aumentato. I miei dati quando non erano modificati mi diceva questo, e mi sembra quasi una
> presa in giro.»

**Stato:** da chiarire con la cliente prima di intervenire — vedi sotto.

**Cosa succede oggi.** L'unico messaggio legato alle misure è `progress_cheer`
(`notifications.service.ts`), e si attiva **solo** se `weightDrop >= 0.3 || waistDrop >= 1`.
Quindi: peso in calo → «Le misure parlano chiaro 🎉»; peso invariato o in aumento → **silenzio
totale**. La prima metà della segnalazione è quindi confermata: chi è aumentata non riceve
niente, e il silenzio dopo un dato faticoso da inserire è una risposta pessima.

**Un difetto già visibile nella condizione.** L'`||` fa scattare i complimenti anche a chi è
*aumentata* di peso ma ha perso un centimetro di vita — e viceversa. Con la formulazione attuale
(«le tue misure sono migliorate») è proprio il caso che la cliente descrive come presa in giro.

**Cosa non ho potuto verificare.** «I miei dati quando non erano modificati mi diceva questo»:
dal codice, a dati invariati `progress_cheer` non parte. Il messaggio che ha ricevuto potrebbe
essere un altro (il promemoria quotidiano del piano, o la richiesta di valutazione) arrivato
subito dopo la pesata e letto come commento a quella. Prima di scrivere codice **serve sapere
quale messaggio ha visto**: basta chiederle uno screenshot della campanella, o cercare le sue
notifiche di quel giorno dal backoffice.

**Il punto delicato.** Un messaggio automatico a chi è aumentata di peso va scritto con molta
cura: deve essere fattuale e privo di giudizio, non consolatorio né allarmista, e non deve
promettere risultati. Una frase sbagliata qui fa più danno del silenzio attuale. Vale la pena
farlo rivedere alla nutrizionista prima di metterlo in produzione.
