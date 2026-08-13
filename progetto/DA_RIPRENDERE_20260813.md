# Da riprendere — 13 agosto 2026

Fotografia di metà giornata, scritta per passare a una sessione nuova. Sostituisce
`DA_RIPRENDERE_20260812_sera.md` per quello che è stato fatto oggi; quel documento resta valido per
tutto il resto (deploy, Nocanty, il pezzo grosso della campagna).

⚠️ **L'ultima consegna — la coda «da valutare» — è sul Mac ma NON ancora committata.** È il primo
gesto da fare: committare e pushare con `progetto/COMMIT.txt`.

---

## Fatto oggi

Tutto già su `origin/main` tranne l'ultima riga.

| | Cosa | Stato |
|---|---|---|
| A | `frutta_a_guscio` non escludeva niente + «altro» filtrato lato server | ✅ pushato |
| B | `allergiesOther` (marcatore, non spostamento) | ✅ pushato |
| C | `allergieDichiarateIl` + opzione «Non ho allergie» nel questionario | ✅ pushato |
| D | Allergie visibili in backoffice, app e scheda lead | ✅ pushato |
| §1.3 | `intolerancesOther` — «Altro» aveva l'opzione e nessun campo | ✅ pushato |
| §5 | Permesso `change_allergies` — la nutrizionista le corregge | ✅ pushato |
| §7.1 | `npm run conta:allergie` — la conta prima della campagna | ✅ pushato |
| §8 | Il **via libera clinico** (`idoneita`) + nota obbligatoria | ✅ pushato |
| §8 | La **coda «da valutare»** nell'elenco Clienti | ⚠️ **da committare** |
| — | Il questionario non cancella più allergie e intolleranze | ✅ pushato |

**Suite: 2310 test verdi** (comprese quelle di Vera del collega), `tsc` al baseline sui tre progetti
(restano i 2 errori pre-esistenti in `prisma/approve-diets.ts` e `prisma/dedupe-diets.ts`).

---

## ⚠️ Due guasti che ho causato io oggi, e come si evitano

Vanno letti prima di consegnare qualsiasi cosa.

### 1. Ho cancellato i modelli di Vera dallo schema

Consegnavo file **interi** da una copia del repo che avevo in sandbox. Quella copia era precedente al
lavoro del collega: non aveva `src/vera` né i modelli `FamigliaAlimento`, `AzioneVera`,
`MessaggioVera`. Mandando `schema.prisma` li ho cancellati senza accorgermene, `prisma generate` su
Render ha prodotto un client senza quelle tabelle e la build è morta con 13 errori `tsc` in
`src/vera`.

**Regola:** prima di consegnare un file **condiviso** — `schema.prisma` sopra tutti — si rilegge la
versione attuale dal Mac e ci si applica sopra la modifica. Non si scrive mai la propria copia.
Prima di scrivere, confronto degli md5 fra sandbox e Mac.

### 2. Ho lasciato un archivio da 340 MB dentro il repo

Per riallinearmi ho fatto un `tar` **dentro la cartella del progetto**, e il primo tentativo
includeva `node_modules`. Dalla cartella montata **non posso cancellare file** (`rm` → «Operation not
permitted»), quindi me lo sono lasciato dietro: è finito nel commit e ha bloccato il push per il
limite dei 100 MB di GitHub.

**Regola:** gli archivi si fanno **fuori** dalla cartella del repo (nella home della sessione). Se
qualcosa va comunque lasciato lì, va in `_to_delete/`, che è in `.gitignore`.

---

## 1. Cosa aspetta SIMONE

### Subito
- **Committare e pushare** la coda «da valutare» (l'ultima consegna, già sul Mac).
- **Deploy nell'ordine:** migrazione + backend su Render → backoffice su Vercel → OTA dell'app.
  ⚠️ La OTA non si fa prima che il backend sia in produzione e verificato, e il numero di versione
  **non si riusa mai**: la prossima parte da **2.1.8**.
- **Lanciare `npm run conta:allergie`** sulla shell di Render (è in sola lettura, non scrive niente)
  e guardare i numeri **prima** di decidere qualsiasi campagna. Se la terza popolazione è la
  maggioranza, lo script te lo dice a chiare lettere: quella non è una campagna, è una pagina del
  questionario che non raccoglie.

### Decisioni ancora aperte
- **Quando far partire «serve la visita» in automatico** (allergia dichiarata → richiesta di visita).
  Il **modo di rispondere** ora c'è; la soglia è materia clinica → Nocanty.
- **Se e quando bloccare** il percorso in assenza di via libera. Oggi **non si blocca niente**, ed è
  una scelta scritta: bloccare vorrebbe dire sospendere piani attivi a clienti paganti.

---

## 2. Cosa aspetta NOCANTY

- ⛔ **L'elenco dei solfiti.** Oggi l'esclusione testuale ha solo la parola letterale, dichiarato nel
  codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino, nell'aceto
  balsamico, nella frutta disidratata, in certi salumi. Quell'elenco decide quali piatti si tolgono
  dal piatto di una cliente, e **in eccesso si sbaglia facilmente**.
- ⛔ **La soglia del «serve la visita»** (vedi sopra).
- ⛔ **Il «freno forte»** per le allergie non confermate: `allergieDichiarateIl` c'è e si scrive, ma
  **nessun comportamento parte da lì**.
- ⛔ **La scala dei passi** (6.000 sedentaria → 12.000 molto attiva, +5% ogni due settimane, tetto a
  +40%): per chi ha problemi cardiaci, articolari o è in gravidanza è materia clinica.
- ⛔ **Il peso dell'efficacia nei menu.** Con i pesi di default un piatto a **5★ ora pareggia** un
  piatto efficacissimo bocciato a **1★** (prima vinceva sempre l'efficacia). Per spostare l'ago si
  alza `menu_select_w_eff` dai Parametri: è una manopola, e la gira lei.

---

## 3. Cosa aspetta il prossimo turno di codice

### Il pezzo grosso: la ri-domanda in chat con Gaia (§7 dell'handoff)

⚠️ **Non si comincia senza aver letto l'output di `conta:allergie`.** Se le popolazioni sono piccole
è una campagna; se la terza è la maggioranza è un difetto da correggere prima.

Il modello da copiare **non** è «Conosciamoci» (non è una conversazione), è **`data-inizio-chat`**:
`menu/data-inizio-chat.ts` + `.service.ts`, con `apriDaTesto()` / `avanza()`.

Trappole già mappate e verificate:

- Lo stato vive nel `meta` dell'ultimo messaggio di Gaia (`chat.service.ts`, `flussiAperti`), e
  **se ne può aprire uno solo alla volta**: il nuovo sarebbe la terza chiave, da inserire
  nell'ordine di precedenza.
- ⚠️ **Il flusso scade dopo un'ora.** Se la cliente apre la notifica il giorno dopo, il dialogo **va
  riaperto, non ripreso**.
- ⚠️ **In chat non esistono pulsanti**: bolle di testo puro, input libero. Serve un parser tollerante
  sul modello di `leggiData`, con la regola dei **due tentativi poi passa alla coach**.
- ⚠️ **Le risposte in testo libero non si salvano come arrivano.** «i latticini», «la frutta secca ma
  solo le noci» vanno trasformate in codici **proponendo e facendo confermare** — «ho capito *frutta
  a guscio*, giusto?». Se il termine non si riconosce va in `allergiesOther` e lo codifica la
  nutrizionista: è la regola di `impara-dalla-chat.ts`, *nel dubbio non si impara*.
- Dato sanitario: **transazione e `audit.log`**, non la forma semplice.
- La notifica manda **fatti** nel payload (`counterpart: 'ai'`, `kind: 'allergie_conferma'`), la rotta
  la compone l'app. ⚠️ `title` e `body` **non sono colonne**, vivono dentro `payload`. ⚠️ `datiPush`
  passa **solo stringhe**: un numero o un `null` fa fallire l'invio intero.
- La popolazione la dà `common/da-ricontattare.ts` — **la stessa funzione della conta**, non una
  query nuova.
- Script della campagna: template `prisma/assegna-senza-glutine.ts`. **Dry-run di default**,
  scrittura solo con `CONFERMA=1`. ⚠️ Lezione di `accendi-automazioni.ts`: uno script pensato per
  accenderne tre ne ha **spente venti**, perché lavorava a opt-out.

### Più piccoli, pronti
- **La visita nel calendario della cliente** quando l'esito è `serve_visita`: oggi la decisione si
  registra ma la visita la si prenota a mano.
- **Un filtro** «solo da valutare» nell'elenco Clienti: adesso c'è la pastiglia, non il filtro.

### Da prima di oggi
- **§15.2 punto 1** — «Conferma» che applica la proposta: aspetta il numero di kcal da Nocanty.
- **Mercoledì 19/8** — rimuovere `traccia-diet-family` (il lavoro programmato esiste, il file c'è
  ancora).
- **Schermate app 30** (assaggio menu) e **27-28** (video onboarding): servono decisioni.
- **Aggiornamenti grossi** (React 18, Vite 5, Prisma 6, Capacitor 6) e i thread lunghi del §9.

---

## 4. Regole ferree, per chiunque riprenda

- ⚠️ **Non eseguire comandi git sulle cartelle montate del Mac.** Lascia `.git/index.lock` che git
  non riesce a togliere, e blocca i commit di Simone.
- ⚠️ **Niente archivi dentro la cartella del repo** (vedi il guasto n. 2).
- ⚠️ **Rileggere dal Mac prima di scrivere un file condiviso** (vedi il guasto n. 1).
- ⚠️ **Il testo libero delle allergie resta dentro `allergies`.** `allergiesOther` è un **marcatore**,
  non uno spostamento: sette punti del codice leggono `allergies` per escludere davvero gli
  alimenti. Chi «pulisce» quella ridondanza li disarma tutti in silenzio. Il perché per esteso è in
  testa a `common/allergie.ts`.
- ⚠️ **`'other'` fra le intolleranze si toglie solo se la cliente ha detto cosa.** Senza la risposta
  è l'unica traccia di quello che non sappiamo.
- ⚠️ **Il questionario aggiunge, non cancella** (`common/non-perdere.ts`). Il criterio non è «chi può
  scrivere questo campo», è: *se lo cancelliamo per sbaglio, la cliente se ne accorge e lo rimette?*
- ⚠️ **Sempre**: `progetto/COMMIT.txt`, la voce in `progetto/REGISTRO.md`, e Summary + Description
  nel messaggio finale — a Simone servono per fare la push.
