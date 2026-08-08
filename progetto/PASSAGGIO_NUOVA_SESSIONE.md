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

## Lavori in coda, in ordine

### Codice
1. **Gaia ↔ menu**, punti 1 e 2 di `PROGETTO_gaia-cambio-menu.md` (vedi sopra). Poi i punti 3-5:
   la correzione del nutrizionista che diventa conoscenza riutilizzabile, `MenuWeight` per i
   gusti, il conteggio nel report di fine mese come **dato di personalizzazione**.
2. **Reset password dalla scheda coach** (vedi sopra).
3. Dalla lista delle coach: **scadenze e compleanni nel calendario**, **data di nascita nel
   questionario**, **«nuova cliente assegnata da accettare»** per la riassegnazione.
4. Dalla revisione del 7/8, restano: **#4** (il pulsante del report vende solo il mese singolo,
   mai l'abbonamento: `cart.setPlan` senza `billing`) e **#9** (verificare in Acquisti se ci sono
   ordini «Menu di rientro» in sospeso).

### Cose che aspettano Simone
- **Archiviare `lovcarbciccio · omnivore · dimagrimento · 5 pasti`**: è una variante di prova che
  `pubblica:tutto` ha reso visibile alle clienti.
- Far **completare al nutrizionista le settimane** delle diete che hanno clienti (guida in
  `progetto/guide/Metabole-Guida-settimane-menu.pdf`, si parte sempre dalla variante a 5 pasti).
