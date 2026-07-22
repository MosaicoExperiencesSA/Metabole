# Registro modifiche — Notifiche in-app che aprono la funzione collegata (deep-link)

**Data:** 22 luglio 2026 · Base: origin/main 1a079cb. (Richiesta a voce di Simone, 22/07.)

## Summary
Le notifiche in-app (campanella nell'header dell'app cliente) al tap facevano solo "segna letta":
non portavano da nessuna parte. Ora **ogni notifica apre la funzione giusta**. Esempio chiesto da
Simone: "ti è piaciuto il cibo?" (`rating_request`) → apre il **menu con le stelline** per valutare.

## Description
`app/src/components/AppHeader.tsx`
- Aggiunta la mappa **`TYPE_ROUTE`** tipo-notifica → schermata:
  - `rating_request` → `/menu` (valutazione piatti a stelline)
  - `measurement_reminder` → `/obiettivo` (inserimento misure)
  - `checkin_reminder` → `/` (check-in di oggi in Home)
  - `engine_daily` → `/menu`
  - `progress_cheer` → `/percorso`
  - `visit_reminder` / `pre_event` → `/calendario`
  - `mini_plan` → `/percorso`
  - `chat_reply_coach` / `chat_reply_nutritionist` → `/contatti` (chat col team)
- Al tap (`openNotif`): la notifica viene segnata letta **e** si naviga alla schermata mappata
  (chiudendo il foglio). Se il tipo non è mappato, resta il solo "segna letta".
- Piccola etichetta **"Apri ›"** sulle notifiche che portano a una schermata, così si capisce che
  sono toccabili.

## Note
- **Push (dal telefono)**: il deep-link al tap della notifica push non è incluso ora — le push sono
  ancora spente finché non si configura Firebase (`google-services.json` + `FIREBASE_SERVICE_ACCOUNT`)
  e la navigazione da `push.ts` (fuori dal Router) richiede plumbing dedicato. Da aggiungere quando
  si attivano le push. La richiesta ("notifiche in app") è coperta.
- Il **pallino rosso lato coach** (#7 del file richieste) è un lavoro a parte (coach-side) e resta
  in coda. Il badge non lette lato CLIENTE esisteva già sulla campanella.
- Nessuna migration. Verifica: `tsc --noEmit` app **OK**.
