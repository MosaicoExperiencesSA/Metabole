# Registro modifiche — Fix: coach/nutrizionista di nuovo instradati allo StaffApp

**Data:** 17 luglio 2026 · Base: origin/main bcb11ee.

## Summary
Un account staff (coach/nutrizionista) che entrava nell'app vedeva il placeholder "Account staff —
usa il backoffice" invece della sua app dedicata. Ripristinato l'instradamento a `StaffApp`.

## Causa (regressione)
Il commit `7eb6e90` ("APK unica smista-ruolo") aveva integrato lo StaffApp in `App.tsx`
(`if (!isClient) return <StaffApp />`). Il mio commit successivo `29ab6b6` (flusso set-password lead)
era stato consegnato basandomi su una versione iCloud più vecchia di `App.tsx` (quella col placeholder,
perché iCloud era indietro): committandolo ha **sovrascritto l'instradamento StaffApp** riportando il
placeholder. `StaffApp.tsx` e tutte le schermate staff erano rimaste in repo, solo scollegate.

## Fix
- `app/src/App.tsx`: ri-aggiunto `import StaffApp from './staff/StaffApp'` e, in `AuthedApp`,
  `if (!isClient) return <StaffApp />` al posto del placeholder. Rimosso `logout` dalla
  destrutturazione (ora inutilizzato). Il gate set-password (mustChangePassword/SetPassword) e
  l'onboarding cliente restano invariati.
- Build app OK: 111 moduli (lo StaffApp e le schermate staff rientrano nel bundle, ~+23 moduli).

## Nota di processo
Regressione causata dalla consegna basata su un `App.tsx` iCloud non aggiornato. Come già concordato,
d'ora in poi `git fetch` + riallineo all'ultimo `origin/main` PRIMA di ogni consegna (fatto qui).

## Per vederlo
Rebuild APK (`~/metabole-build.sh` o il comando unico) e accesso con un account coach/nutrizionista.
