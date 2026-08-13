# Consegne — §7 allergie: la ri-domanda in chat con Gaia

> Per chi lavora sullo stesso perimetro (l'altra sessione del 13/8, o chiunque ci torni sopra).
> Scritto il 13/8/2026 a lavoro finito. Il dettaglio sta nel riquadro di stato in testa al §7 di
> `HANDOFF_Allergie_Intolleranze.md`: qui c'è solo quello che serve per **non rompere niente**.

## 1. La stessa domanda va per DUE strade, ed è voluto

| | chi la vede | dove | cosa chiede |
|---|---|---|---|
| **Scheda in home** — `app/src/components/ChiediAllergie.tsx` + `backend/src/profile/dichiara-allergie.ts` | chi non ha **mai** risposto (pop. 3, la più numerosa) | app, OTA 13/8 | le allergie, caselle + campo libero |
| **Dialogo con Gaia** — `backend/src/chat/allergie-chat*.ts` + `campagna-allergie.ts` | intolleranza ignota · allergie da codificare | chat, dalla notifica `allergie_conferma` | quello che una casella non sa chiedere |

La riga che le tiene separate è **una sola**: `POPOLAZIONI_IN_CAMPAGNA` in
`backend/src/chat/campagna-allergie.ts`. La campagna in chat **non** contatta la popolazione 3.

⚠️ Se un domani la scheda in home coprisse anche le altre due, **si toglie una riga da lì** — non si
riscrive un criterio da nessuna parte. La popolazione la decide sempre e solo
`common/da-ricontattare.ts`, la stessa funzione della conta (`npm run conta:allergie`).

## 2. Perché il dialogo NON passa da `profile/dichiara-allergie.ts`

Era la richiesta lasciata nel COMMIT della scheda in home, e la ragione era giusta: due punti che
scrivono le allergie con due idee diverse di cosa sia una risposta è la cosa che questo progetto
passa il tempo a togliere. Ma qui non sono due idee diverse della stessa operazione: sono **due
operazioni**, e forzarle in una funzione sola le romperebbe tutte e due.

| | `dichiara-allergie.ts` | `allergie-chat.service.ts` |
|---|---|---|
| cos'è | la **prima** dichiarazione di chi non ha mai risposto | la **traduzione** di una dichiarazione che esiste già |
| sul testo libero | lo **aggiunge**, mai sostituisce (giusto: nessuno può rispondere al posto suo) | lo **sostituisce col codice** — è precisamente il lavoro |
| quante volte | una sola: se `allergieDichiarateIl` c'è, la porta è chiusa | quante servono: chi è in pop. 1 o 2 quella data ce l'ha già |

Il pezzo condiviso **c'è, ed è quello giusto**: `common/allergie.ts` (`allergieDichiarate`,
`intolleranzeDichiarate`, `NON_ALIMENTI`). È lì che vive l'idea di cosa sia una risposta, e le due
strade la prendono da lì.

⚠️ **Se tocchi `common/allergie.ts`, stai toccando tutte e due.** Fai girare
`src/common/allergie.spec.ts`, `src/chat/allergie-chat*.spec.ts` e `src/profile/dichiara-allergie.spec.ts`
insieme, non uno solo.

## 3. L'invariante che nessun errore ti segnalerà

**`allergiesOther` è un sottoinsieme di `allergies`.** È un MARCATORE, non uno spostamento: il testo
libero sta **anche** dentro `allergies`, perché sette punti del codice leggono `allergies` per
escludere davvero gli alimenti. Un dato che rompe questo invariante non fa esplodere niente: fa solo
sparire un'esclusione, in silenzio, su un dato sanitario.

Il freno del dialogo si appoggia a questo: confronta le **chiavi di `exclusionKeys`** prima e dopo,
e se qualcosa resterebbe scoperto si ferma e passa alla nutrizionista. Se costruisci a mano dei dati
di prova che violano l'invariante, quel controllo sembra sbagliato e non lo è.

## 4. Cosa non toccare senza rileggere il perché

- **`meta.allergie` è la PRIMA delle tre chiavi** nell'ordine di precedenza di `chat.service.ts`,
  non l'ultima. La risposta a «hai qualche allergia?» è un elenco di alimenti, e un elenco di
  alimenti somiglia moltissimo alla richiesta di sostituirne uno: spostandola dopo, «il latte»
  apre il dialogo di sostituzione e l'allergia **non viene mai registrata, senza nessun errore**.
- **Si passa alla nutrizionista, non alla coach.** L'handoff dice coach; il §5 dello stesso
  documento dice che le allergie le scrivono solo nutrizionista e capo nutrizionista.
- **L'audit sta dentro la transazione**, non dopo come nel resto del prodotto.
- **Lo spazio in fondo a `'pan '`** nelle keywords del catalogo: se normalizzi quelle chiavi con un
  `trim()`, «panna» diventa glutine.

## 5. Ordine di rilascio, e cosa resta

1. **Backend su Render** — l'app aggiornata chiama `POST /me/threads/allergie`.
2. **OTA** dell'app.
3. ⛔ **`npm run chiedi:allergie`** in prova, elenco letto riga per riga, poi `CONFERMA=1`.
   Per ultimo, mai prima dei due passi sopra.
4. ⛔ **Il giro vero in app** (collaudo del §9): notifica → chat → due risposte in testo libero →
   conferma → profilo scritto.

⚠️ Le due modifiche all'app (`lib/rottaNotifica.ts`, `pages/Assistente.tsx`) sono **inerti** finché
il punto 3 non gira: l'intento nasce solo da una notifica `allergie_conferma`, e quelle non
esistono ancora. Se salgono con una OTA prima del previsto non cambiano niente per nessuno.

## 6. ⚠️ Una nota di igiene, non di codice

Il 13/8 un `git add -A` ha portato dentro `bef84c5` e `904e72d` tutti i file di questa consegna
mentre erano ancora in scrittura, da un'altra sessione. Non si è rotto niente, ma una consegna che
doveva uscire per conto suo è finita nel commit della OTA. Quando due sessioni lavorano sullo stesso
repo, `git add` va dato **sui propri file**, non su tutto.
