# Prezzi finali + provvigioni (inseriti a DB) — 17/07/2026

Sostituisce le tabelle prezzi nei documenti precedenti (`Handoff_Simone_Prezzi_Prova_Addendum.md`, `Input_Simone_Prezzi_OpzioneB.md`). Strategia confermata: **prezzo pieno mostrato, sconto founding via codice** (Opzione B).

## 1. Prezzi (già a DB)

| Piano | Periodo | Listino | Scontato (founding, via codice) |
|---|---|---:|---:|
| 1 mese | `1m` | €130 | €99 |
| 3 mesi | `3m` | €349 | €269 |
| 6 mesi | `6m` | €599 | €499 |
| Mantenimento | `maintenance` | €29/mese | €29 (nessuno sconto) |
| Visita nutrizionista | prodotto | €50 | €35 |

- **Mantenimento:** €29/mese **rinnovabile** (mensile ricorrente). Chiuso il dubbio "a vita vs finché attiva".
- **Codici sconto** (target per piano, già supportati dal sistema): i target da impostare sono **1m €99 · 3m €269 · 6m €499 · visita €35**. Il mantenimento non ha codice.
- **Codice G6 automatico: SPENTO.** Per il pilota da 100 le coach danno i codici a mano; l'automazione si accende quando i volumi crescono (è un interruttore).

## 2. Provvigioni — ⚠️ da allineare con Simone

Antonio: **45% alle coach, 15% ai nutrizionisti**.
Nel sistema (schema `Plan`) le provvigioni sono **importi fissi in centesimi per piano**, riscalati sull'importo effettivamente pagato in caso di sconto — **non percentuali native**.

**Domanda secca per Simone:** si passa a una logica **a percentuale** (45%/15% del pagato), oppure si inseriscono per ogni piano gli **importi fissi = 45%/15%** e si lascia che il sistema li riscali? E la base è il **prezzo scontato effettivamente pagato** (presumo di sì).

Se si va con gli importi fissi, ecco i valori (calcolati sul **prezzo scontato**):

| Piano (scontato) | Coach 45% | Nutrizionista 15% |
|---|---:|---:|
| 1 mese €99 | €44,55 | €14,85 |
| 3 mesi €269 | €121,05 | €40,35 |
| 6 mesi €499 | €224,55 | €74,85 |

**Da confermare anche:** le provvigioni si applicano anche a **mantenimento** (€29/mese → coach €13,05/mese ricorrente?) e **visita** (€35), o solo ai percorsi? Meglio deciderlo esplicitamente.

## 3. Nota sul margine (solo perché tu abbia il numero sott'occhio)
45% + 15% = **60% del prezzo** va a coach + nutrizionista. Su un 3 mesi scontato a €269 sono **~€161** ai due ruoli, €108 lordi residui (prima di ads, piattaforma, ecc.). È una scelta di modello tua — te lo segnalo solo come dato, non come obiezione: allinea l'incentivo delle coach (che sono le chiuditrici), ma pesa sul margine, quindi il **mix di piani** e i **rinnovi/mantenimento** diventano decisivi per la redditività.
