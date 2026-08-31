# Passaggio di consegne — sessione del 31/8/2026

Da leggere per intero prima di scrivere una riga. È scritto per una sessione che **non c'era**.

---

## 1. Come si lavora con Simone — non negoziabile

**Ogni consegna produce, sempre:**

1. **Summary** e **Description** come **due blocchi di codice separati in chat** (sono i due campi di
   GitHub Desktop: lui copia e incolla).
2. `progetto/COMMIT_parte_<argomento>.txt` — la copia che viaggia nel commit.
3. Un **append** a `progetto/COMMIT.txt` (⛔ mai sovrascrivere: è gitignored, ci scrivono più sessioni).
4. Una voce **in cima** a `progetto/REGISTRO.md` (si aggiunge, non si riscrive).
5. Dove serve, una voce in `backend/src/lavori/voci-iniziali.ts`.

**Prima di ogni consegna, senza eccezioni:**

- **Revisione avversariale con un subagent.** Ha trovato difetti veri *tutte le volte*, comprese
  affermazioni false che stavo per scrivere nel commit. Il 31/8 il secondo giro ha smontato tre
  correzioni scritte per rimediare al primo.
- **Prove di mutazione**: `/tmp/muta.sh <file> <vecchio> <nuovo> <percorso-test-SINGOLO>`.
  ⚠️ Una mutazione sopravvissuta non è un dettaglio: il 31/8 ne sono sopravvissute due, e tutte e due
  indicavano una prova che misurava il *sorgente* invece del *comportamento*.
- **Quattro modalità di test** (backend): `npx jest --ci`, `TZ=Europe/Rome npx jest --ci`,
  `npm run test:notte -- --ci`, e le due insieme. Frontend: `npx vitest run`.

**Consegna sul Mac:** `tar -czf` → `SendUserFile` → `device_commit_files` in
`/Users/simonesalogni/Documents/Metabole/` → estrazione con
`tar --overwrite -xzf` dentro `$HOME/mnt/Progetti--Metabole`.
⚠️ Il `--overwrite` è obbligatorio: senza, `tar` si rifiuta con «Cannot open: File exists».

⛔ **Mai `git` sulla cartella montata del Mac. Mai `git push`.** Si committa nel sandbox e basta:
spinge lui da GitHub Desktop. Il gancio che segnala «N commit non spinti» va ignorato e spiegato in
una riga.

**Come scrive Simone**: frasi brevi, spesso in fretta, a volte arrabbiato — e quando lo è ha quasi
sempre ragione nel merito. Vuole **comandi completi da incollare**, senza `<segnaposto>`. Se una cosa
non si sa, si misura: *misurare prima di decidere*. Le decisioni di prodotto e cliniche sono sue.

---

## 2. Ambiente

- Sandbox: `/home/claude/metabole`. Mac: `/Users/simonesalogni/Progetti/Metabole`.
- ⛔ **Mai `npm run typecheck`** (si pianta). Usare
  `npx tsc --noEmit -p tsconfig.json` (backend) e `npx tsc -b` (backoffice/app).
- Due errori `tsc` **preesistenti** in `prisma/approve-diets.ts` e `prisma/dedupe-diets.ts`: si
  filtrano con `grep -E "^[a-zA-Z].*error TS" | grep -v "approve-diets\|dedupe-diets"`.
- `npx prisma generate` **non gira offline** (403): i campi nuovi vogliono i cast `as never`.
- Produzione: le diagnostiche le lancia Simone dalla shell di Render, dentro `~/project/src/backend`.
- Stato al 31/8 sera: **5866 test backend** verdi in quattro modalità, backoffice 150, app 192.

---

## 3. Cos'è cambiato in produzione il 31/8

Otto consegne, tutte rilasciate. Nate tutte da **una cliente senza menu** (Patrizia Sogari), e la
causa non era una: erano tre difetti in fila più due schermate che mentivano.

1. **«Ricette semplici» spenta** (`menu_simple_recipes_enabled`, default `false`). Quel pool pescava
   da **tutto** il catalogo del regime — nessun filtro sulla dieta — e **non leggeva i tag
   allergene**: a una cliente sulla «Mediterranea senza glutine» arrivavano biscotti della
   «Flexitariana» col tag Glutine, e la guardia fermava tutta l'erogazione.
   ⚠️ L'interruttore **nell'app resta visibile e non fa niente**: toglierlo vuole un rilascio dell'app.
2. **Il motore cerca un'alternativa invece di bloccare** (`menu/cerca-un-alternativa.ts`). Entra
   **solo** dove prima si usciva con `return []`: il confronto non è «piatto vecchio contro piatto
   nuovo», è «un piatto contro nessun menu». La guardia si rifà sui pasti sostituiti.
3. **Il sostituto non scavalca un'allergia** (`swapDislikedDishes`). Leggeva
   `{regime, intolerances, dislikedFoods}`: **le allergie non c'erano**, e girava **dopo** la guardia.
   Caso Sonia: gamberoni a un'allergica ai crostacei.
4. **Il cambio dieta non si annulla più da solo.** `assegnaSenzaGlutineEAvvisa` girava su **ogni**
   salvataggio: da tre settimane nessuna cliente col glutine dichiarato poteva cambiare dieta.
5. **Il bollino e `diag:cliente` dicono se i menu sono fermi**, non se il questionario l'ha segnalata.
6. **Il blocco che si riapre da solo avvisa** (prima tornava `open` in silenzio).
7. **Vera legge gli elenchi** e non ne perde più quattro su undici in silenzio.
8. Due diagnostiche: `diag:salvataggi-scheda`, `diag:commerciale-e-coach`.

---

## 4. Da fare, in ordine

### 4.1 ⛔ Vera fa una cosa sbagliata con sicurezza

«il merluzzo può essere sostituito con orata, salmone o spigola **estendi la regola a tutti**» →
Vera ha risposto *«Fatto: l'ho scritta a Dany nella vostra chat, e ho chiuso la segnalazione»*.
**Non ha creato nessuna regola**: ha mandato un messaggio alla cliente e chiuso l'escalation. Lei ha
riprovato con «crea la regola che…» e ha ricevuto «non ci arrivo».

È il difetto più grave del gruppo: fare la cosa sbagliata con sicurezza è peggio che non farla.
Da guardare: il ramo che risponde a una segnalazione in chat, e perché ha vinto su una frase che
conteneva «estendi la regola a tutti».

### 4.2 Il nome di Vera — 5 frasi su 25, ed è il primo incontro

`estraiNome` (`src/vera/vera-chat.ts:905`) non riconosce «ti **voglio** chiamare Vera» né «il tuo
nome**,** sarà Vera» (la virgola). E soprattutto: quando il nome **c'è già**, quelle frasi cadono in
«non ci arrivo» invece di «mi chiamo già Vera, vuoi cambiarlo?».

### 4.3 Il menu scritto a mano dalla scheda

Non esiste, e il 31/8 sarebbe stata la via d'uscita in cinque minuti. Disegno concordato con Simone:
dalla scheda cliente, scegli le date, e per ogni pasto cerchi nel catalogo. Tre cose lo rendono utile
invece che pericoloso: la ricerca è **già filtrata sulle sue esclusioni** (le incompatibili compaiono
barrate col motivo, e servirle richiede di forzare e scrivere perché); le **kcal si sommano** mentre
scegli, col target davanti; e il giorno scritto a mano è **intoccabile** dalla passata notturna e da
«Rigenera menu». ⚠️ Più la chiave di permesso sua, come ogni pagina nuova.

### 4.4 Il resto del vocabolario di Vera

Dalla pagina «frasi che non ho capito» (25 in 90 giorni), i gruppi rimasti:
**liste di catalogo** (5: «crea la lista dei formaggi molli», «aggiungi equivalenza»),
**la coda** (3: «chiudi ilaria», «hai segnalazioni per me?»),
**le cortesie** (4: «ok», «ok ciao», «Quale?», «ok annulla tutto»),
**le ricette** (2: sostituire un piatto, non un alimento).

### 4.5 Il perimetro della commerciale — aspetta una decisione già presa a metà

Misurato il 31/8: **Giusy non è la coach di nessuno**, è sopra tutte — 0 clienti sul suo id, 13 schede
sotto, 55 clienti nella rete. Simone ha deciso: **perimetro = la sua rete**, più **le 4 clienti senza
coach**, che vede lei come capo rete.
⛔ Non è una riga: `coachTeamScope` risponde «solo le sue» **solo** se il ruolo è letteralmente
`coach`; e i cancelli sono **due** — `perimetroClienti` e `RUOLI_CHE_VEDONO_TUTTE`, che nomina
`sales`. La forma `{field, staffIds}` va estesa per dire «più quelle di nessuno», e la leggono a mano
**sei punti** oltre alle due funzioni di casa: `vera/vera-chat`, `vera/applica-proposta`,
`vera/registro` (tre volte), `commerce/crm`.

### 4.6 Voci più vecchie, ancora aperte

`digiuno-pubblicazione` (aspetta tre numeri da Simone) · `kit-rientro-quale-peso` e
`pesate-lontane-buco-del-ritmo` (decisioni cliniche) · `attivita-nutrizionista-in-app` (schermata
app, serve sapere cosa ci va dentro) · `scheda-stile-cablata-nell-app` ·
`descrizioni-diete-cosa-resta` · `esclusioni-chiave-dentro-parola` (sospesa fino al paniere).
Dopo la lista: il rifacimento del paniere (`progetto/PIANO_Panieri_Ricette.md`).

---

## 5. In mano a Simone, non al codice

- **Cambiare la chiave `AI_API_KEY`**: era leggibile in uno screenshot mandato in chat.
- **I tre pasti di Sonia** già in menu col suo allergene: il codice non tocca i giorni già erogati.
- **Patrizia è sulla Keto** con il glutine fra le allergie — ci è finita di rimbalzo da una prova
  tecnica. Il piatto è protetto dalle esclusioni, ma la scelta va confermata o disfatta.
- **Il catalogo della «Mediterranea senza glutine»**: su due giornate da cinque pasti, **sei piatti su
  dieci** erano roba che a Patrizia non si poteva servire. Adesso il motore li sostituisce e la
  cliente non se ne accorge, ma il buco resta (`npm run diag:esclusioni`).
- **La notifica di «Piano bloccato» è solo in-app**: nessuna email, nessuna push. Per un blocco che
  ferma un'erogazione è poco — decisione di prodotto da prendere.

---

## 6. Le trappole imparate il 31/8 — leggerle evita di ripeterle

⛔ **Un commento che descrive un difetto già corretto è peggio di nessun commento.** Tre volte in un
giorno ho mandato Simone a inseguire cose che non c'erano: il bollino «Percorso supervisionato», il
verdetto di `diag:cliente`, e «Piano bloccato non avvisa nessuno» — quest'ultima l'ho **ripetuta io**
per mezza giornata avendola letta in un commento vecchio. **Prima di riferire una cosa letta in un
commento, si verifica nel codice.** *Una ragione falsa è peggio di un ordine sbagliato*, anche quando
è la propria.

⚠️ **Quando lo stesso output torna identico, guardare il PID e l'ora.** Il 31/8 ho analizzato per due
volte un incollaggio vecchio credendolo un giro nuovo.

⚠️ **Un difetto «impossibile» va misurato lo stesso.** Il salvataggio del tipo di dieta «non poteva»
fallire in silenzio — DTO, whitelist e 403 erano tutti a posto. Falliva: se lo disfaceva da solo tre
righe dopo. La diagnostica sul registro (`diag:salvataggi-scheda`) ha chiuso la domanda in un minuto,
dopo mezza giornata di ipotesi.

⚠️ **Le prove strutturali (che leggono il sorgente) non bastano.** `return true || valutaRicetta(…)`
le lascia tutte verdi. Dove conta, la prova deve **chiamare il codice**.

⚠️ **Quando una regola di sicurezza blocca, chiedersi sempre se poteva invece *sostituire*.** È stata
la richiesta di Simone, ed era giusta: bloccare va bene solo quando non esiste nessuna alternativa
sicura — e quel «nessuna» va guardato, non assunto.
