# Metabole — Notifiche push sul telefono: guida di setup

Le **notifiche in-app** (campanella) sono già collegate al server. Questo documento serve per il passo
successivo: le **notifiche push**, quelle che arrivano sul telefono anche ad app chiusa.

Per il push serve un servizio esterno: **Firebase Cloud Messaging (FCM)** di Google, gratuito. È il
canale standard per Android (l'APK che generi) e serve anche come ponte per iOS.

La divisione dei compiti è semplice: **tu** crei il progetto Firebase e mi passi due credenziali (senza
metterle mai in chat o nel repo); **io** scrivo tutto il codice (app + server).

---

## 1. Cosa fai tu (console Firebase + credenziali)

Serve un account Google. Tempo stimato: ~15 minuti.

1. Vai su **console.firebase.google.com** → **Crea un progetto** → nome "Metabole" (accetta i default,
   Google Analytics puoi lasciarlo spento).
2. Dentro il progetto, **Aggiungi app** → icona **Android**.
   - **Nome pacchetto Android**: `app.metabole.client` (esatto, è l'ID della nostra app).
   - Registra l'app.
3. Scarica il file **`google-services.json`** che ti propone. Questo file mi serve: mettilo nella
   cartella del progetto su iCloud in `app/android/app/` (te lo indico io dove), oppure passamelo. Non è
   super-segreto ma per pulizia lo teniamo fuori dalle chat.
4. Credenziale per il **server** (per inviare le push): nel progetto Firebase →
   **Impostazioni progetto** (ingranaggio) → scheda **Account di servizio** → **Genera nuova chiave
   privata**. Scarica il file JSON.
   - Questo è **segreto**: NON va nel repo, NON in chat. Va incollato come **variabile d'ambiente su
     Render** (il pannello del nostro backend). Ti dico io il nome della variabile quando colleghiamo il
     codice (probabilmente `FIREBASE_SERVICE_ACCOUNT`).
5. (Solo quando pubblicheremo su **iPhone/iOS**, più avanti) servirà anche una **chiave APNs** dal tuo
   account Apple Developer, da caricare in Firebase → Cloud Messaging. Per ora, con l'APK Android, non
   serve.

Quando hai fatto i punti 1–4, dimmelo e passami il `google-services.json`.

---

## 2. Cosa faccio io (codice, quando ho le credenziali)

### App cliente (Capacitor)
- Installo il plugin ufficiale `@capacitor/push-notifications`.
- Alla prima apertura chiedo il permesso notifiche, registro il telefono e mando il suo **token** al
  nostro server (`POST /me/push-tokens`). Su web (browser) il push non parte: resta solo l'in-app.
- Metto `google-services.json` nella configurazione Android.

### Server (NestJS/Render)
- Nuovo modello `PushToken` (telefono ↔ utente) + endpoint per salvarlo/rimuoverlo.
- Un servizio **FCM** che, **quando creo una notifica** (lo stesso punto che già gestisce in-app ed
  email), invia anche la push ai telefoni dell'utente — **rispettando le preferenze** che abbiamo appena
  messo in Profilo (se un tipo è spento, niente push di quel tipo).
- La credenziale del service account viene letta **solo** dalla variabile d'ambiente su Render.

### Prova finale
- Generi l'APK aggiornato, lo installi su un telefono, e testiamo una notifica reale (es. "menu
  sbloccato") che arriva anche ad app chiusa.

---

## 3. Regole (come per il resto del progetto)
- Le credenziali (service account) stanno **solo** nei pannelli dei servizi (Render), **mai** nel repo né
  in chat.
- `google-services.json` va nel repo dell'app (è previsto così da Google) ma lo teniamo nel repo privato,
  non lo incolliamo nelle chat.

---

## In una riga
Tu crei il progetto Firebase e mi dai `google-services.json` + la chiave service account (su Render); io
collego app e server; poi testiamo su un telefono. Le preferenze notifiche già fatte valgono anche per il
push.
