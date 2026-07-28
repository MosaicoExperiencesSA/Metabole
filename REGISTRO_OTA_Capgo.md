# Registro modifiche — Aggiornamenti OTA (Capgo, self-hosted) + card report in Home

**Data:** 28 luglio 2026 · Base: origin/main HEAD 6016b46 (fresh, con i commit del socio + i fix
Antonio già in main). App Capacitor/React. Type-check + build di produzione: OK.

## Summary
App: aggiornamenti OTA self-hosted (Capgo) + card report in dashboard

## Description
1. **OTA (Over-The-Air) self-hosted** con `@capgo/capacitor-updater@^6` (compatibile Capacitor 6),
   modalità **manuale** — nessun server Capgo, nessun costo, tutto sulla nostra infra:
   - `app/capacitor.config.ts`: plugin `CapacitorUpdater { autoUpdate: false }`.
   - `app/src/lib/ota.ts` (NUOVO): all'avvio, **solo su nativo** (no-op su web), chiama
     `notifyAppReady()`, legge il manifest dal **nostro backend** `<API_URL>/api/v1/app-updates/latest.json`
     (`{version,url}`), e se è una versione nuova scarica lo zip e lo attiva al prossimo avvio con
     `next()` (non interrompe l'uso). Traccia la versione applicata in Preferences per non riscaricare.
   - `backend/src/app-updates/` (NUOVO — controller+module): endpoint pubblico `@Public()`
     `GET /api/v1/app-updates/latest.json`. Legge le env `OTA_VERSION`/`OTA_BUNDLE_URL`; se
     mancano risponde `{version:null,url:null}` (OTA spento). Registrato in `app.module.ts`.
     **Motivo:** SiteGround blocca con 403 l'intera cartella `/app-updates/` su metabole.eu e
     non è aggirabile da File Manager; il backend è sotto nostro controllo, senza WAF.
   - `app/src/main.tsx`: `void initOta()` all'avvio.
   - `scripts/ota-release.mjs` (NUOVO): build + zip di `dist/` in `ota-out/metabole-<ver>.zip`
     e stampa il `latest.json` da caricare su metabole.eu.
   - `app-updates/latest.json` (NUOVO): file iniziale con OTA **spento** (`version:null`),
     da caricare su metabole.eu/app-updates/.
   - `docs/OTA_Aggiornamenti.md` (NUOVO): guida operativa (cosa copre, come spingere un update,
     regola di spegnere l'OTA dopo ogni release store).
   - `app/package.json` + `package-lock.json`: dipendenza Capgo.
   Copre SOLO il web (dist/): NON il nativo (plugin/permessi/icona/push → sempre build store).
   Consentito da Apple (2.5.2/3.3.2) e Google se non cambia scopo/funzioni revisionate.

2. **Card report in Home**: aggiunto `<ReportsSection variant="card" />` in `app/src/pages/Home.tsx`
   (era andata persa quando il socio ha aggiornato Home.tsx nel batch 28/7). Il componente
   `ReportsSection` e la lista in Obiettivi erano già in main. NB: applicato sulla base fresh,
   senza toccare le modifiche del socio in Home (menu nascosto a piano scaduto, tasto Ricetta
   con parametri).

## File toccati
- app/capacitor.config.ts, app/src/main.tsx, app/src/pages/Home.tsx
- app/src/lib/ota.ts (NUOVO — ora legge dal backend), scripts/ota-release.mjs (NUOVO),
  app-updates/latest.json (NUOVO — solo riferimento storico), docs/OTA_Aggiornamenti.md (NUOVO)
- backend/src/app-updates/app-updates.controller.ts (NUOVO), backend/src/app-updates/app-updates.module.ts (NUOVO),
  backend/src/app.module.ts (registrato AppUpdatesModule)
- app/package.json, app/package-lock.json (dipendenza @capgo/capacitor-updater ^6.50.2)

## Setup una-tantum prima che l'OTA funzioni
- **Manifest OTA: NIENTE da caricare a mano.** Lo serve il backend (Render) all'endpoint
  `<API_URL>/api/v1/app-updates/latest.json`. Default = OTA spento (`version:null`). Vedi
  docs/OTA_Aggiornamenti.md. (Su metabole.eu la cartella `/app-updates/` è bloccata 403 → per
  questo il manifest sta sul backend.)
- La build store (versionCode 3) va rigenerata e ripubblicata: `build-aab.sh` (Android) e
  `build-ios.sh` (iOS) — `cap sync` registrerà il plugin nativo Capgo.

## Note
- versionCode resta **3** (già bumpato per i fix Antonio; tutto esce in un'unica release store).
- Da collaudare dopo il build: (a) l'app parte normale (OTA spento → nessun download);
  (b) impostando le env `OTA_VERSION`/`OTA_BUNDLE_URL` su Render con un bundle nuovo, al riavvio
  successivo l'app mostra il nuovo bundle. Regola: env OTA rimosse/vuote dopo ogni release store.
