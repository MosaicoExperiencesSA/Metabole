# Registro modifiche — Fix falso "piano scaduto" (abbonamento attivo con endDate incoerente)

**Data:** 23 luglio 2026 · Base: main.

## Problema
Un'utente (`patty_moren51@yahoo.it`) con **inizio piano = oggi** vedeva "**Nessun piano attivo /
piano scaduto**". Impossibile logicamente. Regressione introdotta col fix "Nessun piano attivo".

## Causa
Nel controllo dello stato menu avevo aggiunto una condizione **più severa** dell'erogazione:
`hasActivePlan = status === 'active' AND endDate >= oggi`. Ma `deliverIfEligible` eroga il menu
solo in base allo **stato** (`status: 'active'`). Quindi un abbonamento **attivo** con `endDate`
stantia o errata (o col cron di scadenza non ancora girato) veniva considerato "scaduto" da
`menuStatus` (falso positivo), pur essendo attivo ed erogabile.

## Fix
- `backend/src/menu/menu.service.ts` (`menuStatus`): `hasActivePlan` ora si basa **solo sullo stato**
  (`status === 'active'`), come l'erogazione. Niente ricontrollo di `endDate`. Lo stato `expired`
  scatta solo se non c'è alcun abbonamento attivo **né** in attesa, e non si è in pausa.
- `backend/src/clients/clients.service.ts`: stessa correzione al flag `hasActivePlan` (chip
  "Nessun piano attivo" nella scheda backoffice).

La scadenza "vera" resta governata dal **cron** che porta lo stato ad `expired` a fine periodo:
in quel momento (e solo allora) il menu sparisce e compare "Nessun piano attivo".

## Verifica
- Transpile `menu.service` e `clients.service`: OK, NUL check OK. Nessun `today` orfano.

## Impatto / deploy
- **Solo backend (Render)**: nessun aggiornamento app/store necessario. Dopo il deploy, chi ha un
  abbonamento attivo (come patty) rivede subito il menu.
- Nessuna migration, nessun env nuovo.
