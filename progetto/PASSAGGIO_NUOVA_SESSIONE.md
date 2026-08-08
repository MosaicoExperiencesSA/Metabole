# Passaggio alla sessione nuova — 9 agosto 2026

Da incollare (o far leggere) alla nuova istanza. Contiene: **il messaggio d'apertura**, il
**contesto minimo** per non ripartire da zero, e i **lavori in coda**.

---

## Messaggio da incollare come primo messaggio

> Progetto Metabole. Prima di tutto leggi `progetto/ISTRUZIONI_PER_AI.md`,
> `progetto/PASSAGGIO_NUOVA_SESSIONE.md` e `progetto/REGISTRO.md` (le voci in cima).
> Parlami **sempre in italiano**. Ogni consegna aggiorna `progetto/REGISTRO.md` e finisce con
> **Summary** e **Description** pronti da incollare in GitHub Desktop.
>
> Il lavoro da fare:
>
> 1. Leggi `progetto/PROGETTO_gaia-cambio-menu.md` e implementa il **punto 1** e il **punto 2**:
>    il pulsante «Sostituisci un ingrediente» nell'app porta alla **chat con Gaia** invece che al
>    pop-up oggi/questi giorni/per sempre; la conversazione si salva nel thread `ai` (il modello
>    esiste già: `ChatThread.counterpart = 'ai'`, `Message.senderRole = 'ai'`, **nessuna
>    migrazione**) e si vede nella **scheda cliente in backoffice**, così la nutrizionista
>    verifica; quando in chat si concorda una sostituzione, **il menu della giornata viene
>    corretto** (`MenuDay.meals` è già JSON, la sostituzione ci sta dentro come nota della
>    porzione — la ricetta di catalogo non si tocca mai).
> 2. Aggiungi alla scheda cliente il pulsante **«Invia link per reimpostare la password»**: la
>    coach preme e alla cliente parte la mail di reset. Serve un **endpoint dedicato** limitato
>    alle clienti assegnate a quella coach — **non** i permessi di amministrazione utenti, la
>    coach non deve poter cambiare la password, solo far partire il link.

---

## Contesto minimo (per non rifare domande già fatte)

**Cos'è**: app di nutrizione italiana in produzione, con clienti vere e pagamenti Stripe.
Client React+Vite+Capacitor (con area staff), backend NestJS+Prisma+PostgreSQL su Render,
backoffice React su Vercel.

**Regole permanenti di Simone**
- Si parla **in italiano**.
- Ogni consegna **aggiorna `progetto/REGISTRO.md`** e finisce con **Summary + Description** da
  incollare in GitHub Desktop.

**Come si consegna il codice (device bridge)**
- Il repo autoritativo è **sul Mac**: `/Users/simonesalogni/Progetti/Metabole`, montato in
  sandbox come `~/mnt/Progetti--Metabole`. Il clone in sandbox (`/tmp/metabole-fresh`) serve solo
  a leggere e scrivere in fretta.
- Consegna: `SendUserFile` → `device_commit_files` in
  `~/Progetti/Metabole/backend/node_modules/.consegna/<nome>.tgz` → poi `device_bash`:
  `tar xzf` in una cartella di stage e
  `find . -type f | while read -r f; do cat "$f" > "$HOME/mnt/Progetti--Metabole/${f#./}"; done`.
- ⚠️ **`cat > destinazione` è obbligatorio**: il mount non sa fare `unlink`, quindi `cp` e `mv`
  sul file di destinazione falliscono.
- ⚠️ **Mai `git` sulla cartella montata**: lascia un `.git/index.lock` che poi va tolto a mano.
- ⚠️ `device_bash` ha un **timeout massimo di 45 secondi** e **non può cancellare file**.

**Limiti dell'ambiente**
- In sandbox `backend/node_modules` non c'è: **typecheck e jest si lanciano sul Mac**. Il
  backoffice invece si builda in sandbox.
- Sul Mac `npx prisma generate` **fallisce** (403 sui binari): per le colonne nuove si usa
  `as never` sui `data` e `select` — è un pattern già diffuso nel repo, non un ripiego improvvisato.

**Le OTA**: c'è una guida dedicata, `progetto/guide/COME_SI_FA_UNA_OTA.md`. Leggerla **prima** di
lanciare qualunque cosa. Stato: `app/package.json` = 2.1.2, bundle 2.1.2 pubblicato e verificato,
`OTA_VERSION` su Render = 2.1.2. **2.1.0 e 2.1.1 sono bruciate**: la prossima parte da 2.1.3.

---

## Lavori in coda — elenco completo

Stato verificato sul codice il 9 agosto, non ricopiato dalle liste vecchie: quello che risultava
da fare ed è già chiuso qui **non compare**.

### A. Codice — da fare

1. **Gaia ↔ menu**, punti 1 e 2 di `PROGETTO_gaia-cambio-menu.md` (vedi sopra). A seguire i
   punti 3-5 dello stesso documento: la correzione del nutrizionista che diventa **conoscenza
   riutilizzabile** (unica migrazione prevista), `MenuWeight` per i gusti + segnalazione per i
   motivi clinici, e il conteggio nel report di fine mese come **dato di personalizzazione**.

2. **Reset password dalla scheda coach** (vedi sopra). La coach non deve poter cambiare la
   password: solo far partire il link.

3. **Dalla lista delle coach — restano quattro punti su dodici.**
   - **Scadenze nel calendario della coach.** `coachAgenda()` in `coach/coach.service.ts`
     restituisce **solo gli appuntamenti**. Mancano la fine della prova gratuita e la fine del
     piano. (L'agenda della *cliente*, `clientAgenda()`, la scadenza piano ce l'ha già: da lì si
     copia la logica.)
   - **Compleanno nel calendario della coach.** La mail di auguri esiste
     (`marketing/lifecycle.service.ts`), l'appuntamento in agenda no.
   - **Data di nascita nel questionario.** `onboarding/onboarding.questions.ts` chiede solo
     `age`. Il campo `User.birthDate` esiste e si ricava dal codice fiscale
     (`common/codice-fiscale.util.ts`), ma solo per chi lo inserisce: senza la domanda, il
     compleanno lo abbiamo a metà.
   - **«Nuova cliente assegnata da accettare».** Esiste `lead_assigned` per i lead e
     `client_assigned_nutritionist` per la nutrizionista; **non** esiste per una cliente già
     acquisita riassegnata da una coach a un'altra. Da chiarire con Simone se serve davvero.

4. **Trovato il 9/8, non ancora in nessuna lista: `PlanFlow.tsx` vende sempre una tantum.**
   È lo stesso difetto del punto #4 della revisione — che sul report è stato corretto — ma
   sull'**altra** strada d'acquisto, e quella è la principale: il primo acquisto in onboarding.
   `PlanFlow.tsx` dichiara `interface Plan` **senza `billing`** e chiama `cart.setPlan(...)`
   senza passarlo, quindi nel Checkout la scelta fra abbonamento e pagamento unico non compare
   mai. Correzione: aggiungere `billing` all'interfaccia e inoltrarlo, come già fa `Negozio.tsx`.
   Da verificare prima quali piani `3m/6m/12m` hanno davvero `billing` diverso da `one_time`:
   se sono tutti una tantum il difetto è latente, non attivo.

### B. Verifiche (non è codice, è guardare)

- **#9 della revisione 7/8**: controllare in **Acquisti** se ci sono ordini «Menu di rientro»
  rimasti in sospeso.
- **Le percentuali del piano «Percorso Metabole 3 mesi»**: devono essere **soglie cumulative**
  — 25 / 35 / 45 per coach / coordinatrice / manager e 10 / 15 per nutrizionista / capo
  nutrizionista. Scritte 25 / 10 / 10 il secondo livello calcola `10 − 25 = −15` e incassa solo
  la coach. Se non sono ancora state corrette, correggerle **e poi** rilanciare
  `CONFERMA=1 npm run ricalcola:provvigioni -- 2026-07-01` (aggiunge solo il mancante, non toglie
  niente, rilanciarlo non raddoppia).
- **`OTA_VERSION` su Render**: da **svuotare** alla prossima pubblicazione sugli store.

### C. Cose che aspettano Simone

- **Archiviare `lovcarbciccio · omnivore · dimagrimento · 5 pasti`**: variante di prova che
  `pubblica:tutto` ha reso visibile alle clienti. Backoffice → Catalogo diete → Archivia.
- **La scelta sulle ~260 varianti senza una settimana piena.** Tre strade, nessuna ovvia:
  lasciarle magre e completarle quando una cliente le sceglie (costo zero, ma la prima cliente
  prende un catalogo magro); togliere dal questionario quelle che non offrite davvero (meno
  scelta, ma vera); uno script che le macina in background (costo AI, e nessuno le rivede).

### D. Cose che aspettano la NUTRIZIONISTA

- ⚠️ **«Vacanze in Serenità · onnivora · dimagrimento · 3 pasti»**: 28 giornate **senza pranzo né
  cena**, e ha una cliente che la sta ricevendo (Rosaria Gruppuso — telefonata già fatta da
  Simone). È la prima da guardare.
- ⚠️ **Emanuela Curulli**: una giornata incompleta sulla sua dieta.
- ⚠️ **«Ritorno in Equilibrio · onnivora · mantenimento · 3 pasti» è vuota**: zero giornate. Va
  generata dal generatore, `pubblica:tutto` non può farci niente.
- **Completare le settimane 1-4** delle diete che hanno clienti. Guida in
  `progetto/guide/Metabole-Guida-settimane-menu.pdf`, con le 12 diete in ordine. Si parte sempre
  dalla variante a **5 pasti**: le altre riusano le sue ricette.
- **142 ricette finite su «Basso indice glicemico · vegana · mantenimento · 3 pasti»**, che non
  ha clienti. Il lavoro utile va su `onnivora · dimagrimento · 5 pasti`.
- **18 diete «Pescetariana» con regime onnivoro/vegetariano/vegano**: o è sbagliato il nome o è
  sbagliato il regime. Solo lei può dirlo.
- **20 clienti con famiglia di dieta ambigua** (`npm run diag:famiglie`).

### Già chiuso — non riaprirlo

Verificato nel codice il 9/8: «percorso concluso» automatico (`chiudiPercorsiConclusi`, chiamata
dal cron), notifica sui piani bloccati (`apriSegnalazione`), e della revisione del 7/8 i punti
**#2, #3, #4, #5, #6, #7**. Della lista delle coach, otto punti su dodici.
