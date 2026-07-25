# Registro modifiche — Header fisso, elenco report, deep-link notifiche

**Data:** 25 luglio 2026 · Base: origin/main HEAD (clonata e verificata). App (Capacitor/React).
Type-check e build di produzione eseguiti in sandbox: OK.

## Summary
App: header fisso in alto, elenco report in Home/Obiettivi, notifiche report cliccabili

## Description
Tre richieste (feedback "Antonio"), pronte per la PROSSIMA pubblicazione (versionCode 3):

1. **Header verde fisso (sticky)** — `app/src/theme.css`: `.app-header` ora è
   `position: sticky; top: 0; z-index: 20`. La barra teal (nome, campanella, alert, shop,
   profilo) resta ancorata in alto mentre il resto della pagina scorre. Nessuna modifica alle
   pagine: l'header è già figlio del contenitore scrollabile `.screen`.

2. **Elenco report** — nuovo componente `app/src/components/ReportsSection.tsx` (usa il già
   esistente `GET /me/reports`):
   - `variant="card"` in **Home/dashboard** (`Home.tsx`): appena esiste un report (es. quello
     dei primi giorni di prova) compare una card viola in evidenza "Il tuo report è pronto" che
     apre il report.
   - `variant="list"` nella pagina **Obiettivi** (`Obiettivo.tsx`): l'elenco completo dei report
     (settimana di prova / diario del mese / fine percorso), ognuno apre `/report/:id`.
   - Se non ci sono report non mostra nulla.

3. **Deep-link notifiche** — `app/src/components/AppHeader.tsx`: la notifica del report
   (`type: 'plan_report'`) non era mappata e non portava a nulla. Aggiunta a `TYPE_ICON` e
   `TYPE_ROUTE`; `openNotif` ora, per `plan_report`, apre direttamente `/report/:reportId`
   (l'id è già nel payload della notifica lato backend). Aggiunte anche le rotte per
   `payment_approved`/`payment_rejected` → `/profilo` (storico acquisti), così anche gli avvisi
   di pagamento sono cliccabili.

## File toccati
- app/src/theme.css (sticky header)
- app/src/components/ReportsSection.tsx (NUOVO)
- app/src/pages/Home.tsx (import + <ReportsSection variant="card" />)
- app/src/pages/Obiettivo.tsx (import + <ReportsSection variant="list" />)
- app/src/components/AppHeader.tsx (deep-link plan_report + payment_*)
- app/android-version.json (versionCode 2 → 3 per la prossima pubblicazione)

## Note
- versionCode portato a **3**: la prossima build Android (AAB) e la prossima build iOS
  useranno automaticamente questo numero (Apple richiede build number crescente; era 2).
- Da collaudare sul telefono dopo il build: (a) scorrere una pagina lunga e verificare che
  l'header resti fisso; (b) con un account che ha un report, vederlo in Home e in Obiettivi;
  (c) toccare la notifica del report e verificare che apra il report.
- Enforcement/logica invariati lato backend (endpoint report e notifiche già esistenti).
