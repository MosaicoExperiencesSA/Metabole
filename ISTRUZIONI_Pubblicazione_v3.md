# Istruzioni pubblicazione — versione 3 (OTA + tutte le modifiche)

Guida operativa per Simone. Tutto il codice è già salvato in iCloud (`Metabole/`).
Type-check e build di produzione: OK. versionCode già = **3**.

---

## 0) Commit su GitHub Desktop
- **Summary:** `App: aggiornamenti OTA self-hosted (Capgo) + card report in dashboard`
- **Description:**
  ```
  OTA (Over-The-Air) con @capgo/capacitor-updater ^6 in modalità manuale self-hosted:
  capacitor.config.ts (CapacitorUpdater autoUpdate:false), src/lib/ota.ts (solo nativo,
  legge metabole.eu/app-updates/latest.json, scarica e attiva il bundle al prossimo avvio),
  main.tsx (initOta), scripts/ota-release.mjs, app-updates/latest.json (OTA spento),
  docs/OTA_Aggiornamenti.md, package.json+lock. In più: ripristinata la card report in Home
  (ReportsSection variant="card"), persa nel merge precedente. Copre solo il web (non il nativo).
  tsc + build di produzione OK.
  ```
File nel commit: app/capacitor.config.ts, app/src/main.tsx, app/src/pages/Home.tsx,
app/src/lib/ota.ts, app/package.json, app/package-lock.json, scripts/ota-release.mjs,
app-updates/latest.json, docs/OTA_Aggiornamenti.md, REGISTRO_OTA_Capgo.md.
→ **Commit + Push**.

## 1) Backend (Render)
Deploy normale. **Nessuna migration/variabile nuova.** Verifica solo che la migration
`20260722180000_crm_phone2` risulti già applicata. Fallo PRIMA della build app (alcune funzioni
dell'app dipendono dall'API aggiornata).

## 2) Setup OTA su metabole.eu (una volta sola)
Su SiteGround → File Manager → `public_html`:
1. crea la cartella **`app-updates`**;
2. caricaci il file **`latest.json`** (lo trovi in `Metabole/app-updates/latest.json`; contiene
   `version:null` = OTA spento).
Questo basta: l'app leggerà il file e, con version null, non scaricherà nulla finché non spingerai
un aggiornamento. (Se il file non c'è, l'app semplicemente non aggiorna, nessun errore.)

## 3) Build store — versionCode 3 (Android + iOS)
Dal Mac:
- **Android:** `bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Metabole/build-aab.sh"`
  → AAB in `~/MetaboleBuild/app/android/app/build/outputs/bundle/release/` → Play Console, nuova release.
- **iOS:** `bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Metabole/build-ios.sh"`
  → in Xcode: Any iOS Device → Product → Archive → Distribute → Upload. (Ricorda: trascinare
  GoogleService-Info.plist nel gruppo App se il progetto iOS è stato rigenerato.)
`cap sync` (dentro gli script) registra automaticamente il plugin nativo Capgo.

## 4) ⚠️ PRIMA di inviare in revisione — popup misure BLOCCANTE
Da queste modifiche, senza misure iniziali il menu non viene erogato e compare un **popup misure
che blocca l'app** (qualsiasi piano; e al 2° giorno di ogni ciclo). Per non farsi respingere:
- **account di review** con le **misure già inserite** e **data inizio piano = OGGI** (così il
  menu del giorno c'è). Testa il login dall'app prima di inviare.
- **note al recensore**: "Per vedere il menu inserire le misure iniziali nel popup che appare al
  primo accesso (il peso è obbligatorio)."
- Su Apple: allega di nuovo anche la risposta 2.1b (modello di business) se te la richiedono —
  testo pronto in `marketing/store/Apple_Risposta_Revisione.md`.

## 5) DOPO la pubblicazione store
Rimetti l'OTA "spento": su metabole.eu, `latest.json` → `{ "version": null, "url": null }`.
(Così le installazioni fresche partono col bundle nativo e non riscaricano un vecchio OTA.)

---

## Come spingere un aggiornamento OTA in futuro (senza store)
Solo per modifiche **web** (schermate/testi/logica; NON plugin/permessi/icona/push):
```
node scripts/ota-release.mjs 3.1      # versione NUOVA e crescente
```
→ crea `ota-out/metabole-3.1.zip` e stampa il `latest.json`. Poi su metabole.eu/app-updates/:
carica lo zip e sostituisci `latest.json`. Le app lo scaricano e lo attivano al riavvio successivo.
Dettagli in `docs/OTA_Aggiornamenti.md`.

## Nota web app
La web app/PWA su Vercel si aggiorna da sola al push su `main`: non richiede build né store.
L'OTA serve solo per l'app nativa.
