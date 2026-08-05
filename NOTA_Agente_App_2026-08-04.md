# Nota per l'agente APP — Metabole (04/08/2026)

Aggiornamento per chi gestisce **build, Capgo OTA e pubblicazione** dell'app iOS/Android.

**Risposta breve alla domanda "serve una modifica lato app?": no, non c'è codice da scrivere.**
Le tre segnalazioni delle clienti lavorate in questi giorni (sostituzioni, campanella, messaggio
per chi aumenta di peso) sono **già tutte su `main`**, backend e frontend compresi. Quello che
manca è solo **spedire il bundle** all'app installata: senza release OTA, chi ha l'app sul
telefono continua a vedere il comportamento vecchio, comprese due schermate che ora sono
*sbagliate* rispetto a quello che il server fa davvero (§B, "Perché stavolta l'OTA non è
rimandabile").

---

## A) STATO
- **Backend (Render):** al push si applicano **2 migration** in automatico:
  `20260804120000_notification_archived_at` (campo `Notification.archived_at` + indice
  `user_id, archived_at`) e `20260805100000_checkin_skip` (nuova tabella `checkin_skip`, unica su
  `client_id, date`, FK a `user` con cascade). Nessun env nuovo, nessun servizio nuovo.
- **Web app + backoffice (Vercel):** aggiornati al push. Chi usa il browser vede già tutto.
- **App iOS (TestFlight) / Android installata:** ancora sul **bundle JS precedente** → non vede
  le novità di §B finché non parte una release OTA (o una nuova build store).

---

## B) NOVITÀ FRONTEND DA SPEDIRE (OTA)

Cinque file in `app/src/**`, dai commit `9fef2a4`, `ca9f192`, `dc97c2d`, dal commit sulle frasi di
Gaia e da quello sul "Salta per oggi" del check-in. `Home.tsx` compare tre volte: è la schermata
che ha preso più modifiche.

**`app/src/pages/Home.tsx`** — "Sostituisci un ingrediente". Al posto del popup che *dopo* aver
applicato chiedeva "escludere per sempre?", ora la cliente sceglie **prima** per quanto vale:
"Solo per oggi" (default), "Questi giorni", "Non mi piace". Il default è l'opzione meno invasiva.

**`app/src/pages/Profilo.tsx`** — la sezione "Cibi esclusi" invia `scope: 'forever'` invece di
`forever: true`. Nessun cambiamento visibile.

**`app/src/components/AppHeader.tsx`** — campanella: comparsa la ✕ su ogni riga e **"Svuota le
lette"** in testa allo sheet (svuota solo le già lette, mai una non aperta). Il server *archivia*,
non cancella. Aggiunte anche icona e destinazione del nuovo tipo `progress_support` (icona neutra,
tap → `/percorso`).

**`app/src/components/NotificationPrefs.tsx`** — nuovo interruttore **"Messaggi quando il peso
sale"**, per disattivare il tipo `progress_support`.

**`app/src/lib/frasiGaia.ts` (nuovo) + `app/src/pages/Home.tsx`** — la card *GAIA · LA FRASE DI
OGGI* passa da **6 frasi a 360**. Prima la frase era `FRASI[giorno_del_mese % 6]`: stessa per
tutte le clienti, ciclo ripetuto cinque volte al mese, e nei mesi di 31 giorni la stessa frase
due giorni di fila. Ora ogni cliente ha una sua sequenza, deterministica su (utente, giorno),
che tocca tutte e 360 le frasi prima di ripeterne una. Nessuna migration, nessun endpoint: le
frasi stanno **dentro il bundle**, quindi arrivano solo con l'OTA. Il ragionamento e le verifiche
stanno in `REGISTRO_Frasi_Gaia_Home.md`.

> In testa a `frasiGaia.ts` c'è il commento con le regole dei testi (niente promesse di risultati
> o numeri, niente claim medici, niente colpa o "sgarro", niente aggettivi di genere riferiti a
> chi legge, massimo ~80 caratteri per via dell'animazione `TypeText`). Se ne aggiungete altre,
> valgono quelle.

**`app/src/pages/Home.tsx`** — **"Salta per oggi"** sul popup *Come ti senti oggi?*. Prima il tasto
faceva solo `setDismissed(true)`, uno stato locale del componente: siccome Home è una rotta che
React smonta appena si cambia schermata, bastava passare dal Menu e tornare per rivedere il popup.
Diceva "per oggi" e valeva "per adesso" — è la segnalazione di Simone. Ora lo skip è registrato lato
server (`POST /me/checkins/skip`, tabella `checkin_skip`) e `/me/today` restituisce anche
`checkinSkipped`: vale per la giornata **su tutti i dispositivi**. Domani il popup torna, di
proposito; chi non lo vuole più ha l'interruttore "Promemoria del check-in" nelle preferenze, che
resta acceso anche dopo uno skip. Dettagli in `REGISTRO_Salta_Checkin.md`.

> Questo è l'unico punto di §B con una **migration** dietro (§A): il backend va live al push, il
> bundle no.

### Perché stavolta l'OTA non è rimandabile
Le note precedenti dicevano "l'app installata mostra il comportamento vecchio". Qui è diverso:
il vecchio bundle mostra **testi che non corrispondono più a quello che il server fa**.

- La sostituzione dal vecchio bundle scrive `forever: true`. Il backend lo accetta ancora (il
  controller lo traduce in `scope: 'forever'`, compatibilità voluta), quindi **non si rompe
  niente** — ma il pulsante di rifiuto continua a dire "No, solo per questi giorni" e restano
  tre giorni, cioè esattamente la segnalazione della cliente, ancora viva sul telefono.
- Il nuovo messaggio `progress_support` **parte lo stesso** (è lato server) e arriva anche
  all'app vecchia: lì si vede con l'icona campanella generica, senza l'etichetta "Apri ›" e
  senza destinazione al tap. Funziona, ma è la riga meno curata della lista proprio sul
  messaggio più delicato.
- L'interruttore per spegnere quel tipo di messaggi non esiste nel vecchio bundle: chi lo
  volesse disattivare non può, se non dal browser.
- Il tasto **"Salta per oggi"** del check-in dal vecchio bundle non chiama l'endpoint nuovo e non
  legge `checkinSkipped`: niente si rompe (il server è già a posto), ma sul telefono continua a
  chiudere il popup solo finché non si cambia schermata — cioè il difetto segnalato resta lì.

### Come spedire (come per le release precedenti)
```
cd app
npm run build            # verde (verificato: tsc --noEmit pulito)
npm run ...ota...        # scripts/ota-release.mjs → canale letto dall'app
```
In alternativa: nuova build store (`npx cap sync ios android` → Xcode / Android Studio, build
number +1).

> Gli script `capgo` / `scripts/ota-release.mjs` / `install-*.mjs` stanno **solo** sul repo lato
> app: il repo cloud non li ha, quindi la release la fai tu da lì.

---

## C) PUNTI ANCORA APERTI

### C1) Serve ancora la prima release OTA — ora con dentro anche §B
Vale quanto scritto il 30/07: nessuna release OTA è ancora partita, quindi il bundle da spedire
contiene **tutto l'arretrato** (percorso concluso, tasto "Ricetta", report, email in-app,
"Attività fisica" e "Ricette semplici" nel Profilo) **più** le novità di §B. Una sola
release le copre tutte.

### C2) CI "Android APK (debug)" rossa — alzare la SDK per Capgo (invariato)
Ricontrollato oggi: `.github/workflows/android-apk.yml` è **identico**, il fix non è stato
applicato. Errore dello step `./gradlew assembleDebug`:
```
Dependency 'androidx.work:work-runtime:2.10.5' requires ... compile against version 35 or later
:app is currently compiled against android-34
```
Causa: `@capgo/capacitor-updater@6.50.2` porta `androidx.work:work-runtime:2.10.5`, che vuole
**compileSdk 35**; il progetto Capacitor 6 è a 34, AGP 8.2.1, Gradle 8.2.1. `android/` è generato
in CI (gitignored) → il fix va applicato **dopo `cap add android`** (script chiamato in
`android:init` / `android:sync`).

Fix consigliato (durevole): `android/variables.gradle` → `compileSdkVersion = 35`,
`targetSdkVersion = 35`; `android/build.gradle` → `com.android.tools.build:gradle:8.6.0` (o 8.7.x);
`android/gradle/wrapper/gradle-wrapper.properties` → `gradle-8.7-all.zip` (o 8.9).
Alternativa minimale (resta su 34): `force 'androidx.work:work-runtime:2.9.1'` e la variante `-ktx`
in `configurations.all { resolutionStrategy { … } }` dentro `android/app/build.gradle`.
Lo step `android-actions/setup-android@v3` già in workflow va **tenuto**.

### C3) Il tap su una notifica **push** non porta da nessuna parte (non è una regressione)
Il deep-link esiste solo per la campanella in-app (`TYPE_ROUTE` in `AppHeader.tsx`). `push.ts`
registra il token e basta: non c'è nessun listener `pushNotificationActionPerformed`, quindi il
tap sulla notifica di sistema apre l'app sulla schermata iniziale. È noto e documentato dal 22/07
(`REGISTRO_Notifiche_Deep_Link.md`), rimandato perché navigare da `push.ts` — che sta fuori dal
Router — richiede plumbing dedicato. Oggi non fa danno: le push sono ancora **spente** finché non
c'è `google-services.json` (`__ENABLE_PUSH__` in `vite.config.ts`) e `FIREBASE_SERVICE_ACCOUNT`
lato server. **Quando accendete le push, questo diventa da fare**: la mappa tipo → schermata da
riusare è la stessa di `AppHeader.tsx`, e va estratta in un modulo condiviso invece di
duplicarla — oggi `progress_support` andrebbe aggiunto in un posto solo, domani in due.

---

## D) COSA NON È VOSTRO (già chiuso lato logica)
Portata della sostituzione, archiviazione delle notifiche, condizione dei complimenti e nuovo
messaggio per chi aumenta di peso: backend + web sono su `main` e vanno live al push. Questa nota
riguarda solo (1) spedire il frontend aggiornato all'app installata e (2) far passare la build
APK. Il dettaglio del ragionamento sta in `REGISTRO_Feedback_Clienti.md`.

**Una cosa da non toccare senza chiedere.** I testi del messaggio `progress_support` (catalogo
i18n, lato backend) sono stati approvati parola per parola: motivazionali, **mai** un complimento.
Non passano nemmeno dal riformulatore AI, e un test li controlla. Se dall'app servisse cambiarne
il tono o il taglio, va deciso con la committente, non in fase di build.
