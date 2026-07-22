# Registro modifiche — Bug grafico Dashboard coach, sezione "Da fare" (#10)

**Data:** 22 luglio 2026 · Base: origin/main cb0b37e. (Richiesta #10 del file, Rosaria/Patrizia.)

## Summary
Nell'app coach, nella dashboard, la card **"Da fare"** aveva un bug grafico: il pulsante **"Fatto"**
occupava tutta la larghezza in cima e il testo dell'attività (nome cliente + scadenza) veniva
schiacciato in una **colonna verticale**, una parola per riga. Ora il pulsante è piccolo a destra
e il testo occupa lo spazio normalmente.

## Description
`app/src/staff/coach/CoachDashboard.tsx`
- Il pulsante "Fatto" usa la classe `.sf-btn` che di base ha **`width: 100%`** (è pensata per i
  pulsanti a tutta larghezza). Dentro la riga `.sf-row` (flex), pur avendo `flex: none`, il
  `width: 100%` lo faceva espandere a tutta la card, riducendo a ~0 la larghezza del testo affianco
  (`.sf-row-main`, `flex:1`), che quindi andava a capo a ogni parola.
- Fix: sul pulsante aggiunto **`width: 'auto'`** (+ `whiteSpace: 'nowrap'`), così sta nella sua
  dimensione naturale a destra e lascia lo spazio al testo.
- Verificato che non ci sono altri pulsanti `.sf-btn` con lo stesso pattern (flex:none senza
  width:auto) nelle schermate staff.

## Note
- Solo CSS inline, nessuna migration. Verifica: `tsc --noEmit` app **OK**.
