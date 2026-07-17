# Input per Simone — Prezzi: si va con l'Opzione B (decisione 17/07)

Riferimenti: `progetto/Handoff_Simone_Prezzi_Prova.md` · `progetto/Handoff_Simone_Prezzi_Prova_Addendum.md` · tuo `Metabole_Rapporto_Stato_Progetto.md`.

## La decisione
Rispetto a come è impostato ora (barrato promo mostrato a tutti), il socio ha scelto l'**Opzione B**:

> **Il negozio mostra i prezzi PIENI. Lo sconto founding arriva SOLO via codice personale, inviato al giorno 6 della prova.**

Niente prezzo scontato di default, niente barrato per tutti. Il barrato lo vede solo chi ha il codice, al checkout.

Il tuo lavoro sui campi `listPriceCents`/`promoEndsAt` **non si butta**: resta pronto se un domani vorremo il "barrato per tutti". Per ora quei campi restano **vuoti**.

## Cosa cambia in concreto

### 1. Prezzi a DB (Gestione Negozio) — a prezzo PIENO, senza promo
| Piano | period | priceCents | listPriceCents | promoEndsAt |
|---|---|---:|---|---|
| 1 mese | `1m` | 13000 (€130) | — vuoto | — vuoto |
| 3 mesi (una tantum) | `3m` | 29900 (€299) | — vuoto | — vuoto |
| Mantenimento (ricorrente) | `maintenance` | 2900 (€29) | — vuoto | — vuoto |
| Prova gratuita | `8d` | 0 | — | — |

- **Disattivare** i vecchi 6m/12m (297/497/797) → `active = false` (non cancellare, c'è il vincolo FK).
- **Provvigioni** impostate sui piani nuovi (`commission*Cents`), altrimenti le vendite di lancio danno commissione zero.
- Prova = piano a `priceCents 0`, `8d`, non riacquistabile (come già previsto).

➡️ Rispetto al tuo rapporto §3.1.1, l'unica differenza è: **NON** mettere i prezzi in promo barrata (niente 299→249 a DB). Prezzo pieno e basta.

### 2. Lo sconto founding = punto 5 (codici) — diventa prioritario
È il codice a fare lo sconto, non il prezzo di listino. Target esatti:
- 1 mese: €130 → **€99**
- 3 mesi: €299 → **€249**

Vincolo noto: un **singolo** codice non copre entrambi i target (importi/percentuali diversi, e i codici si applicano sull'importo). Serve **gestione per-piano** — es. due codici fissi (−€31 e −€50) o il meccanismo che preferisci. **Come impostarli (personali per cliente vs condivisi, fissi vs %) è a tua discrezione**, purché valga:
- scadenza **48h** reale (`expiresAt`), **1 uso/cliente** (`maxPerClient`);
- sconto calcolato sul **prezzo pieno** del piano;
- invio al **giorno 6** via email + comparsa nel task tutor; evento `trial_day6_offer_sent`.

### 3. Report di fine piano (punto 4, già fatto) — offerta col codice, non barrato promo
Nel report l'offerta deve leggere **prezzo pieno €299 + codice personale → €249** (il campo `code` è già predisposto), non un barrato promo generico. Allego un nuovo layout di riferimento del report (`marketing/report_cliente/MetaboleAI_Report_Cliente_8giorni.html`): stesso impianto tuo, con "Cosa ha imparato Gaia su di te" al centro, il pannello onesto della cancellazione profilo a +7 giorni, e l'offerta col codice.

## In una riga
Prezzi pieni a DB (niente barrato di default) + priorità al punto 5 (codici al giorno 6 che portano a 99/249) + report che mostra pieno + codice. Il resto del tuo lavoro (1–4) resta com'è.
