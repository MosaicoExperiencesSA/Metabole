# Registro modifiche — Pallino rosso "attività da fare" per la coach (#7)

**Data:** 22 luglio 2026 · Base: origin/main 90aaacf. (Richiesta #7 del file, Rosaria.)

## Summary
Segnalazione: quando c'è un'attività/reminder nella sezione "Da fare" della dashboard coach, niente
lo indica — se non apri il tab non te ne accorgi. Ora un **pallino rosso** compare sul **tab
Dashboard** della tab bar quando ci sono attività "da fare" pendenti.

## Description
`app/src/staff/ui.tsx` (`StaffShell`, la shell comune alle schermate staff)
- Solo per i **ruoli coach** (`COACH_ROLES`), all'apertura recupera il numero di task "da fare"
  (`GET /staff/coach-tasks?status=todo&limit=50`) e lo tiene in `pendingTasks`. Sui ruoli non-coach
  (nutrizioniste) non fa nulla.
- Nella tab bar, sul tab **Dashboard** (`to === '/'`), se `pendingTasks > 0` mostra un pallino
  (`.sf-tab-dot`). Essendo la shell presente su tutte le schermate coach, l'indicatore si vede
  ovunque, non solo aprendo la dashboard.

`app/src/staff/theme-staff.css`
- Nuova classe `.sf-tab-dot` (pallino rosso in alto a destra dell'icona) + `.sf-tab` reso
  `position: relative` per posizionarlo.

## Note
- Il pallino segue le stesse attività della card "Da fare" (coach-tasks todo). Si aggiorna a ogni
  navigazione (la shell si rimonta). Il badge delle notifiche non-lette lato CLIENTE esisteva già.
- Nessuna migration. Verifica: `tsc --noEmit` app **OK**.
- Base riallineata a GitHub prima dell'intervento (il repo di lavoro cloud si era resettato a una
  copia vecchia; ora combacia con l'origin completo — nessuna regressione su Posta/email/ecc.).
