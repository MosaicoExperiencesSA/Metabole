# HANDOFF — Allergie e intolleranze: cosa cambiare, in che ordine

> ## ✅ STATO AL 12/8/2026 — cosa è stato fatto e cosa no
>
> | | | |
> |---|---|---|
> | **A** | I tre difetti nell'espansione degli allergeni | ✅ **fatto** |
> | **B** | `allergiesOther` | ✅ **fatto, ma diversamente da come dice il §2** — vedi sotto |
> | **C** | «Nessuna allergia» ≠ «non risposto` | ✅ colonna e scrittura fatte; ⛔ **l'opzione «nessuna» nel questionario e il «freno forte» NO** |
> | **D** | Le allergie nelle schede | ✅ backoffice e app (sola lettura) + etichette del registro |
> | **E** | Ri-domanda alle clienti già iscritte | ⛔ non iniziata |
> | **F** | Visita obbligatoria | ⛔ non iniziata, come dice il §8 |
>
> ### ⚠️ Dove mi sono discostato dal §2, e perché
>
> Il §2 dice: `allergies` i codici, `allergiesOther` il testo libero, separati al salvataggio.
> **Non l'ho fatto.** Il testo libero resta ANCHE dentro `allergies`, e `allergiesOther` è un
> **marcatore** di quali fra quelle voci sono testo libero.
>
> Il motivo l'ho verificato in codice: **sette punti** leggono `allergies` per escludere davvero
> gli alimenti — `menu.service` (pool ricette semplici), `sostituzione-chat.service` (due punti,
> i sostituti di Gaia), `personal-base`, `plan-report`, `crm.service`, `clients.service`. Spostare
> il testo libero in un'altra colonna li disarma tutti insieme e in silenzio: sarebbe il difetto
> `frutta_a_guscio` — un'allergia dichiarata che non esclude niente — rifatto in grande, e su
> un dato dove la conseguenza è una reazione allergica.
>
> Una ridondanza scritta da **un punto solo** (`common/allergie.ts`) e verificata da un test costa
> meno di sette letture da ricordarsi di aggiornare, con una che se dimenticata non dà errore.
> Il beneficio del §2 — `personal-base` sa quali codificare senza dedurlo — si ottiene lo stesso:
> `allergieDaCodificare()` usa il fatto quando c'è, e ricade sulla deduzione solo per chi è
> iscritta da prima.
>
> ### Cosa resta aperto, e da chi dipende
>
> - ⛔ **I solfiti** (§1.2): ho messo solo la parola letterale, dichiarato nel codice e in un test.
>   L'elenco (vino, aceto balsamico, frutta disidratata, salumi…) **lo deve dare Nocanty**: decide
>   quali piatti si tolgono dal piatto di una cliente, e in eccesso si sbaglia facilmente.
> - ⛔ **`intolerancesOther`** (§1.3): serve una colonna e un campo nel questionario. Finché non
>   c'è, `'other'` fra le intolleranze **non si filtra** — è l'unica traccia di quello che non
>   sappiamo, ed è la popolazione più urgente del §7.1.
> - ⛔ **L'opzione «nessuna» nel questionario** (§3.1): è una modifica all'app, quindi va con la OTA.
>   Finché non c'è, un array vuoto conta come «non risposto», non come «non ne ho».
> - ⛔ **Il «freno forte»** (§3): non implementato, e non va implementato prima di averlo definito
>   con la nutrizionista. Nessun comportamento parte da `allergieDichiarateIl`.
> - ✅ **Chi può scrivere le allergie** (§5) — **fatto il 13/8**, confermato da Simone. Permesso
>   `change_allergies` («Modifica allergie»), di default a nutrizionista, capo nutrizionista e
>   admin. Modificabili dalla **scheda cliente** e dalla **scheda lead**, che scrivono dallo stesso
>   endpoint. Le intolleranze restano dov'erano (già dentro «Clienti: gestisci»).
> - ⛔ **Prima di lanciare la campagna (§7): CONTARE.** Se la popolazione 3 fossero 280 clienti su
>   315, non è una campagna, è un difetto del questionario da correggere prima.
>
> ---

**Per l'agente che prepara la OTA.** Scritto il 12/8/2026 dopo verifica diretta su `main`.
Tutti i riferimenti `file:riga` sono stati letti, non ricordati. Il verbatim è verbatim.

---

## 0. Leggi prima questo

La richiesta di partenza era «separare allergie e intolleranze nel questionario e in tutte le
schede». **La separazione esiste già**: `ClientProfile` ha tre array distinti — `allergies`,
`intolerances`, `dislikedFoods` (`schema.prisma:407-409`) — e la gerarchia è codificata come regola
R8 (`engine-rules.catalog.ts:102`): allergia = blocco duro, intolleranza = sostituzione, non gradito
= solo sostituzione.

Quello che manca è un'altra cosa, ed è più concreta. In ordine di urgenza:

| | Cosa | Perché adesso |
|---|---|---|
| **A** | Tre difetti nell'espansione degli allergeni | Un'allergia dichiarata che non esclude niente su una delle due strade |
| **B** | `allergiesOther` fuso dentro `allergies` senza marcatore | Il testo libero perde la sua natura, e si ricostruisce a indovinare |
| **C** | «Nessuna allergia» non è distinguibile da «non risposto» | È il freno di sicurezza: oggi non c'è |
| **D** | Le allergie non compaiono in nessuna scheda | Né la cliente né il backoffice le vedono |
| **E** | Ri-domanda alle clienti già iscritte | Solo a chi serve davvero: vedi §7, **non a tutte** |
| **F** | Visita obbligatoria in caso di allergia | ⛔ dipende da una decisione ancora aperta: vedi §8 |

**A, B, C, D si possono fare subito. E si può fare subito. F no** — vedi §8.

---

## 1. ⚠️ A — I tre difetti nell'espansione degli allergeni

Questo è il pezzo che farei per primo anche se si dovesse fermare tutto il resto.

L'esclusione alimentare viaggia su **due strade diverse**, e questo va tenuto a mente per non
allarmarsi troppo né troppo poco:

1. **Strada codificata** — `personal-base.service.ts` filtra le ricette per **tag allergene**
   (`Recipe.allergens`, 14 codici UE, `catalog/allergens.ts`). Copre le allergie scelte dall'elenco,
   **a condizione che le ricette abbiano i tag revisati** (`Recipe.allergensReviewed`).
2. **Strada testuale** — `menu/exclusions.ts` espande il termine in parole chiave e le cerca nel nome
   del piatto e negli ingredienti. È quella usata da `menu.service.ts:624` (pool «ricette semplici»)
   e da `sostituzione-chat.service.ts:791,955` (i sostituti proposti da Gaia).

I difetti stanno tutti sulla **strada testuale**.

### 1.1 `frutta_a_guscio` non si espande — underscore contro spazi

Il questionario salva il codice con l'underscore (`onboarding.questions.ts:63`):

```ts
options: ['glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia', 'latte', 'frutta_a_guscio', 'sedano', 'senape', 'sesamo', 'solfiti', 'lupini', 'molluschi', 'altro'],
```

`INTOLERANCE_MAP` conosce la chiave **con gli spazi** (`exclusions.ts`):

```ts
'frutta a guscio': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'pinoli', 'macadamia', 'pecan'],
```

e `ALIAS` ha `nuts` e `'tree nuts'` e `'frutta con guscio'`, ma **non** `frutta_a_guscio`. Quindi
`expandExclusion('frutta_a_guscio')` ritorna `['frutta_a_guscio']` — una stringa che non compare in
nessun nome di piatto e in nessun ingrediente. Sulla strada testuale quell'allergia **non esclude
niente**.

È esattamente lo stesso difetto che l'8/8 ha fatto proporre il burro a una cliente allergica al
latte, e che è già raccontato nel commento in testa a `INTOLERANCE_MAP`. La lezione era: *una chiave
che la mappa non riconosce si comporta come un'esclusione che non c'è, e non produce nessun errore*.

**Correzione**: aggiungere ad `ALIAS`
```ts
frutta_a_guscio: 'frutta a guscio',
frutta_secca: 'frutta secca',
```
e — meglio ancora — normalizzare in `expandExclusion` sostituendo `_` con spazio **prima** di cercare
in `ALIAS`, così il difetto non si ripresenta con la prossima opzione che nasce con l'underscore.

### 1.2 Quattro allergeni UE senza nessuna espansione

`sedano`, `senape`, `solfiti`, `lupini` sono opzioni del questionario e **non compaiono** né in
`ALIAS` né in `INTOLERANCE_MAP`. Sulla strada testuale valgono solo come parola letterale.

Per `sedano` e `senape` la parola letterale funziona quasi sempre (compaiono negli ingredienti col
loro nome). Per `solfiti` e `lupini` no: i solfiti non si scrivono mai negli ingredienti, e i lupini
stanno già dentro la chiave `legumi`.

**Correzione minima**: aggiungere le quattro chiavi a `INTOLERANCE_MAP` con le loro parole
(`sedano: ['sedano']`, `senape: ['senape', 'mostarda']`, `lupini: ['lupini', 'lupino']`,
`solfiti: ['solfiti', 'vino', 'aceto balsamico', 'frutta secca disidratata']`) — e discutere con la
nutrizionista l'elenco dei solfiti prima di scriverlo, perché lì si sbaglia facilmente in eccesso.

### 1.3 `'altro'` e `'other'` finiscono in banca dati come se fossero alimenti

- `'altro'` è **solo un flag di interfaccia** per far comparire il campo libero, e viene tolto
  **soltanto dal client React** (`app/src/pages/Onboarding.tsx:449`). Il server non lo filtra: una
  chiamata diretta all'endpoint, o un'app vecchia, salva `'altro'` come allergene, ed
  `expandExclusion('altro')` lo cerca letteralmente nei nomi dei piatti.
- `intolerances` ha l'opzione `'other'` **senza nessun campo libero associato**
  (`onboarding.questions.ts:66`): chi la sceglie si porta in banca dati la stringa `'other'`, che non
  vuol dire niente e non esclude niente. **Chi ha scelto «Altro» ha un'intolleranza che noi non
  sappiamo.** Vedi §7: sono le prime da ricontattare.

**Correzione**: filtrare `'altro'` **lato server** (dove già si filtra `'none'`,
`onboarding.service.ts:169`), e dare a `intolerances` il suo campo libero `intolerancesOther`
esattamente come ce l'hanno le allergie.

---

## 2. B — La colonna `allergiesOther`

Oggi il testo libero viene concatenato dentro `allergies` e la distinzione **si perde**. I due rami
dell'upsert fanno la stessa cosa (`onboarding.service.ts:321` e `:357`):

```ts
allergies: [...(dto.allergies ?? []), ...(dto.allergiesOther ?? [])],
```

⚠️ **Sono due rami e vanno cambiati tutti e due.** Il ramo `update` è quello che nessuno rilegge:
l'8/8 è così che il questionario perdeva il consenso sanitario e sei clienti sono rimaste bloccate al
carrello.

La distinzione viene poi **ricostruita a posteriori** per differenza col catalogo
(`personal-base.service.ts:167-170`):

```ts
const allergies = profile.allergies ?? [];
const coded = allergies.filter((a) => EU_ALLERGEN_CODES.includes(a));
const uncoded = allergies.filter((a) => !EU_ALLERGEN_CODES.includes(a));
if (uncoded.length) reasons.push(`allergie da codificare a mano: ${uncoded.join(', ')}`);
```

Funziona, ma è fragile: basta che un codice UE cambi nome e un'allergia codificata diventa «da
codificare», o viceversa.

**Cosa fare**: migrazione versionata che aggiunge
```prisma
allergiesOther String[] @default([]) @map("allergies_other")
```
Al salvataggio i due campi restano separati. `personal-base` continua a bloccare la base personale se
`allergiesOther` non è vuoto — ma adesso lo sa perché glielo dice il dato, non perché lo deduce.

⚠️ **Migrazione dei dati esistenti**: NON provare a scindere all'indietro il campo `allergies` di chi
è già iscritto. Si può fare, ed è tentante (`allergies.filter(a => !EU_ALLERGEN_CODES.includes(a))`),
ma su un dato sanitario una separazione automatica non riletta da nessuno è esattamente il tipo di
cosa che questo progetto vuole evitare. La colonna nasce vuota; il ripopolamento passa dalla
ri-domanda (§7) o dalla nutrizionista.

Nota: il payload grezzo del questionario, con `allergiesOther` già separato, resta comunque
archiviato in `ClientProfile.onboardingAnswers` (Json, scritto a `onboarding.service.ts:330` e
`:366`). Serve per verificare a posteriori, non per ricostruire in automatico.

---

## 3. C — «Nessuna allergia» ≠ «non ho risposto»

Oggi `allergies: []` vuol dire due cose diverse e indistinguibili: *non ne ho* e *non me l'ha mai
chiesto nessuno*. Nessuno dei campi del questionario in quella pagina è `required`, quindi si passa
oltre senza rispondere.

**Due modifiche, piccole e complementari:**

1. Aggiungere l'opzione esplicita **`'nessuna'`** all'elenco `allergies` del questionario
   (`intolerances` ce l'ha già: `'none'`). Così la risposta «non ne ho» è una risposta, non
   un'assenza. Filtrarla lato server come si fa con `'none'`.
2. Aggiungere a `ClientProfile`:
   ```prisma
   allergieDichiarateIl DateTime? @map("allergie_dichiarate_il")
   ```
   valorizzato **solo** quando la cliente risponde esplicitamente alla domanda — dal questionario o
   dalla conversazione con Gaia (§7).

I tre stati diventano leggibili:

| `allergieDichiarateIl` | `allergies` | significato | comportamento |
|---|---|---|---|
| `null` | qualsiasi | **non specificato** | freno forte |
| valorizzato | `[]` | nessuna allergia | normale |
| valorizzato | pieno | allergie note | blocco duro sugli allergeni |

⚠️ «Freno forte» va definito con la nutrizionista prima di scriverlo. La forma minima e sicura:
`personal-base` segnala la cliente come da rivedere e nella scheda compare l'avviso «allergie non
confermate». **Non** bloccare il piano di 315 clienti perché un campo nuovo è vuoto: quello sarebbe
un guasto di massa introdotto da una migrazione.

---

## 4. D — Le allergie non si vedono da nessuna parte

Verificato in tutto il repo:

| dove | allergie | intolleranze | non graditi |
|---|---|---|---|
| App, profilo cliente (`app/src/pages/Profilo.tsx`) | **non compaiono mai** | sola lettura (`:558-562`) | modificabili (`:451-568`) |
| App, scheda nutrizionista (`NutriPazienteDetail.tsx:107`) | sola lettura | sì | sì |
| App, scheda coach (`CoachClienteDetail.tsx:211,215`) | **assenti** | modificabili | modificabili |
| Backoffice, scheda cliente (`ClientDetail.tsx:1437-1438`) | **nessuna riga** | sola lettura | sola lettura |

**Da fare**: una riga «Allergie» in **sola lettura** nel profilo dell'app e nella scheda cliente del
backoffice, accanto a quelle che già ci sono. La cliente deve poter rivedere quello che ha
dichiarato — è un dato che la riguarda e oggi le è invisibile.

Etichette del log modifiche: `backoffice/src/lib/logModifiche.ts:47-48` ha `intolerances` e
`dislikedFoods` e non `allergies`. Aggiungerla, altrimenti una modifica alle allergie comparirebbe
nel log senza nome.

---

## 5. Chi può scrivere le allergie

Oggi **un solo punto in tutto il repo** scrive `allergies`: l'upsert dell'onboarding
(`onboarding.service.ts:321` e `:357`). Non è nel DTO della PATCH cliente
(`profile/dto/update-profile.dto.ts`), non è in `PROFILE_FIELDS` (`clients.service.ts:21`), non è nel
DTO staff (`clients/dto/update-client.dto.ts`). Quindi l'unico modo di correggerle è **rifare il
questionario**, che le sovrascrive per intero.

⚠️ **Questa protezione va tenuta, non tolta.** In particolare: né la coach né la cliente né il
backoffice generico devono poter scrivere le allergie.

**Proposta** (da confermare con Simone, non implementare a scatola chiusa): consentirne la modifica a
**`nutritionist` e `head_nutritionist`**, con audit, perché sono le uniche persone che possono
codificare un'allergia scritta a mano. Il resto resta in sola lettura.

⚠️ Attenzione a una trappola dell'upsert: è **replace, non merge**. Se il DTO non contiene
`allergies`, il campo viene azzerato (`consents` invece viene fuso, `onboarding.service.ts:292-296`).
Chi rifà il questionario saltando la pagina delle allergie oggi **le perde tutte**.

---

## 6. Il questionario

`onboarding.questions.ts:52-69` — oggi allergie e intolleranze stanno **sulla stessa schermata**.
Richiesta di Simone: separarle. Concretamente:

- **Schermata 1 — Allergie**: `allergies` (14 codici UE + `nessuna` + `altro`) e `allergiesOther`
  (visibile solo se `altro`). Testo che spiega che le allergie si evitano sempre, tracce e derivati
  compresi, e che **una allergia dichiarata comporta la visita** (vedi §8: il testo si scrive solo
  dopo aver deciso cosa comporta davvero).
- **Schermata 2 — Intolleranze**: `intolerances` + il nuovo `intolerancesOther`, con il testo che
  spiega che si gestiscono con alternative.

⚠️ La condizione di visibilità di `allergiesOther` **non è nello schema**: è scritta a mano nel client
(`app/src/pages/Onboarding.tsx:255-266`), perché `showIf` confronta con `equals` e non sa guardare
dentro un array. Il nuovo `intolerancesOther` avrà lo stesso problema: o si estende `showIf` con un
`includes`, o si aggiunge il secondo caso accanto al primo. **La seconda è più onesta della prima
se si va di fretta**, ma va scritto nel commento che sono due casi speciali e non uno.

⚠️ Il `required: true` **non** si tocca sulle pagine con `DietProductsBlock` (vedi la voce di
REGISTRO del 12/8): lì i `fields` non vengono renderizzati e l'obbligo servirebbe solo a tenere
spento «Avanti». Non è il caso di queste due schermate, ma verifica prima di aggiungere obblighi.

---

## 7. E — La ri-domanda alle clienti già iscritte

### 7.1 ⚠️ Non vanno contattate tutte

La decisione iniziale era «mandiamo una notifica a tutte quelle che hanno già fatto il questionario».
Nasceva dal presupposto che il questionario non distinguesse — **e invece distingue**. Mandare a
tutte una domanda a cui hanno già risposto è rumore, e insegna a ignorare le notifiche.

Vanno contattate **solo** queste tre popolazioni, in quest'ordine:

1. **`intolerances` contiene `'other'`** → hanno un'intolleranza che non sappiamo. Sono le più
   urgenti: il dato c'è, dice «altro», e non esclude niente.
2. **`allergies` contiene voci fuori dai 14 codici UE** → allergie a testo libero mai codificate.
   Sono già segnalate da `personal-base` come «allergie da codificare a mano»: la lista si ottiene da
   lì senza inventare una query nuova.
3. **`allergies` vuote E `intolerances` vuote E questionario completato** → non sappiamo se è «non ne
   ho» o «ho saltato la pagina». Sono quelle per cui serve `allergieDichiarateIl`.

Per le altre basta valorizzare `allergieDichiarateIl` con la data del questionario: hanno risposto,
il dato è buono, non si disturbano.

⚠️ **Prima di lanciare qualsiasi cosa, conta.** Se la popolazione 3 sono 280 clienti su 315, non è
una campagna: è un difetto del questionario da correggere prima. Lo script parte in sola lettura.

### 7.2 Il flusso in chat con Gaia — cosa riusare

Il modello da copiare **non** è «Conosciamoci» (che non è una conversazione: è l'attivazione del
piano di prova, `commerce.service.ts:412`). Il modello è **`data-inizio-chat`**, il dialogo guidato a
due passi:

- Logica pura: `backend/src/menu/data-inizio-chat.ts` (`StatoDataInizio { passo, tentativi }`).
- Servizio: `backend/src/menu/data-inizio-chat.service.ts`, con `apriDaTesto()` / `avanza()` che
  ritornano `{ testo, stato, esito }`.
- **Lo stato vive nel `meta` dell'ultimo messaggio di Gaia**, non in una tabella nuova:
  `chat.service.ts:749-774` (`flussiAperti`). ⚠️ Ne può essere aperto **uno solo alla volta**: il tuo
  sarà la terza chiave (`meta.allergie`) e va inserita nell'ordine di precedenza di
  `chat.service.ts:583-600`.
- ⚠️ **Il flusso scade dopo un'ora** (`SCADENZA_FLUSSO_MS`, `sostituzione-chat.ts:238`). Se la cliente
  apre la notifica il giorno dopo, il dialogo **va riaperto, non ripreso**.
- ⚠️ **In chat non esistono pulsanti né opzioni**: le bolle sono testo puro e l'input è libero
  (verificato: zero occorrenze di `quickReply|opzioni|buttons` in `ChatSheet.tsx`, `Assistente.tsx`,
  `chat.service.ts`). Serve un parser tollerante, sul modello di `leggiData`, e la regola dei **due
  tentativi poi passa alla coach**.
- ⚠️ **Si ri-verifica al momento della scrittura, non ci si fida dello stato appeso al messaggio**
  (`data-inizio-chat.service.ts:236-239`): «lo stato appeso al messaggio è vecchio per definizione».

**Apertura proattiva**: copiare `chat.service.ts:697-712` (`avviaSostituzione`) — fa `upsert` del
thread `ai` e fa scrivere a Gaia il primo messaggio. Endpoint sul modello di
`chat.controller.ts:108-120` (POST, non GET, perché scrive). Lato app: `?intent=` in
`app/src/pages/Assistente.tsx:45-63`, **con la guardia anti-doppio** (`intentoAvviato` ref, `:37-39`)
— senza quella, un secondo render fa ripetere a Gaia la stessa domanda.

**La scrittura sul profilo**: modello `sostituzione-chat.service.ts:1331-1342`
(`aggiungiAiNonGraditi`) per la forma semplice, `data-inizio-chat.service.ts:265-319` per quella con
transazione + `audit.log`. Qui siamo su un dato sanitario: **transazione e audit, non la forma
semplice.**

⚠️ **Le risposte arrivano in testo libero** («i latticini», «la frutta secca ma solo le noci»).
Vanno trasformate in codici **proponendo e facendo confermare** — «ho capito *frutta a guscio*,
giusto?» — e **mai salvate come le ha scritte**. Se non si riconosce il termine, va in
`allergiesOther` e lo codifica la nutrizionista: è la stessa regola di
`impara-dalla-chat.ts`, *nel dubbio non si impara*.

### 7.3 La notifica

Non esiste una colonna `deepLink`: si mandano **fatti** nel `payload` e la rotta la compone l'app.

```ts
await this.notifications.notifyOncePerDay({
  userId: clientId,
  type: 'allergie_conferma',
  title: '…',
  body: '…',
  payload: { counterpart: 'ai', kind: 'allergie_conferma' },
  dedupeSuPayload: { clientId },
});
```

⚠️ `title` e `body` **non sono colonne**: vivono dentro `payload`. Scriverli come campi fa esplodere
Prisma a runtime (commento in `senza-glutine.ts:236-238`).
⚠️ `datiPush` passa solo `kind|threadId|clientId|visitId|counterpart` e **solo stringhe**: un numero o
un `null` fa fallire l'invio intero (`notifications/dati-push.ts:35-44`).
Con `counterpart: 'ai'`, `rottaClienteDaNotifica` (`app/src/lib/rottaNotifica.ts:56-65`) porta già a
`/assistente`. Per far partire il dialogo va **estesa quella funzione** perché propaghi `?intent=`.

**«Gliel'ho già chiesto?»**: non esiste un flag generico, e non serve inventarlo. Si usa la notifica
stessa come marcatore, com'è già fatto in `sostituzione-chat.service.ts:1288-1298`:

```ts
const gia = await this.prisma.notification.findFirst({
  where: { type: 'allergie_conferma', payload: { path: ['clientId'], equals: clientId } } as never,
  select: { id: true },
});
if (gia) return;
```
(senza la finestra temporale: qui «già chiesto» è per sempre).

### 7.4 Lo script della campagna

Template da copiare: **`backend/prisma/assegna-senza-glutine.ts`**. Regole non negoziabili, tutte già
scritte lì in testa:

- **Dry-run di default**, scrittura solo con `CONFERMA=1`. Registrare lo script in `package.json`.
- **Riusare la stessa funzione del prodotto**, non riscrivere la logica: «è il modo in cui le
  migrazioni finiscono per creare dati che il codice non si aspetta».
- Saltare chi è già a posto (pattern `gia_assegnata`).

⚠️ E la lezione di `accendi-automazioni.ts`: uno script pensato per accenderne tre ne ha **spente
venti**, perché lavorava a opt-out. Leggere l'output del dry-run riga per riga prima di confermare.

---

## 8. ⛔ F — La visita obbligatoria: NON in questa OTA

Decisione di Simone: intolleranza → nessuna visita; **allergia → visita medica obbligatoria**.
Ma «obbligatoria» meccanicamente non è ancora definita, e resta aperta questa domanda:

> Una cliente **già in piano** che ora dichiara un'allergia: il piano si sospende, o continua mentre
> la visita si prenota?

Finché non c'è risposta, **non implementare nessun blocco**. Il rischio è sospendere piani attivi a
clienti paganti per un campo introdotto oggi.

**Cosa si può fare adesso, senza rischio** — ed è già utile:

1. Un **flag derivato** `richiedeVisita` (allergie non vuote e nessuna visita medica registrata), in
   sola lettura, esposto nella scheda cliente.
2. La cliente **in coda** nella lista della nutrizionista, con il motivo.
3. Nel questionario, il testo che avvisa: *«se hai un'allergia la nutrizionista ti contatterà per una
   visita»* — informativo, non bloccante.

Il blocco, se sarà blocco, si aggiunge dopo, in una consegna sua, quando è chiaro cosa succede a chi
è già dentro.

---

## 9. Ordine di rilascio e collaudo

**L'ordine conta**, e non è quello in cui si scrive il codice:

1. **Migrazione** (`allergiesOther`, `allergieDichiarateIl`) — additiva, nessun dato riscritto.
2. **Backend su Render** — il backend nuovo deve reggere l'app **vecchia**: un client che manda
   ancora `allergiesOther` dentro il vecchio DTO non deve rompersi. Retrocompatibilità obbligatoria.
3. **Backoffice** (Vercel) — le righe in sola lettura.
4. **OTA dell'app** — solo dopo che il backend è in produzione e verificato.
5. **Script della campagna** — per ultimo, in dry-run, e la conferma la dà Simone leggendo l'output.

⚠️ Nessuna OTA prima di una pubblicazione store, e il numero di versione **non si riusa mai**: la
prossima parte da 2.1.8, a lista finita.

**Collaudo minimo, da fare prima di consegnare:**

- [ ] `expandExclusion('frutta_a_guscio')` restituisce le parole della frutta a guscio (test unitario)
- [ ] Le quattro chiavi nuove (`sedano`, `senape`, `solfiti`, `lupini`) si espandono
- [ ] `'altro'` e `'none'` filtrati **lato server**, con test
- [ ] Questionario rifatto **senza toccare** la pagina allergie: le allergie **non** si azzerano
- [ ] Ramo `create` **e** ramo `update` dell'upsert verificati tutti e due, separatamente
- [ ] Una cliente con `allergiesOther` valorizzato blocca ancora la base personale
- [ ] `allergieDichiarateIl` resta `null` per chi non ha risposto, e non blocca nessun piano
- [ ] Type-check del backend **sul Mac** con il client Prisma generato, confronto col baseline
- [ ] Un giro vero in app: notifica → chat → due risposte in testo libero → conferma → profilo scritto

---

## 10. Cosa NON fare

- **Non** scindere all'indietro `allergies` in automatico per le clienti esistenti (§2).
- **Non** rendere le allergie scrivibili da app, backoffice generico o coach (§5).
- **Non** implementare nessun blocco legato alla visita obbligatoria (§8).
- **Non** mandare la notifica a tutte le clienti (§7.1).
- **Non** trattare `allergies: []` come «nessuna allergia» finché non c'è `allergieDichiarateIl`.
- **Non** salvare le risposte in testo libero così come arrivano: si propone e si fa confermare.
- **Non** lanciare lo script senza `CONFERMA=1` letto e voluto, dopo aver riletto il dry-run.
- **Non** usare `as never` sugli enum in un `where`.
- **Non** eseguire comandi git sulle cartelle montate del Mac.
