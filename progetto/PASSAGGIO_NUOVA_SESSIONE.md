# Passaggio alla sessione nuova

Aggiornato il 9 agosto 2026, **riverificato sul codice di `origin/main`** (commit `e424459`) e
non ricopiato dalle liste dei giorni prima: quello che risultava aperto ed è già chiuso qui non
compare più, ed è elencato in fondo perché nessuno lo riapra.

---

## Messaggio da incollare come primo messaggio

> Progetto Metabole. Prima di tutto leggi `progetto/PASSAGGIO_NUOVA_SESSIONE.md`,
> `progetto/ISTRUZIONI_PER_AI.md` e le voci in cima a `progetto/REGISTRO.md`.
> Parlami **sempre in italiano**. Ogni consegna aggiorna `progetto/REGISTRO.md` e finisce con
> **Summary** e **Description** pronti da incollare in GitHub Desktop.
>
> Il lavoro da fare, in quest'ordine:
>
> 1. **Reset password dalla scheda cliente per la coach.** La coach preme un pulsante e alla
>    cliente parte la mail col link di reset — **non** deve poter cambiare lei la password.
>    L'endpoint che esiste (`POST /admin/users/:id/reset-password`) sta dietro i permessi di
>    amministrazione utenti e darli a una coach aprirebbe tutta la gestione utenti: serve un
>    **endpoint dedicato**, limitato alle clienti assegnate a quella coach.
>
> 2. **I punti 3, 4 e 5 di `progetto/PROGETTO_gaia-cambio-menu.md`** (i punti 1 e 2 sono già
>    fatti — leggi il riquadro di stato in cima a quel file prima di toccare qualsiasi cosa):
>    la correzione del nutrizionista che diventa **conoscenza riutilizzabile** (è l'unica
>    migrazione prevista di tutto il progetto), `MenuWeight` per la memoria dei gusti, e il
>    conteggio nel report di fine mese come **dato di personalizzazione**.

---

## Contesto minimo (per non rifare domande già fatte)

**Cos'è**: app di nutrizione italiana **in produzione, con clienti vere e pagamenti Stripe**.
Client React+Vite+Capacitor (con area staff), backend NestJS+Prisma+PostgreSQL su Render,
backoffice React su Vercel.

**Regole permanenti di Simone**

- Si parla **in italiano**.
- Ogni consegna **aggiorna `progetto/REGISTRO.md`** e finisce con **Summary + Description** da
  incollare in GitHub Desktop.

**Come si consegna il codice (device bridge)**

- Il repo autoritativo è **sul Mac**: `/Users/simonesalogni/Progetti/Metabole`, montato in
  sandbox come `~/mnt/Progetti--Metabole`. Il clone in sandbox (`/tmp/metabole-fresh`) serve a
  leggere e scrivere in fretta, ma **non è la verità**: prima di fidartene fai
  `git fetch && git reset --hard origin/main`, perché può essere indietro di commit che non hai
  visto.
- Consegna: `SendUserFile` → `device_commit_files` in
  `~/Progetti/Metabole/backend/node_modules/.consegna/<nome>.tgz` → poi `device_bash`:
  `tar xzf` in una cartella di stage e
  `find . -type f | while read -r f; do cat "$f" > "$HOME/mnt/Progetti--Metabole/${f#./}"; done`.
- ⚠️ **`cat > destinazione` è obbligatorio**: il mount non sa fare `unlink`, quindi `cp` e `mv`
  sul file di destinazione falliscono.
- ⚠️ **Mai `git` sulla cartella montata**: lascia un `.git/index.lock` che poi va tolto a mano.
  Per sapere a che punto è il Mac si legge `.git/HEAD` e `.git/refs/heads/main` (sola lettura).
- ⚠️ `device_bash` ha un **timeout massimo di 45 secondi** e **non può cancellare file** (`rm`
  fallisce: si spostano in un `_to_delete/`).

**Limiti dell'ambiente**

- **Type-check: `cd backend && npm run typecheck`, e il verde è ZERO errori.** Non più «42» o
  «32»: quei numeri erano rumore dello stub di Prisma, e in mezzo al rumore l'11/8 è passato un
  errore vero che ha fatto fallire il build su Render.
- `npx prisma generate` **fallisce** con 403 sui binari (sia sul Mac sia in sandbox), ed è la
  ragione per cui `@prisma/client` restava uno stub. `npm run typecheck` gira intorno al 403 —
  `--no-engine` + un mirror finto in locale: per i **tipi** il motore non serve. Dettagli in testa a
  `backend/scripts/typecheck-reale.mjs`, incluso cosa lascia in `node_modules` (due file finti da
  1 KB, innocui finché in locale non si eseguono query o migrazioni; `npm ci` rimette a posto).
- Per le colonne nuove resta il pattern `as never` sui `data` e sui `select` **finché non si è
  rigenerato il client**: dopo `npm run typecheck` i tipi sono aggiornati e non serve più.

**Le OTA**: guida dedicata, `progetto/guide/COME_SI_FA_UNA_OTA.md`. Leggerla **prima** di
lanciare qualunque cosa. Stato: `app/package.json` = 2.1.2, bundle 2.1.2 pubblicato e verificato,
`OTA_VERSION` su Render = 2.1.2. **2.1.0 e 2.1.1 sono bruciate**: la prossima parte da **2.1.3**.

---

## Lavori in coda — elenco completo

### A. Codice — da fare

1. **Reset password dalla scheda coach** (vedi il messaggio d'apertura). È il punto lasciato
   fuori apposta dal commit `ab04330`, che ne spiega il motivo.

2. **Gaia, punti 3-5** di `PROGETTO_gaia-cambio-menu.md`. I punti 1 e 2 sono chiusi.
   - **Punto 3 — la correzione che insegna**: oggi la sostituzione nasce marcata «da
     verificare» e il nutrizionista la vede in scheda, ma quando la corregge la correzione non
     viene salvata da nessuna parte: lo stesso errore torna la settimana dopo con un'altra
     cliente. Serve la tabella delle sostituzioni imparate (**unica migrazione del progetto**).
     Le due protezioni — allergeni e plausibilità dei grammi — sono **già in piedi**.
   - **Punto 4 — la memoria dei gusti**: `MenuWeight` non è ancora toccato dal ponte. La
     segnalazione per i motivi clinici invece c'è già (`apriSegnalazione` in
     `sostituzione-chat.service.ts`).
   - **Punto 5 — il report**: il conteggio dei cambi come **dato di personalizzazione**
     («hai personalizzato 7 piatti questo mese» + i tre alimenti che cambia più spesso), non
     come conteggio di richiami. Non ancora fatto.

3. **Dalla lista delle coach — restano quattro punti su dodici.**
   - **Scadenze nel calendario della coach.** `coachAgenda()` in `coach/coach.service.ts`
     restituisce **solo gli appuntamenti**. Mancano fine prova gratuita e fine piano.
     (`clientAgenda()`, poco più sotto nello stesso file, la scadenza piano ce l'ha già: da lì
     si copia la logica.)
   - **Compleanno nel calendario della coach.** La mail di auguri esiste
     (`marketing/lifecycle.service.ts`), l'appuntamento in agenda no.
   - **Data di nascita nel questionario.** `onboarding/onboarding.questions.ts` chiede solo
     `age`. Il campo `User.birthDate` esiste e si ricava dal codice fiscale
     (`common/codice-fiscale.util.ts`), ma solo per chi lo inserisce: senza la domanda, il
     compleanno lo abbiamo a metà.
   - **«Nuova cliente assegnata da accettare».** Esiste `lead_assigned` per i lead e
     `client_assigned_nutritionist` per la nutrizionista; **non** esiste per una cliente già
     acquisita riassegnata da una coach a un'altra. Da chiarire con Simone se serve davvero.

4. **`PlanFlow.tsx` vende sempre una tantum** (trovato il 9/8, non era in nessuna lista).
   È lo stesso difetto del punto #4 della revisione — corretto sul pulsante del report — ma
   sull'**altra** strada d'acquisto, e quella è la principale: il primo acquisto in onboarding.
   `app/src/pages/PlanFlow.tsx` dichiara `interface Plan` **senza `billing`** e chiama
   `cart.setPlan(...)` senza passarlo, quindi nel Checkout la scelta fra abbonamento e pagamento
   unico non compare mai. Correzione: aggiungere `billing` all'interfaccia e inoltrarlo, come già
   fa `Negozio.tsx`. Da verificare prima quali piani `3m/6m/12m` hanno davvero `billing` diverso
   da `one_time`: se sono tutti una tantum il difetto è latente, non attivo.

### B. Verifiche (non è codice, è guardare)

- **#9 della revisione 7/8**: controllare in **Acquisti** se ci sono ordini «Menu di rientro»
  rimasti in sospeso.
- **Le percentuali del piano «Percorso Metabole 3 mesi»**: devono essere **soglie cumulative**
  — 25 / 35 / 45 per coach / coordinatrice / manager e 10 / 15 per nutrizionista / capo
  nutrizionista. Scritte 25 / 10 / 10 il secondo livello calcola `10 − 25 = −15` e incassa solo
  la coach. Se non sono ancora corrette: correggerle **e poi** rilanciare
  `CONFERMA=1 npm run ricalcola:provvigioni -- 2026-07-01` (aggiunge solo il mancante, non toglie
  niente a nessuno, rilanciarlo non raddoppia).
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
  cena**, con una cliente che la sta ricevendo (Rosaria Gruppuso — telefonata già fatta da
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

---

## Comandi (shell di Render, cartella del backend)

Girano tutti **in sola lettura**: si scrive solo con `CONFERMA=1`.

| Comando | Cosa fa |
|---|---|
| `npm run pubblica:tutto` | Attiva ricette, conferma allergeni, approva gruppi, pubblica e rende visibile. Con un nome fra virgolette si limita a una famiglia |
| `npm run compatta:menu` | Compatta i pasti sulle settimane: settimane piene a partire dalla 1, le ricette avanzate non si buttano |
| `npm run diag:menu-incompleti` | Le diete con giornate a cui manca un pasto, e quali hanno clienti |
| `npm run sistema:nomi` | Ricompone nome / cognome / alias sui nominativi importati male |
| `npm run ricalcola:provvigioni -- <email o data>` | Aggiunge le quote di provvigione mancanti sui pagamenti già approvati |
| `npm run diag:provvigioni -- <email>` | Perché su quel pagamento ha incassato solo una persona |
| `npm run diag:settimane` | Le diete nell'ordine in cui conviene lavorarle |
| `npm run diag:dieta -- "<nome>"` | Dove sono finite davvero le ricette di una famiglia |
| `npm run diag:cliente -- <email>` | Perché quella cliente vede quel messaggio al posto del menu |
| `npm run diag:famiglie` | Clienti con famiglia di dieta ambigua |
| `npm run pulisci:spezie` | Toglie le spezie dai cibi esclusi delle clienti |
| `npm run accendi:automazioni` | ⚠️ Leggere il riepilogo: il motore mail è **a opt-out**, senza `ACCENDI=` spegne quello che oggi parte |

---

## Già chiuso — non riaprirlo

Verificato su `origin/main` il 9/8, con il commit che l'ha chiuso:

- **Gaia, punti 1 e 2** — `2783bce`. Il pulsante «Sostituisci» porta nella chat, la sostituzione
  concordata entra in `MenuDay.meals` coi grammi ed è marcata «da verificare»; in scheda cliente
  c'è la card «Conversazioni» col thread di Gaia e l'elenco dei cambi da verificare. Il dialogo è
  **deterministico**, non affidato all'AI (in produzione `ai_assistant_enabled` è `false`).
- **Permessi coach** — `ab04330`: `clients` e `change_diet_type` in scrittura per coach e
  coordinatrice (cambio dieta, numero di pasti, regime, anagrafica). La portata «solo le mie
  clienti» resta applicata nei servizi.
- **OTA allineate** — `63f63df` e `4a602f4`: il numero pubblicato e quello mostrato in app
  coincidono.
- **«Percorso concluso» automatico** — `chiudiPercorsiConclusi()`, chiamata dal cron giornaliero.
- **Notifica sui piani bloccati** — `apriSegnalazione`, con il ripiego al responsabile quando il
  ruolo non è assegnato a nessuno.
- **Revisione del 7/8**: chiusi i punti **#2, #3, #4, #5, #6, #7**. Restano #9 (una verifica) e
  il caso `PlanFlow` qui sopra, che è lo stesso difetto del #4 su un'altra strada.
- Della lista delle coach: **otto punti su dodici**.
