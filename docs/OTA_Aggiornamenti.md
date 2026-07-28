# Aggiornamenti OTA (Over-The-Air) — Metabole

Con l'OTA l'app **nativa** (iOS/Android) può ricevere aggiornamenti del **web** (la cartella
`dist/`: React, UI, logica JS) **senza ripassare dagli store**. Utile per fix e ritocchi.

## Cosa copre e cosa NO
- ✅ Copre: modifiche a `app/src/**` (schermate, testi, logica web).
- ❌ Non copre: modifiche **native** — nuovi plugin, permessi, icona, push, versione nativa.
  Quelle richiedono sempre una nuova build sullo store.
- Regole store: consentito da Apple (linee guida 2.5.2/3.3.2) e Google finché non cambia
  lo scopo o le funzioni principali dell'app rispetto a quanto revisionato.

## Come è fatto (self-hosted, nessun server Capgo)
- Plugin: `@capgo/capacitor-updater` in **modalità manuale** (`autoUpdate: false` in
  `capacitor.config.ts`). Il controllo versione lo fa `app/src/lib/ota.ts`.
- All'avvio (solo su nativo) l'app legge il manifest dal **nostro backend** (Render):
  **`<API_URL>/api/v1/app-updates/latest.json`** → `{ version, url }`.
- Se `version` è nuova, scarica lo zip da `url` e lo attiva al **prossimo avvio**
  (non interrompe l'uso). Su web è no-op (la web app si aggiorna col deploy Vercel).

> ⚠ **Perché sul backend e non su metabole.eu:** il server SiteGround blocca (403)
> l'intera cartella `/app-updates/` e non è sovrascrivibile da File Manager (né con un
> `.htaccess` di cartella). Il backend è sotto nostro pieno controllo, senza WAF.
> L'endpoint è servito dal controller `backend/src/app-updates/`.

## Prima configurazione (una volta)
**Niente da fare a mano.** Il backend serve già il manifest all'endpoint pubblico
`<API_URL>/api/v1/app-updates/latest.json`. Se le env OTA non sono impostate (default),
risponde `{ "version": null, "url": null }` → OTA spento, le app non scaricano nulla.
(La vecchia cartella `app-updates/latest.json` nel repo è solo un riferimento storico:
non va più caricata su metabole.eu.)

## Spingere un aggiornamento OTA (tra due release store)
1. Dal Mac, nella copia di build:
   ```
   node scripts/ota-release.mjs 3.1      # <-- versione NUOVA e crescente
   ```
   Lo script fa la build e crea `ota-out/metabole-3.1.zip`.
2. Carica **`metabole-3.1.zip`** su un URL pubblico raggiungibile (es. un file host, o
   un percorso NON bloccato — la cartella `/app-updates/` di metabole.eu è bloccata,
   ma altri percorsi/host vanno bene; in alternativa un servizio di storage).
3. Su **Render → Environment** del servizio backend, imposta due variabili:
   ```
   OTA_VERSION     = 3.1
   OTA_BUNDLE_URL  = <URL pubblico dello zip>
   ```
   Salva → il servizio riavvia → l'app leggerà version+url e applicherà il bundle al
   riavvio successivo. Nessun deploy di codice necessario.

## ⚠ Dopo ogni pubblicazione sullo store
Quando esce una nuova versione **nativa** (nuovo versionCode/build), rimetti l'OTA "spento":
su **Render → Environment** rimuovi (o svuota) `OTA_VERSION` e `OTA_BUNDLE_URL`.
Così le installazioni fresche partono col bundle nativo e non riscaricano un vecchio OTA.
(Capgo invalida comunque da solo i vecchi bundle OTA quando cambia la versione nativa.)

## Numerazione
- `versionCode`/build number nativi: in `app/android-version.json` (crescono a ogni release store).
- versione OTA (`OTA_VERSION`): una stringa nostra crescente (es. 3.1, 3.2 …) tra una release e l'altra.
  Non deve coincidere col versionCode; serve solo a distinguere i bundle web.
