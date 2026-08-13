# Vera come coda delle domande — il contratto fra le due sessioni

Scritto il 13/8/2026. Decisione di Simone: *«le domande, richieste e curiosità le facciamo arrivare
lì, in modo che la nutrizionista abbia le chat con le clienti per le risposte base e la chat con Vera
che aiuta tutta Metabole ad apprendere»*.

Questo file è **il confine fra i due lavori**, non un pezzo di specifica di Vera. Chi costruisce Vera
decide come Vera parla; qui c'è solo cosa ci scambiamo, e cosa nessuno dei due deve fare da solo.

---

## 1. Il caso da cui nasce

Tre clienti hanno un'allergia scritta a mano che il motore **non sa tradurre**: «Favismo»,
«Carboidrati», «finocchi, pesche ciliegie finocchi radicchio legumi».

⚠️ **Oggi due di quelle tre non escludono niente.** L'esclusione testuale cerca la parola negli
ingredienti e nei nomi dei piatti: «favismo» non compare da nessuna parte, quindi quell'allergia
dichiarata non toglie un solo piatto. È il difetto di `frutta_a_guscio` dell'8/8, ma qui la parola
**non è traducibile da noi**: la deve tradurre una nutrizionista.

## 2. Perché Vera e non una notifica

Perché da **una** risposta di Lucia escono **due** scritture diverse, e Vera è l'unico pezzo che già
le distingue (l'ambito si chiede quando la regola nasce; «a tutte» non scrive, apre una proposta):

| | cosa si scrive | dove | regole |
|---|---|---|---|
| **per quella cliente** | fave e legumi fra le sue esclusioni | profilo | dato sanitario: transazione + `audit.log`, permesso `change_allergies` |
| **per tutte** | «favismo» diventa una parola conosciuta | dizionario di Vera (`FamigliaAlimento`) | proposta in approvazione, non scrittura diretta |

⚠️ **Non vanno fuse.** Una traduzione clinica data di fretta su una cliente non deve entrare nel
vocabolario di tutte le clienti perché qualcuno ha risposto in fretta a una domanda.

## 3. Cosa chiediamo a Vera (la funzione che implementa l'altra sessione)

```ts
apriRichiestaVera({
  tipo: 'allergia_da_tradurre' | 'intolleranza_da_tradurre',
  clienteId: string,
  testo: string,        // la domanda già scritta, in italiano, pronta da leggere
  origine: string,      // chi l'ha aperta: 'personal-base', 'scheda-cliente', 'campagna-allergie'
  chiave: string,       // vedi sotto: l'idempotenza
});
```

- **`chiave` è obbligatoria** ed è ciò che rende la chiamata ripetibile: `allergia:<clientId>:<termine
  normalizzato>`. ⚠️ Senza, il primo lavoro programmato che gira ogni notte riapre la stessa domanda
  ogni notte, e in una settimana la coda della nutrizionista è illeggibile. La seconda chiamata con
  la stessa chiave **non deve fare niente** e non è un errore.
- **La notifica parte una volta sola**, non a ogni riapertura.

## 4. Cosa chiediamo che Vera faccia

1. La domanda compare in un **elenco di richieste aperte**, non solo dentro il dialogo.
   ⚠️ È l'avvertenza che conta più di tutte: se le richieste vivono solo come messaggi, in due
   settimane sono una chat lunga in cui le cose scendono e nessuno sa più cosa manca. Ogni richiesta
   ha un **tipo**, un **soggetto** e uno **stato aperta/chiusa**. (Se serve una prova di quanto sia
   vero: è la stessa ragione per cui il 13/8 è nata la pagina Lavori invece di fidarci del REGISTRO.)
2. Alla risposta, Vera fa **le due scritture separate** del §2, chiedendo l'ambito come già fa.
3. La richiesta si **chiude** con la risposta, e resta leggibile con chi e quando.

## 5. Cosa NON deve fare nessuno dei due

- ⚠️ **Noi non scriviamo in `MessaggioVera`, `AzioneVera`, `FamigliaAlimento`.** Chiamiamo la
  funzione. Due sessioni che scrivono la stessa tabella con due idee diverse dello stato è il guasto
  dello schema del 13/8, ma sui dati invece che sui file — e sui dati non c'è `git` che lo mostri.
- ⚠️ **Vera non scrive `allergies` sul profilo a mano.** La scrittura passa dal punto unico che
  esiste già: `ClientsService.updateClient(userId, actorId, dto)`, che controlla il permesso
  `change_allergies`, ricalcola `allergiesOther` e lascia la traccia. Una seconda strada per lo
  stesso dato sanitario è il difetto che questo campo ha già avuto due volte.
- ⚠️ **Niente blocchi.** Decisione di Simone (13/8): finché la nutrizionista non risponde **non si
  ferma nulla** — il percorso continua, i menu escono. La cosa resta visibile dove già lo è:
  «allergie da codificare a mano» in `personal-base` e la pastiglia «da valutare» nell'elenco
  Clienti (col filtro, dal 13/8).

## 6. Il testo della domanda lo scriviamo noi

Perché è dalla nostra parte che si sa cosa manca. Forma:

> **Mariastella ha dichiarato un'allergia che non so tradurre: «Favismo».**
> Cosa devo togliere dal suo piatto? Se vale come regola generale, dimmelo: la imparo per tutte.

⚠️ Non «codifica l'allergia della cliente 3f2a». La legge una nutrizionista fra due visite.
