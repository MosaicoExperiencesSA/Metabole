# La pagina «Lavori» — come si compila (per chiunque lavori su Metabole, umano o agente)

Scritta il 13/8/2026, insieme alla pagina. Vale per **tutte** le sessioni: se lavori su Metabole e
chiudi o apri qualcosa, questa pagina va tenuta vera, come `REGISTRO.md` e `COMMIT.txt`.

## Cos'è, e cosa non è

Backoffice → **Lavori** (`/lavori`, permesso `dev_backlog`, di default solo admin).

- **Risponde a «cosa manca».** `progetto/REGISTRO.md` racconta **cosa è stato scritto** e resta la
  fonte del dettaglio; questa pagina ne è l'indice, più l'elenco di quello che è ancora aperto.
- ⚠️ **Non è un secondo registro.** Se una voce ha bisogno di tre paragrafi per essere capita, i tre
  paragrafi vanno nel REGISTRO: qui ci va il titolo e il perché in poche righe.

## I tre colori — la regola, non il gusto

| | quando | cosa vuol dire |
|---|---|---|
| 🟢 verde | `fatto: true` | chiuso. **Resta in elenco**, in fondo, con data e nome di chi ha spuntato |
| 🟡 giallo | la categoria comincia con «Aspetta» | aspetta una persona o una decisione, non è codice fermo |
| 🔴 rosso | `blocca: true` | **dietro c'è una fila ferma** |

⚠️ **Il rosso non vuol dire «importante».** Vuol dire: *finché questa non si chiude, quelle non
partono*. Se lo si usa per dire «urgente», in un mese è tutto rosso e il colore non dice più niente.

## Le categorie in uso

`Aspetta Nocanty` · `Aspetta Simone` · `Da fare — codice` · `Manutenzione` · `Dati e catalogo` ·
`Storico · [Sviluppo]` / `Storico · [Prodotto]` (le voci del registro, già spuntate).

Se ne serve una nuova si scrive e basta — è un campo di testo con i suggerimenti di quelle esistenti.
Prima di inventarne una, guarda se una di queste dice già la stessa cosa: cinque categorie con dentro
qualcosa valgono più di dodici con dentro una voce.

## Come si scrive dentro

**A mano, dalla pagina** — è il modo normale. Titolo, categoria, dettaglio, e la casella «blocca».

**Dall'API**, se stai lavorando da una sessione e vuoi aggiungere quello che hai appena scoperto:

```
GET    /admin/lavori                 elenco completo (aperte in cima, fatte in fondo)
POST   /admin/lavori                 { titolo, dettaglio?, categoria?, blocca? }
PATCH  /admin/lavori/:id             gli stessi campi, solo quelli che mandi
POST   /admin/lavori/:id/fatto       { fatto: true | false }
DELETE /admin/lavori/:id             solo per le voci scritte per sbaglio
```

⚠️ `PATCH` aggiorna **solo i campi presenti**: mandare `{"dettaglio": ""}` svuota il dettaglio,
non mandarlo lo lascia com'è. `undefined` e stringa vuota sono cose diverse.

**Il primo caricamento** (già fatto) è `npm run carica:lavori` — prova a vuoto, scrive solo con
`CONFERMA=1`. Aggiunge le voci aperte dai documenti più le 481 voci storiche del REGISTRO, prese da
`backend/prisma/lavori-storico.json`.

⚠️ **Rilanciarlo non aggiorna niente**: salta tutto ciò che trova per `chiave`, e lo dice. È voluto —
una voce può essere stata spuntata o riscritta a mano, e uno script che «riallinea» la riporterebbe
indietro in silenzio. Per aggiungere voci nuove allo script servono chiavi nuove.

## Le tre regole che tengono viva la pagina

1. **Chiudere un lavoro è spuntarlo, non cancellarlo.** Se il modo di togliere una riga fosse
   `Elimina`, fra un mese la pagina non saprebbe più dire cosa è stato fatto — cioè metà del motivo
   per cui esiste. `Elimina` serve solo a chi ha scritto una voce per sbaglio.
2. **Togliendo la spunta si azzerano chi e quando.** Non è un dettaglio tecnico: una voce riaperta
   che dice ancora «fatta da Simone il 13/8» fa perdere fiducia in tutta la lista.
3. **A fine consegna si aggiorna qui, come nel REGISTRO.** Spunta quello che hai chiuso, aggiungi
   quello che hai scoperto e non hai fatto. Una voce trovata e non scritta è una voce persa: fra due
   settimane nessuno si ricorda che quel caso esisteva.
