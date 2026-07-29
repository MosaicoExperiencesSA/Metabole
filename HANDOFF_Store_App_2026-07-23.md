# Report per la pubblicazione dell'app (build iOS/Android) — 28/07/2026

Da inoltrare a chi si occupa di pubblicare l'app sugli store. Tutte le modifiche sono su `main`
(GitHub, repo Metabole). Il codice è aggiornato.

---

## 1) Serve una nuova build nativa? SÌ
`app/capacitor.config.ts` ha `webDir: 'dist'` e **nessun `server.url`**; **nessun plugin OTA/
live-update** installato. Quindi iOS (TestFlight) e Android **impacchettano il web**: le modifiche
in `app/src/**` arrivano SOLO con una nuova build nativa + invio agli store.
(La web app/PWA su Vercel si aggiorna col push; l'app nativa no.)

## 2) Ordine corretto
1. **Prima il backend (Render).** Molte novità dipendono dall'API aggiornata. **Nessuna migration
   nuova, nessuna variabile d'ambiente nuova.**
2. Poi la build app.

## 3) Build app (dal Mac, cartella `app/`)
```
cd app
npm ci
npm run build          # genera dist/ (verificato: build OK)
npx cap sync ios android
```
- **iOS:** apri `ios/App/App.xcworkspace` in Xcode → **incrementa il build number** (CFBundleVersion)
  → Archive → TestFlight/App Store.
- **Android:** apri `android/` in Android Studio → **incrementa versionCode** → App Bundle firmato
  col keystore (`~/MetaboleKeys`) → Play Console.

⚠ Allinea i numeri di versione allo stato attuale degli store (l'ultimo Play era versionCode 2; era
in preparazione versionCode 3). Questa build deve stare **sopra** l'ultima inviata.

## 4) ⚠ RISCHIO REVIEW (Apple/Google): popup misure BLOCCANTE
Da questa release, **senza misure iniziali il menu non viene erogato e l'app mostra un popup misure
bloccante** (per QUALSIASI piano attivo, non solo la prova; e al 2° giorno di ogni ciclo).
- Verifica che l'**account di review** possa superarlo: il popup consente di inserire il peso
  (vita/fianchi opzionali) e prosegue al salvataggio. **Testalo prima dell'invio.**
- Suggerimento note al recensore: *"Per vedere il menu, inserire le misure iniziali nel popup che
  appare al primo accesso (il peso è obbligatorio)."*
- Ricorda i motivi del reject iOS precedente (menu demo 2.1a, business model 2.1b, data inizio
  piano): vedi `Apple_Risposta_Revisione.md` / memoria `metabole-ios.md`.

---

## 5) Cosa cambia nell'app (per l'utente) — questa release
- **Menu solo con abbonamento attivo / percorso concluso:** a prova/piano scaduto (o a fine
  periodo) niente "menu di oggi"/"menu futuri" su Home e "Il tuo percorso"; compare "Nessun piano
  attivo". Non compare più un **menu vecchio** spacciato per quello di oggi. Lo **storico menu resta
  leggibile**.
- **Report — tono corretto su un aumento di peso:** se la cliente è ingrassata nel periodo, il
  report non si congratula ma incoraggia ("si può inciampare, l'importante è rialzarsi").
- **Misure obbligatorie:** senza misure il menu è trattenuto e il popup misure **blocca l'app**
  (primo menu e ogni ciclo di 2 giorni).
- **Tasto "Ricetta" (Home):** apre la scheda ricetta (prima portava al menu).
- **Popup valutazione menu:** il pulsante **"Seguita"** ora si evidenzia correttamente.
- **Email in-app** nella lista clienti/lead (lato coach): apre la Posta interna, non il chooser del SO.
- **Report di fine piano:**
  - progressione del piano suggerito: obiettivo non raggiunto → piano **1 o 3 mesi**; obiettivo
    raggiunto → **mantenimento**; **monitoraggio** solo dopo il mantenimento;
  - sotto il prezzo, invito **"chiedi alla coach per sconti esclusivi"**.
- (Da un lavoro poco precedente, se non già nella build pubblicata: **deep-link notifiche**,
  **pallino attività coach**, fix **sostituzione ingrediente** in Home — file `AppHeader.tsx`,
  `staff/*`.)

## 6) File `app/src` cambiati in questa release (da includere nella build)
- `app/src/pages/Home.tsx`
- `app/src/pages/Menu.tsx`
- `app/src/pages/Percorso.tsx`
- `app/src/pages/Report.tsx`
- `app/src/components/MenuReviewPopup.tsx`
- `app/src/components/MenuStatusBanner.tsx`
- `app/src/staff/shared/ContactActions.tsx`
(+ eventuale `app/src/components/AppHeader.tsx` e `app/src/staff/*` se il lavoro precedente non è
ancora pubblicato.)

## 7) Web app (non store)
Codice già committato, build di produzione verificata (OK). Va live su **Vercel al push su `main`**
(deploy automatico): non serve intervento sugli store.

---

### Nota rapida — cosa è "solo backend" (nessuna azione app)
Molte altre modifiche di oggi sono solo lato backend (Render) e **non richiedono la build app**: gate
misure lato server, alert coach, fix "piano scaduto"/riattivazione, esclusioni cibo per categoria,
idoneità monitoraggio, rete di sicurezza durata piani, script `diag:subs` e
`reactivate:future-expired`. Per queste basta il deploy del backend.
