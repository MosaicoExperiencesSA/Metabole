# Handoff STORE — nuova build app iOS/Android (modifiche 23/07/2026)

Nota per la **sessione Claude che pubblica l'app sugli store**. Il codice app è già aggiornato
sul Mac (repo Metabole). Questa build serve a portare sui dispositivi le modifiche frontend fatte
oggi.

## Serve davvero una build nativa? SÌ
`app/capacitor.config.ts` ha `webDir: 'dist'` e **nessun `server.url`**; **nessun plugin OTA/live-update**
è installato. Quindi l'app iOS (TestFlight) e Android **impacchettano il web**: le modifiche in
`app/src/**` arrivano SOLO con una nuova build nativa + invio agli store. (La web app/PWA su Vercel
si aggiorna da sola col push; l'app nativa no.)

## ORDINE CORRETTO
1. **Prima il backend (Render).** Molte novità dipendono dall'API aggiornata (gate misure, stato
   menu `expired`, alert coach). Se pubblichi l'app prima del backend, alcune funzioni non
   rispondono come atteso. Il backend non ha migration nuove né env nuovi in questo batch.
2. Poi la build app (sotto).

## Build app (dal Mac, cartella `app/`)
```
cd app
npm ci            # o npm install
npm run build     # genera dist/ (verificato: build OK)
npx cap sync ios android
```
Poi:
- **iOS:** apri `ios/App/App.xcworkspace` in Xcode → incrementa **build number** (CFBundleVersion),
  Archive → distribuisci su TestFlight/App Store.
- **Android:** apri `android/` in Android Studio → incrementa **versionCode** (e versionName se
  vuoi) → genera l'App Bundle firmato col keystore (`~/MetaboleKeys`) → carica su Play Console.

⚠ Allinea i numeri di versione allo stato attuale degli store (l'ultimo inviato Play era
versionCode 2; era in preparazione versionCode 3 per i fix di Antonio — vedi memoria
`metabole-prossima-pubblicazione.md`). Questa build deve stare **sopra** l'ultima inviata.

## ⚠ RISCHIO REVIEW (Apple/Google): popup misure BLOCCANTE
Da oggi, **senza misure iniziali il menu non viene erogato e l'app mostra un popup misure
bloccante** (per QUALSIASI piano attivo, non solo la prova). Il recensore, con l'account demo,
potrebbe restare bloccato su quel popup se non inserisce le misure.
- Verifica che l'**account di review** possa superarlo: il popup consente di inserire peso (e vita/
  fianchi opzionali) e prosegue al salvataggio. Testalo prima dell'invio.
- Se serve, nelle note al recensore spiega: "Per vedere il menu inserire le misure iniziali nel
  popup che appare al primo accesso (peso obbligatorio)."
- Ricorda anche il reject iOS precedente (menu demo 2.1a, business model 2.1b, data inizio piano):
  vedi memoria `metabole-ios.md` e `Apple_Risposta_Revisione.md`.

## Cosa cambia nell'app (visibile all'utente) — modifiche 23/07
- **Menu solo con abbonamento attivo:** a prova/piano scaduto niente "menu di oggi"/"menu futuri"
  su Home e "Il tuo percorso"; banner "Nessun piano attivo"; lo **storico** resta leggibile.
- **Misure obbligatorie:** senza misure il menu è trattenuto e il popup misure blocca l'app (primo
  menu e ogni ciclo).
- **Tasto "Ricetta" in Home:** apre la scheda ricetta (prima portava al menu).
- **Popup valutazione menu:** il pulsante "Seguita" ora si evidenzia correttamente.
- **Email in-app** nella lista clienti/lead (coach): apre la Posta interna, non il chooser del SO.
- **Report:** sotto il prezzo, invito "chiedi alla coach per sconti esclusivi".
- (Da un lavoro poco precedente, se non già nella build pubblicata) **deep-link notifiche**,
  **pallino attività coach**, fix **sostituzione ingrediente** in Home.

## File app/src cambiati (da includere nella build)
- `app/src/pages/Home.tsx`
- `app/src/pages/Menu.tsx`
- `app/src/pages/Percorso.tsx`
- `app/src/pages/Report.tsx`
- `app/src/components/MenuReviewPopup.tsx`
- `app/src/components/MenuStatusBanner.tsx`
- `app/src/components/AppHeader.tsx`
- `app/src/staff/shared/ContactActions.tsx`
- `app/src/staff/coach/CoachClienti.tsx`
- `app/src/staff/ui.tsx`, `app/src/staff/theme-staff.css`

## Web app (non store) — la gestisco io
La web app/PWA è codice già committato e la build di produzione è verificata (OK). Va live su
Vercel **al push su `main`** (deploy automatico): non richiede intervento sugli store.
