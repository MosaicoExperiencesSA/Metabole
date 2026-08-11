# Come si fa una OTA — istruzioni operative

Scritto il 9 agosto 2026, dopo tre pubblicazioni andate storte in modi diversi. Ogni regola qui
sotto è la cicatrice di un errore vero: non sono precauzioni teoriche.

**Chi legge questo file:** chiunque — persona o AI — debba pubblicare un aggiornamento OTA di
Metabole. Se sei un'istanza nuova che non ha visto le sessioni precedenti, **questo file è tutto
quello che ti serve**: leggilo per intero prima di lanciare qualsiasi comando.

---

## Cos'è una OTA, e cosa non è

L'app installata sui telefoni (`app/`, React+Vite dentro Capacitor) carica il proprio codice web
da un bundle. Una **OTA** (Capgo self-hosted) sostituisce quel bundle **senza passare dagli
store**: la cliente riapre l'app e ha il codice nuovo, senza aggiornare da App Store o Play.

Cosa **non** può fare una OTA: cambiare codice nativo (plugin Capacitor, permessi, icone,
`AndroidManifest`, entitlements iOS). Per quello serve una release vera sugli store.

Tre numeri che vanno tenuti insieme, ed è qui che si sbaglia:

| Numero | Dove sta | Cosa fa |
|---|---|---|
| `app/package.json` → `version` | repo, sul Mac | è il numero che l'app **mostra** in Profilo (`__APP_VERSION__`, iniettato al build) e la versione della **webapp** |
| nome del file `metabole-<v>.zip` | `backend/ota-bundles/` | il bundle vero e proprio, servito dal backend |
| `OTA_VERSION` su Render | Environment | dice ai telefoni **quale** bundle scaricare |

Se questi tre non coincidono succedono cose che nessuno riesce più a diagnosticare. Lo script li
allinea da solo: non toccarli a mano.

---

## Dove si lancia — la prima cosa che si sbaglia

Lo script si lancia **SUL MAC**, dalla radice del progetto:

```
cd ~/Progetti/Metabole
```

- ❌ **Non dalla home** (`~`): lì `scripts/ota-release.mjs` non esiste.
- ❌ **Non sulla shell di Render**: su Render è deployato solo `backend/`, la cartella `scripts/`
  non c'è e non ci sarà mai. Su Render si fa **una cosa sola**: impostare `OTA_VERSION`.
- ❌ **Non nella sandbox cloud** di Cowork: manca `app/google-services.json` (vedi sotto) e il
  build uscirebbe **senza notifiche push**.

---

## Serve `app/google-services.json`

È **gitignorato**, quindi esiste **solo sul Mac** e su nessun clone. `vite.config.ts` accende le
push (`__ENABLE_PUSH__`) solo se quel file c'è **al momento del build**. Senza, il build riesce
lo stesso ma tutto il codice di registrazione del token viene eliminato dal bundle: chi riceve
quell'aggiornamento **smette di ricevere le push**, in silenzio, per sempre.

Lo script si **rifiuta di costruire** se il file manca (guardia del 6/8). Se vedi
`⛔ Manca app/google-services.json` sei nel posto sbagliato: quasi certamente non sei sul Mac.

---

## La procedura, per intero

```bash
cd ~/Progetti/Metabole

# 1. costruisci il bundle (la versione deve essere NUOVA e crescente)
node scripts/ota-release.mjs 2.1.3

# 2. mettilo dove il backend lo serve
cp ota-out/metabole-2.1.3.zip backend/ota-bundles/

# 3. push da GitHub Desktop
#    ⚠️ nel commit ci vanno DUE cose:
#       - backend/ota-bundles/metabole-2.1.3.zip
#       - app/package.json  (modificato dallo script: "→ allineo app/package.json")

# 4. aspetta che Render finisca il deploy

# 5. su Render → Environment:  OTA_VERSION = 2.1.3  → Salva
```

I telefoni scaricano il bundle da `/api/v1/app-updates/bundles/` e lo applicano **al prossimo
avvio dell'app** (non mentre è aperta). Il manifest lo serve il backend: la cartella
`/app-updates/` su metabole.eu è bloccata 403 da SiteGround, non provare a passare di lì.

### La webapp si allinea da sola

Non c'è niente da fare: la webapp si costruisce dallo stesso `app/package.json` al deploy dopo la
push. Se dopo il deploy la webapp mostra ancora il numero vecchio, non hai committato
`app/package.json`.

---

## La regola che costa più cara: il numero non si riusa MAI

**Capgo confronta la stringa di versione, non il contenuto.** In `ota.ts` un telefono che ha
applicato la versione X si scrive `ota_applied_version = X` e **non riscarica mai più quel
numero**, qualunque cosa ci sia dentro lo zip.

Conseguenza: se ripubblichi un bundle diverso con lo stesso numero, chi ha già preso il
precedente resta bloccato sul vecchio **per sempre**, e non c'è modo di accorgersene. Il 6 agosto
sono usciti tre bundle diversi tutti chiamati «2.0.1».

Quindi:

- se `OTA_VERSION` su Render vale già `X`, **`X` è bruciata**: serve un numero nuovo;
- lo script ha una guardia (esiste già `backend/ota-bundles/metabole-X.zip` → si ferma);
- `OTA_FORCE=1` scavalca la guardia — **usalo solo** se sei certo che quel numero non sia mai
  stato messo in `OTA_VERSION`, cioè che nessun telefono l'abbia scaricato.

---

## Dopo una pubblicazione sugli store

**Svuota `OTA_VERSION` su Render.** Altrimenti un'installazione fresca dallo store scarica subito
un bundle OTA più vecchio del codice nativo appena installato, e la cliente si ritrova
l'aggiornamento che ha appena scaricato annullato.

---

## Come si verifica che il bundle sia davvero quello

Il numero è compilato **dentro** il JS: si può controllare senza installare niente.

```bash
cd ~/Progetti/Metabole
unzip -o -q backend/ota-bundles/metabole-2.1.3.zip -d /tmp/ota-check
grep -o '"2\.1\.3"' /tmp/ota-check/assets/index-*.js | head -3
```

Se non compare, il bundle è stato costruito prima dell'allineamento di `app/package.json`: rifai
lo script con un numero nuovo.

### E poi cerca la FUNZIONE, non solo il numero

Il numero dimostra che il bundle è nuovo. Non dimostra che dentro ci sia la cosa per cui lo stai
pubblicando: un `dist/` vecchio ricostruito ha il numero giusto e il contenuto sbagliato, e passa
tutti gli altri controlli. Quindi prendi una stringa che **esiste solo nel codice nuovo** — il nome
di uno stato, una chiave, un testo — e cercala:

```bash
unzip -p backend/ota-bundles/metabole-2.1.6.zip 'assets/index-*.js' | grep -o 'awaiting_cycle_measure' | head -2
```

Aggiunto l'11/8 sulla 2.1.6, dove la stringa era il nuovo stato del banner della pesata.

---

## Stato all'11 agosto 2026

- `app/package.json` = **2.1.6**
- `backend/ota-bundles/metabole-2.1.6.zip` presente e **verificato**
- `OTA_VERSION` su Render = **2.1.6**, letto dal manifest e non dai registri
- Tutte le versioni fino alla **2.1.6 compresa sono bruciate**: la prossima OTA parte da **2.1.7**

⚠️ Questo paragrafo invecchia a ogni pubblicazione, e un numero vecchio qui fa riusare una versione
già bruciata — l'errore che costa più caro. **Aggiornalo nello stesso commit del bundle**, e in ogni
caso fidati del manifest, non di questa riga.

---

## Sintomi → causa

| Cosa vedi | Cos'è successo |
|---|---|
| l'app mostra un numero più basso di quello pubblicato | `app/package.json` non allineato al build (corretto il 9/8) o non committato |
| pubblichi ma sui telefoni non cambia niente | numero riusato: quei telefoni l'hanno già applicato |
| le push smettono di funzionare dopo un aggiornamento | bundle costruito senza `app/google-services.json` |
| `⛔ Manca app/google-services.json` | non sei sul Mac |
| `Cannot find module '.../scripts/ota-release.mjs'` | sei nella home o su Render, non nella radice del progetto |
| installazione fresca dallo store che «torna indietro» | `OTA_VERSION` non svuotata dopo la release store |
