# Handoff pubblicazione — 16/09/2026

Allegati nelle chat con coach e nutrizionista, e la coach che legge la chat della nutrizionista.

## TL;DR deploy

- **Backend (Render):** deploy normale. **Una migrazione nuova** (`20260916100000_allegati_chat`), la
  applica il `preDeployCommand` da solo. Nessuna variabile d'ambiente obbligatoria nuova.
- **Backoffice (Vercel):** build e deploy normali.
- **App web (Vercel):** build e deploy normali.
- **App nativa:** serve un **OTA** (`2.2.6`) perché la graffetta arrivi sui telefoni. Su Android
  funziona subito. Su iPhone resta nascosta fino alla **build nativa 2.3** (vedi sotto).

## Ordine

1. Bundle OTA `2.2.6` costruito **sul Mac** (regola delle push: mai in sandbox) e messo in
   `backend/ota-bundles/`, nello stesso commit del codice.
2. Push → Render (migrazione + codice), Vercel (backoffice + app web).
3. **Solo dopo** che il deploy di Render è verde: Render → Environment → `OTA_VERSION=2.2.6`.
   L'app nuova su un backend vecchio non troverebbe né la rotta dei file né il campo `allegato`.
4. Verificare il manifest: `GET https://metabole-backend.onrender.com/api/v1/app-updates/latest.json`
   deve dire `2.2.6`.

## Migrazione

- `backend/prisma/migrations/20260916100000_allegati_chat/migration.sql` — tabella nuova
  `message_attachment` (FK su `message` con `ON DELETE CASCADE`). Additiva: nessuna colonna
  esistente toccata.

## Variabili d'ambiente (facoltative)

- `CHAT_FILES_SECRET` — segreto dei link degli allegati. Se manca si usa `JWT_ACCESS_SECRET`
  (con una chiave derivata, non nudo).
- `PUBLIC_API_URL` — già usata dalle email. Se c'è, i link degli allegati la usano invece degli
  header della richiesta. **Consigliata.**
- `FILE_ENCRYPTION_KEY` — **esiste già** (documenti sanitari) e serve anche qui. ⚠️ Cambiarla rende
  illeggibili documenti e allegati già salvati.

## iPhone — build nativa 2.3

Il campo file di iOS propone «Scatta foto»: senza `NSCameraUsageDescription` il sistema chiude
l'app. `scripts/install-ios.mjs` ora aggiunge `NSCameraUsageDescription` e
`NSPhotoLibraryUsageDescription` (e si ferma con un errore se non ci riesce).

- La prossima build iOS deve essere la **2.3**: l'app mostra la graffetta su iPhone solo da quella
  versione in su (`IOS_ALLEGATI_DALLA_VERSIONE` in `app/src/lib/allegati.ts`). Se il numero sarà un
  altro, va cambiata quella costante.
- Dopo la release store: **svuotare `OTA_VERSION`** (punto 8 della procedura OTA).

## Da provare sul telefono

- Android: allegare una foto dalla fotocamera e un PDF; aprire il PDF (si apre fuori dall'app).
- Coach: scheda cliente → «Chat nutrizionista» → la conversazione si legge, senza campo per scrivere.
- Backoffice: pagina Chat → graffetta → invio di un PDF; nella scheda cliente la foto si vede nella
  bolla.

## Prove

Backend, backoffice e app verdi in sandbox (build + test). Prove nuove:
`backend/src/chat/allegati-chat.spec.ts`, `backend/src/chat/allegati-chat.service.spec.ts`,
`app/src/lib/allegati.spec.ts`, `backoffice/src/lib/allegati.spec.ts`; riscritte due prove di
`backend/src/chat/chat.service.spec.ts` (la coach ora legge il thread della nutrizionista).
