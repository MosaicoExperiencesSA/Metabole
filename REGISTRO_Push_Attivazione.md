# Registro modifiche — Attivazione notifiche push (client Android)

**Data:** 16 luglio 2026
**Ambito:** app cliente (Capacitor/Android) — il backend (invio FCM + trigger) era già pronto.

## Summary
Attivazione delle notifiche push lato app: si accendono **da sole** quando il file
`google-services.json` di Firebase è presente nella cartella `app/`, senza flag da ricordare
e senza rischio di crash se il file manca.

## Description
Il backend inviava già le push (Firebase su Render, `FIREBASE_SERVICE_ACCOUNT`) con i trigger
per check-in, misure, visite, eventi, ecc., e il modello `PushToken` con `POST /me/push-tokens`.
Mancava solo il cablaggio lato app Android. Modifiche:

- **`app/vite.config.ts`** — nuova costante di build `__ENABLE_PUSH__`: vale `true` solo se
  `app/google-services.json` esiste al momento del build. Così l'app registra le push **solo**
  quando Firebase è configurato (senza file, il codice push viene addirittura rimosso dal bundle
  → zero rischio di crash nativo).
- **`app/src/vite-env.d.ts`** — dichiarazione TypeScript di `__ENABLE_PUSH__`.
- **`app/src/lib/push.ts`** — la guardia ora usa `__ENABLE_PUSH__` invece della vecchia env
  `VITE_ENABLE_PUSH` (che andava impostata a mano).
- **`scripts/install-push.mjs`** (nuovo) — al build Android: copia `google-services.json` in
  `android/app/`, assicura il wiring gradle (classpath + apply plugin, idempotente) e aggiunge il
  permesso `POST_NOTIFICATIONS` (necessario su Android 13+). Se il file non c'è, esce senza errori
  (build ok, push spente).
- **`app/package.json`** — `android:sync` ora chiama anche `android:push`.
- **`app/.gitignore`** — `google-services.json` ignorato: vive solo in iCloud, sopravvive ai
  `git pull` e non finisce nel repo.

## Cosa deve fare Simone
1. Scaricare da Firebase il `google-services.json` dell'app Android `app.metabole.client`.
2. Metterlo in `Metabole/app/google-services.json` (in iCloud). **Una sola volta.**
3. Verificare che su Render la variabile `FIREBASE_SERVICE_ACCOUNT` sia impostata (già fatto).
4. Ricompilare l'APK con il solito comando e installarlo: al primo avvio l'app chiede il permesso
   notifiche; poi le push arrivano anche ad app chiusa.

## Note aperte
- iOS: servirà la chiave APNs (Apple Developer) caricata in Firebase → Cloud Messaging. Non serve
  per l'APK Android.
- Test finale su telefono: inviare una notifica reale (es. promemoria check-in) e verificare che
  arrivi ad app chiusa.
