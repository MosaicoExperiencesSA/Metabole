# Registro modifiche — "Nessun piano attivo": niente menu senza abbonamento attivo

**Data:** 23 luglio 2026 · Base: main.

## Problema
Un account con la **prova scaduta** (nessun abbonamento attivo) vedeva ancora **il menu di oggi**
nella dashboard, invece di "nessun piano attivo". Causa: `getMenu`/`menuStatus` servivano i
menuDay visibili **senza controllare l'abbonamento**; la prova aveva lasciato un giorno erogato
(ciclo a cavallo della scadenza) che restava visibile. In backoffice, inoltre, la scheda mostrava
come "piano corrente" un abbonamento **Annullato** (perché sceglieva il più recente in assoluto).

## Fix — app cliente
`backend/src/menu/menu.service.ts`
- `menuStatus`: nuovo stato **`expired`**. Se l'utente ha avuto un piano ma ora **non c'è alcun
  abbonamento attivo** (entro il periodo) né in attesa, e non è in pausa/viaggio, ritorna `expired`.
  Il controllo precede lo stato `available`, così i menu residui di una prova finita non contano.
- `getMenu`: quando lo stato è `expired`, restituisce `days: []` → l'app non mostra i menu.

`app/src/components/MenuStatusBanner.tsx`
- Nuovo caso `expired`: banner **"Nessun piano attivo"** ("Il tuo piano è terminato… riattiva un
  piano dal Negozio"). La Home già nasconde la card menu e il tile kcal quando non ci sono pasti.

## Fix — backoffice (scheda cliente)
`backend/src/clients/clients.service.ts`
- La scelta dell'abbonamento "principale" ora è: **attivo > in attesa > (paused/altro) > scaduto >
  (in ultimo) annullato**. Così il badge mostra l'abbonamento più significativo (es. "Prova
  Gratuita · Scaduta") e non un annullato.
- Nuovo campo `hasActivePlan` nel dettaglio.

`backoffice/src/pages/ClientDetail.tsx`
- Se `hasActivePlan === false`, accanto al badge del piano compare un chip **"Nessun piano attivo"**.

## Verifica
- Transpile backend (`menu.service`, `clients.service`): OK, NUL check OK.
- `tsc --noEmit` app **e** backoffice: OK.
- Gli spec del menu testano solo `deliverIfEligible`/`measurementGate` (non `getMenu`/`menuStatus`),
  quindi la nuova query `subscription.findMany` in `menuStatus` non li rompe.

## Note
- Nessuna migration. Comportamento coerente: a piano scaduto/annullato il cliente vede "nessun
  piano attivo" ovunque (dashboard e pagina menu), e lo staff lo vede chiaramente in scheda.
- Durante una **pausa/viaggio** l'abbonamento resta attivo, quindi NON viene marcato `expired`.
