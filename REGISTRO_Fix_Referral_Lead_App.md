# Registro modifiche — Referral da app: la coach ora trova la lead assegnata (#9)

**Data:** 22 luglio 2026 · Base: origin/main b57827a. (Richiesta #9 del file, Rosaria.)

## Summary
Segnalazione: iscrivendosi "ex novo" con un codice referral sull'utenza coach, la coach **riceve
la notifica** ("ha usato il tuo codice") ma **non trova la lead assegnata** nell'app (da web ok).
Causa: l'assegnazione lato server è corretta — è la **lista "Le tue clienti" dell'app** che
nascondeva i lead di default. Ora i **lead assegnati sono visibili di default**.

## Description
`app/src/staff/coach/CoachClienti.tsx`
- Il flag "Mostra anche i lead" ora parte **acceso** (`showLeads` default `true`). Chi si iscrive
  col codice referral è un **lead** (ha registrato l'account ma non è ancora cliente pagante e, se
  non ha fatto l'onboarding, non ha nemmeno un profilo): prima compariva solo spuntando il flag,
  che Rosaria non sapeva di dover attivare. La coach può ancora togliere la spunta per vedere solo
  le clienti attive.

## Perché NON era un bug di assegnazione (verificato)
- In registrazione l'ordine è corretto: `ensureLead` crea il CrmRecord col `clientId`, poi
  `autoAssignByRefCode` imposta `assignedCoachId` (accepted) sul CrmRecord. La notifica allo staff
  parte nello stesso blocco → coerente con "ricevo la notifica".
- L'app coach costruisce la lista "clienti" dai **clientProfile** assegnati; i **lead** (CrmRecord)
  sono aggiunti solo con `?leads=1`. Il referral appena registrato ha CrmRecord ma (pre-onboarding)
  nessun profilo → finiva solo tra i lead nascosti. Da web (backoffice Gestione Lead) i lead si
  vedono sempre → "da web non ci sono problemi".
- Dopo l'onboarding il profilo eredita `assignedCoachId` dal CrmRecord (onboarding.service:124-158),
  quindi la persona compare regolarmente tra le clienti anche a flag spento. Nessuna correzione
  aggiuntiva necessaria lì.

## Note
- Nessuna migration. Verifica: `tsc --noEmit` app **OK**.
- I lead assegnati a una coach sono in genere pochi (arrivano da iscrizioni col suo codice o da
  assegnazioni del manager), quindi mostrarli di default non ingombra la lista.
