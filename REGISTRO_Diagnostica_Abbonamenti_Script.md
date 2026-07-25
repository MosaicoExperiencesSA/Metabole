# Registro modifiche — Script diagnostico abbonamenti (sola lettura)

**Data:** 23 luglio 2026 · Base: main.

## Summary
Script **in sola lettura** per capire casi come "prova attiva un mese": dato l'email, elenca tutte
le subscription dell'account (piano, prezzo, `period`, stato, `startDate`→`endDate`, durata reale in
giorni, data creazione) e i pagamenti collegati. Senza email, stampa un riepilogo di **tutte le
prove** (piani €0) evidenziando quelle con durata anomala (> 10 giorni). **Non scrive mai nulla.**

## Description
`backend/prisma/diagnostica-abbonamenti.ts` (nuovo) + npm script `diag:subs`.
- `npm run diag:subs -- email@x.com` → dump completo di quell'account.
- `npm run diag:subs` → tutte le prove (€0) con flag "DURATA ANOMALA" se end−start > 10 giorni.
- Segnala per ogni subscription i casi sospetti: piano €0 con `period` non valido, oppure prova con
  durata mensile/settimanale/annuale.

## Come si lancia (Shell di Render sul backend, dove c'è DATABASE_URL)
```
npm run diag:subs -- Sim1one.salogni@gmail.com
```

## Verifica
- Transpile OK (0 diagnostics), NUL check OK, package.json valido.
- Sola lettura: nessuna `update`/`create`/`delete`. Nessuna migration.

## Prossimo passo (se emergono endDate sbagliate)
Se il dump mostra prove con durata > 8 giorni, si fa un secondo script mirato (con dry-run + apply)
per riportare `endDate` a `startDate + 8 giorni`, sullo stile di `bonifica:crm`.
