# Registro — Fix testi email live: "colazione" → {{primoPasto}}

**Data:** 29 luglio 2026 · Base: main.

## Problema
La mail di benvenuto (`onb_g1`) e quella del giorno prima (`piano_domani`) dicevano
"parti dalla colazione" / "prepara ciò che ti serve per la colazione". Per le clienti
con percorso **digiuno intermittente** (nessuna colazione) è un consiglio sbagliato.
Avevo già introdotto la variabile `{{primoPasto}}` (= "pranzo" per il digiuno,
"colazione" altrimenti) nel codice e nel seed, **ma il seed aggiorna solo il `name`
dei modelli, non il `bodyHtml`** → i testi LIVE nel DB erano rimasti quelli vecchi.

## Fix — script una-tantum
`backend/prisma/fix-email-primo-pasto.ts` (npm script `fix:email-primopasto`):
- Sostituisce nel **bodyHtml** dei modelli `onb_g1` e `piano_domani` la riga con
  "colazione" con la versione `{{primoPasto}}`.
- **Idempotente**: se il testo è già aggiornato, non fa nulla; se il testo originale
  non c'è (modificato a mano) avvisa e non tocca.
- **Dry-run di default**, scrive solo con `--apply`.

## Come applicarlo (Render Shell del backend)
```
npm run fix:email-primopasto              # DRY-RUN: mostra cosa cambierebbe
npm run fix:email-primopasto -- --apply   # APPLICA le modifiche al DB live
```

## Verifica
- `ts.transpileModule` su `fix-email-primo-pasto.ts`: OK. NUL check: OK.
- `package.json`: JSON valido, nuovo script aggiunto dopo `realign:plan-start`.
- (L'errore `PrismaClient has no exported member` in `tsc --noEmit` è atteso in
  sandbox: il client Prisma non è generato qui — vale per tutti gli script prisma.)

## Impatto / deploy
- **Solo dati (DB).** Nessuna migration, nessun deploy di codice necessario oltre al
  push (che porta lo script sul repo). Il fix diventa effettivo quando lanci lo
  script con `--apply` sulla Shell di Render.
- Da quel momento le nuove email `onb_g1`/`piano_domani` useranno "pranzo" per il
  digiuno e "colazione" per gli altri percorsi.
