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
- All'avvio (solo su nativo) l'app legge un file pubblico su metabole.eu:
  **`https://metabole.eu/app-updates/latest.json`** → `{ version, url }`.
- Se `version` è nuova, scarica lo zip da `url` e lo attiva al **prossimo avvio**
  (non interrompe l'uso). Su web è no-op (la web app si aggiorna col deploy Vercel).

## Prima configurazione (una volta)
Su metabole.eu (SiteGround → File Manager → `public_html`):
1. crea la cartella **`app-updates`**;
2. caricaci **`latest.json`** con `{ "version": null, "url": null }` (OTA spento).
Fatto: le app installate leggeranno il file e — con version null — non scaricheranno nulla.
(Se il file non esiste, l'app semplicemente non aggiorna: nessun errore.)

## Spingere un aggiornamento OTA (tra due release store)
Dal Mac, nella copia di build:
```
node scripts/ota-release.mjs 3.1      # <-- versione NUOVA e crescente
```
Lo script fa la build, crea `ota-out/metabole-3.1.zip` e stampa il `latest.json` da usare.
Poi su metabole.eu/app-updates/:
1. carica **`metabole-3.1.zip`**;
2. sostituisci **`latest.json`** col testo stampato (version `3.1` + url del file).
Le app scaricheranno il bundle e lo attiveranno al riavvio successivo.

## ⚠ Dopo ogni pubblicazione sullo store
Quando esce una nuova versione **nativa** (nuovo versionCode/build), rimetti l'OTA "spento":
```
latest.json  →  { "version": null, "url": null }
```
Così le installazioni fresche partono col bundle nativo e non riscaricano un vecchio OTA.
(Capgo invalida comunque da solo i vecchi bundle OTA quando cambia la versione nativa.)

## Numerazione
- `versionCode`/build number nativi: in `app/android-version.json` (crescono a ogni release store).
- versione OTA (`latest.json`): una stringa nostra crescente (es. 3.1, 3.2 …) tra una release e l'altra.
  Non deve coincidere col versionCode; serve solo a distinguere i bundle web.
