# Handoff [Sviluppo] — Contatori sito: base storica Mosaico (`/public/stats`)

**A:** Simone · **Da:** Prodotto · **Scopo:** far partire i contatori del sito dai numeri storici di Mosaico Experiences SA, mantenendo l'incremento live.

## Contesto
Il sito legge i contatori da `GET /api/v1/public/stats` (attributo `data-stats-endpoint`). Oggi l'endpoint restituisce i conteggi reali "da zero" (≈12 clienti, ≈13 lead), quindi il sito mostra numeri piccoli. Vanno **sommati a una base storica**:

- **persone raggiunte (`reached`)** deve partire da **85.218**
- **clienti seguiti (`clients`)** deve partire da **18.979**
- `years` = 20 · `methods` = numero percorsi/metodi attivi (già dinamico)

## Cosa serve
La risposta di `/public/stats` deve diventare:

```
reached = STATS_REACHED_BASE (85218) + n° lead nel CRM
clients = STATS_CLIENTS_BASE (18979) + n° acquisti/abbonamenti attivati
years   = 20
methods = n° metodi/percorsi attivi
```

- I due **offset di base** vanno in **`config_param`** (mai hardcoded), es. chiavi `stats_reached_base = 85218` e `stats_clients_base = 18979`, modificabili dal backoffice.
- L'**incremento resta invariato**: +1 raggiunto per ogni nuovo lead, +1 cliente per ogni acquisto. Semplicemente si parte dall'offset invece che da 0.

### Forma della risposta (già attesa dal sito)
```json
{ "years": 20, "clients": 18979, "reached": 85218, "methods": 4 }
```
Il front-end fa già `clients = s.clients`, `reached = s.reached` e formatta con separatore migliaia + "+". Nessuna modifica lato sito necessaria (i default HTML sono già allineati a 18.979 / 85.218 come fallback).

## Note
- I numeri sono i risultati storici di **Mosaico Experiences SA** (5 anni, più prodotti di nutrizione); la nuova dicitura sul sito lo esplicita.
- Nessun dato personale in `/public/stats`: solo aggregati.
- Verifica: dopo il deploy, `/public/stats` deve restituire `reached ≥ 85218` e `clients ≥ 18979`.

→ **impatto [Sviluppo]:** aggiungere i due offset in `config_param` e sommarli nel calcolo di `/public/stats` (2 righe di logica + 2 parametri). Nessuna migrazione se `config_param` esiste già.
