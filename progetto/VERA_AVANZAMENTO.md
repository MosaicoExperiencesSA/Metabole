# Vera — avanzamento dei lavori

> Rapporto vivo sulla costruzione dell'agente discorsivo della nutrizionista.
> **Si aggiorna a ogni push**, insieme a `progetto/COMMIT.txt` e a `progetto/REGISTRO.md`.
> Specifica di riferimento: `Metabole_Specifica_Vera_Agente_Nutrizionista.md` (radice).
>
> «Vera» è il nome di lavoro. Nel prodotto **ogni nutrizionista chiama il proprio agente come vuole**:
> il nome glielo chiede l'agente stesso al primo incontro, e vive sul suo profilo.

---

## Stato in una riga

**📄 Il passaggio di consegne è in `progetto/HANDOFF_Vera_Sessione.md`** — la chat che ha costruito
Vera si è chiusa il 13/8 perché era diventata troppo lunga. Lì dentro c'è tutto quello che serve per
riprenderla da un'altra sessione: le regole di lavoro, la mappa dei file, le dodici regole che non si
negoziano, le trappole già pagate e le due decisioni aperte.

**Le ricette si dettano.** Azioni 4 e 5: «inseriamo una ricetta per il menu keto» e «voglio cambiare
la ricetta tonno alle olive». Lei scrive il piatto come su un quaderno, i **macro li prende la
tabella nutrienti** (mai inventati: se un alimento non c'è, la ricetta si ferma e il termine finisce
fra quelli da aggiungere), e quello che nasce è una **bozza spenta** che accende il capo. Una
modifica non tocca niente finché non è approvata. Type-check **43 = baseline**, **1733 test**.

**«Aspetta te» adesso si vede dalla home.** Il blocco `b_assistente` sulla home della nutrizionista:
proposte da approvare, domande aperte, sostituzioni da verificare — e il pulsante per aprire
l'assistente. ⚠️ È un **blocco** e non un modulo: i moduli funzionano a inclusione, quindi chi ha già
personalizzato la dashboard non l'avrebbe mai visto.

**Il dizionario non invecchia più da solo.** L'ultimo guasto silenzioso: «formaggi molli» sono nove
nomi spuntati un martedì, entra la burrata e la regola continua a girare **su un elenco vecchio**,
senza nessun errore. Adesso l'assistente se ne accorge e **chiede** — a lei, nella sua chat, quando
non c'è niente di più urgente. Consegna 4 completa. Type-check **43 = baseline**, backoffice pulito,
**1692 test**.

**Consegne 3c e 4: il registro dice chi è stato, e l'assistente non marcisce più da solo.** Il
registro sotto la chat mostra **tutto quello che cambia** sulle sue clienti — lei, Gaia, la cliente
dall'app, il motore — con la colonna «chi è stato». La pagina ha la sua chiave di permesso
(`nutri_assistant`). Una regola confermata sopra un vincolo sanitario **avvisa i capi il giorno
stesso**, il report del mese si apre dalla pagina, e le frasi vere (capite e non capite) diventano il
corpus da rileggere prima di toccare il riconoscitore. Type-check **43 = baseline**, backoffice
pulito, **1670 test** contro 1627.
⛔ Restano `npm run prisma:tipi && npm run typecheck` e `app.module.spec.ts` **nel terminale del Mac**.

**Consegna 3b: le domande che aspettano una nutrizionista.** Il contratto con l'altra sessione
(`CONTRATTO_Vera_Richieste.md`) è implementato: `apriRichiestaVera` è la porta, le domande vivono in
un **elenco** e non solo in chat, e da una risposta escono **due scritture separate**. Type-check 43 =
baseline, backoffice pulito, **1621 test** contro 1603.
⛔ Restano `npm run typecheck` e `app.module.spec.ts` **nel terminale del Mac**.

**Consegna 3a: la coda di Nocanty.** Le proposte «a tutte» adesso si possono approvare — prima non
c'era modo, e restavano ferme. Type-check 43 = baseline, **+20 test** (1603 contro 1583). Nessuna
modifica allo schema, nessuna al frontend: tutti e 9 i file sono dentro `backend/src/vera/`.
⛔ Restano `npm run typecheck` e `app.module.spec.ts` **nel terminale del Mac**.

**Consegna 2 scritta: la chat parla, la pagina c'è.** Type-check 42 = baseline (nessun errore nuovo,
nessuno nei file di Vera), backoffice pulito, **1545 test verdi** contro 1508 — i 37 in più sono i
nuovi. ⛔ Restano `npm run typecheck` e `app.module.spec.ts` **nel terminale del Mac**.

**Consegna 1 fatta e verificata.** Type-check reale sul Mac: **zero errori** coi tipi veri di
Prisma. `app.module.spec.ts`: **verde** — ogni dipendenza di ogni modulo si risolve all'avvio.
38 test nuovi verdi, 1439 in totale. Pronta per la push.

| Consegna | Cosa | Stato |
|---|---|---|
| — | Specifica e verifica sul codice | ✅ **fatta** — 12/8/2026 |
| 1 | Le fondamenta (dizionario, `viewedAt`, pool a vuoto, registro) | ✅ **fatta e verificata** — 13/8/2026 |
| 2 | Vera che parla, due azioni + la pagina | ✅ **scritta** — 13/8/2026 |
| 3a | La coda di Nocanty: approva/respingi, in ordine di rischio | ✅ **scritta** — 13/8/2026 |
| 3b | Le domande che aspettano una nutrizionista (contratto fra le sessioni) | ✅ **scritta** — 13/8/2026 |
| 3c | Registro allargato, citazione, chiave di permesso propria | ✅ **scritta** — 13/8/2026 |
| 4 | Che non marcisca (avviso immediato, rapporto mensile, corpus, dizionario vivo) | ✅ **fatta** — 13/8/2026 |
| — | Azioni a raggio largo (variante, ricette, regola di dieta) e moduli in dashboard | ⬜ in lista Lavori |
| — | Cantiere allergie/intolleranze (a parte) | ⬜ da iniziare |

---

## Consegna 1 — Le fondamenta

Nessuna chat. Utile anche da sola: il controllo del pool serve pure alla pagina Regole motore.

- [x] Migrazione additiva `20260812233000_vera_fondamenta`
- [x] Tabella **dizionario** (`famiglia_alimento`) con promozione a comune
- [x] **`MenuDay.viewedAt`** valorizzato in `getMenu` (unico punto di lettura)
- [x] **Controllo del pool** a vuoto — ⚠️ **non** come menu simulato: vedi sotto
- [x] **Registro** (`azione_vera`) con frase originale e annulla
- [x] 38 test nuovi, 4 file di spec
- [x] ⚠️ Type-check reale **sul Mac**: zero errori · `app.module.spec.ts`: verde
- [ ] Revisore che rilegge prima della push

### ⚠️ Il pool a vuoto NON taglia `deliverIfEligible`

La specifica diceva «taglio alla riga 675 e neutralizza le sei scritture collaterali». Letta sul
codice, quella strada non regge:

- `deliverIfEligible` ha **una quindicina di uscite anticipate** che non c'entrano niente con la
  regola da provare — nessun abbonamento, pausa, piano fermato, misure mancanti, fine piano. Una
  anteprima che risponde «niente» perché la cliente è in vacanza è rumore, e si impara a ignorarlo.
- Le sei scritture collaterali si neutralizzano solo mettendo degli `if` **sul percorso che porta il
  pasto vero nel piatto di domani**, in cambio di un dato che non serve.

La domanda di Vera non è «che menu verrebbe fuori»: è **«quanti piatti restano»**. Si risponde con una
funzione pura sopra il catalogo (`src/vera/pool-disponibile.ts`), che **non può scrivere per
costruzione** — il modo più sicuro perché un'anteprima non salvi niente non è ricordarsi di non
salvare, è non avere Prisma sotto mano. Il pool si costruisce dai `DietDayTemplate` di livello 1 come
fa `buildScoringContext`, e il filtro usa `hitsExclusion` + `recipeHaystack` di `menu/exclusions.ts`:
mai un filtro proprio, o il numero mostrato diventa una stima che diverge dal motore senza errori.

---

## Consegna 2 — Vera che parla, due azioni sole

- [x] La **pagina dedicata** (`/assistente`): chat sopra, registro sotto, stessa schermata
- [x] **Azione 1** — restrizione su una cliente → `dislikedFoods`
- [x] **Azione 2** — sostituzione su una cliente → `FoodSwap`, riga `verificata`, origine `manuale`
- [x] Disambiguazione della cliente (nel perimetro della nutrizionista, mai indovinare)
- [x] Il **dizionario che chiede** invece di indovinare
- [x] Anteprima: regola tradotta **+ controllo del pool**
- [x] Domanda sull'ambito (predefinito: solo per questa cliente; «a tutte» → in approvazione)
- [x] Avviso sui **conflitti con i vincoli sanitari** + conferma registrata
- [x] Il **nome** chiesto al primo incontro (`staff.nome_agente`)
- [x] Tetto a due giri di chiarimento, poi si arrende
- [x] Contenitore **«citazione»** per il testo incollato — fatto nella 3c: quello che è dentro `>`
      o fra `"""` si legge, **non si esegue**
- [ ] ⛔ Type-check reale e `app.module.spec.ts` **sul Mac**

### ⚠️ Il riconoscitore è deterministico, non un modello

`capisci.ts` è una funzione pura con 16 casi di prova. Un modello capirebbe più forme, ma qui la
cosa che conta non è capire tanto: è **sapere quando non si è capito**. E una funzione pura si
collauda con un elenco di frasi vere — che è la sola difesa contro il guasto peggiore, cioè che un
giorno l'agente smetta di capire le frasi che capiva e nessuno sappia dire quando è iniziato.

Il modello (`AiService`, Anthropic, già in casa) può entrare **dopo** e **mai al posto**: quando
`capisci` torna `null`, chiedergli una *proposta* — che resta una proposta, mostrata e confermata
come tutte le altre. La scrittura non cambia mai strada.

### Rimandato di proposito

Il contenitore **«citazione»** per il testo incollato: serve quando l'agente accetta testi altrui, e
oggi l'unica cosa che esegue è ciò che lei scrive di suo pugno in questa pagina. Va fatto **prima**
di dargli in pasto messaggi delle clienti.

Da riusare senza riscrivere: `impara-dalla-chat.ts` (riconoscimento), `common/nomi-alimento`
(confronto per parola con la radice), `registra-sostituzione.ts` (scrittura).

---

## Consegna 3 — Le azioni a raggio largo

- [ ] **Azione 3** — variante di dieta per una cliente (`MenuDay.meals`)
- [x] **Azione 4** — modifica di una ricetta → **non si scrive**: vive nella proposta e diventa vera
      quando il capo approva (quella ricetta è già nei piatti di oggi)
- [x] **Azione 5** — ricetta nuova → in catalogo **spenta** (`active: false`) + proposta in coda;
      ⚠️ macro e calorie **dalla tabella nutrienti**, e se un alimento non c'è la ricetta si ferma
- [ ] **Azione 6** — regola su un tipo di dieta → `EquivalenceGroup(productId)` / `ProductRule` /
      `RuleProposal`
- [x] **Registro allargato**: tutto quello che cambia sulle sue clienti (`AzioneVera` + `AuditLog` +
      `FoodSwap`), fuso in lettura — ⚠️ **nessuna tabella nuova** che le copi
- [x] «**Quello che aspetta me**» sulla pagina dell'assistente (non «quello che ho fatto»)
- [x] **Modulo dashboard**: le stesse cose in cima alla home, per lei e per il capo — sparisce
      quando non c'è niente, invece di dire «zero»
- [x] **La coda di Nocanty**: il suo agente gli sottopone **una proposta per volta**, già istruita
      (chi, quando, la frase originale, cosa comporta), **in ordine di rischio** e non di data;
      ⚠️ **nessuna approvazione in blocco**, e nessun endpoint che la permetta
- [x] Approvare **applica** davvero: la restrizione estesa arriva sulle clienti **di chi ha
      proposto**, in modo idempotente e con un tetto di 200; respingere **richiede un motivo**
- [x] ⚠️ Una nutrizionista **non può approvarsi da sola**: il controllo sta nel servizio, non solo
      nella guardia del controller
- [x] **Modulo dashboard di Nocanty**: è lo stesso blocco — la sua home è quella della
      nutrizionista, e il conteggio delle proposte lo vede solo lui

---

## Consegna 4 — Che non marcisca

- [x] **Avviso immediato** ai capi sulle regole confermate sopra un vincolo sanitario — ⚠️ **non**
      all'autrice, che lo sa già: una notifica per una cosa appena fatta da soli insegna a chiuderle
      senza leggerle
- [x] **Rapporto mensile** (`GET /vera/report`, pulsante nella pagina per il capo): non conta la
      produttività — conta **le righe scavalcate** e **quanto viene annullato**
- [x] **Corpus di prova** dal registro e dalla conversazione (`GET /vera/corpus`): le frasi capite
      (che devono continuare a passare) e quelle no (le parole da insegnare)
- [ ] La spedizione del report il 1° del mese: oggi si apre a mano → in lista Lavori
- [x] **Manutenzione del dizionario**: cosa è entrato in catalogo da quando ha insegnato una parola
      → l'assistente lo chiede, una famiglia per volta, **ultima** dopo le code che hanno qualcuno
      dietro; un «nessuno» sposta la data e la domanda non torna più

---

## Cantiere a parte — Allergie / intolleranze

📄 Istruzioni operative: **`progetto/HANDOFF_Allergie_Intolleranze.md`** (consegnate all'agente della
OTA il 12/8). Va prima della pubblicazione.

- [ ] ⚠️ **`frutta_a_guscio` non si espande** (underscore contro spazi in `ALIAS`/`INTOLERANCE_MAP`)
- [ ] ⚠️ `sedano`, `senape`, `solfiti`, `lupini` senza nessuna espansione
- [ ] ⚠️ `'altro'` e `'other'` salvati come se fossero alimenti (filtro solo lato client)
- [ ] Colonna `allergiesOther` + campo libero `intolerancesOther`
- [ ] `allergieDichiarateIl` + opzione «nessuna» → i tre stati distinguibili
- [ ] Riga «Allergie» in sola lettura: profilo app, scheda backoffice, log modifiche
- [ ] Ri-domanda **solo alle tre popolazioni che servono** (non a tutte): flusso Gaia + notifica +
      script in dry-run
- [ ] ⛔ **Visita medica obbligatoria**: fuori da questa OTA, dipende dalla decisione aperta n.3

---

## Decisioni ancora aperte

1. ⛔ **Priorità** rispetto alla coda attuale (§15.2 C, revoca consenso, i tre vuoti del 12/8)
2. ⛔ **`ai_assistant_enabled`** è `'false'` in produzione: accenderlo è una decisione a sé
3. ⛔ Cliente già in piano che dichiara un'allergia: piano sospeso o visita in parallelo?
4. ⛔ Voce di dizionario promossa a comune: sovrascrive le personali o convivono?

---

## Storico delle push

### 13/8/2026 — Passaggio di consegne (2 file)
`progetto/HANDOFF_Vera_Sessione.md` e tre voci nuove in lista Lavori per le due decisioni che
restano (`vera-variante-cosa-significa`, `vera-esclusione-di-dieta`) e per il documento stesso.
⚠️ La cosa che il documento dice e che questo rapporto non diceva: **l'esclusione a livello di dieta
non esiste nel motore**. Verificato sul codice — le primitive di `menu/exclusions.ts` sono agnostiche,
ma ogni chiamante costruisce le chiavi dal `ClientProfile` e da nient'altro. L'azione 6 non è
agganciare un pezzo che c'è: è aggiungere un concetto al motore che genera i menu di 315 persone.

### 13/8/2026 — Le ricette si dettano: azioni 4 e 5 (10 file)
Lei scrive il piatto come su un quaderno — nome sopra, ingredienti sotto con le quantità, e alla fine
il pasto e il regime — e l'assistente lo legge (`ricetta-dettata.ts`, funzione pura, 12 casi).
⚠️ **I valori non si dettano**: kcal e macro si sommano dalla **tabella nutrienti**
(`macro-da-ingredienti.ts`), che è la stessa da cui Gaia cita i valori alle clienti. Due idee diverse
di «quanto pesa questo cibo» sarebbero due risposte diverse alla stessa domanda fatta da due persone
che parlano fra loro.
⚠️ Se un alimento **non è in tabella la ricetta si ferma**, e non si stima niente: `Recipe.kcal` è
obbligatorio e l'unico modo di riempirlo sarebbe indovinarlo — mentre su quei numeri il motore
calcola le giornate. Il termine mancante finisce in `NutrientLookupMiss`, cioè nell'elenco ordinato
di quali alimenti aggiungere per primi.
⚠️ **La ricetta nuova nasce spenta** (`active: false`): una ricetta attiva entra nel motore, e il
motore non chiede il permesso a nessuno. La accende il capo approvando — e approvare **non** conferma
gli allergeni, che restano una responsabilità sua e separata.
⚠️ **La modifica non si scrive affatto**: quella ricetta è già nei piatti di oggi, e applicarla
subito li cambierebbe stanotte. Vive nel `dettaglio` della proposta e diventa vera all'approvazione,
dove ⚠️ `active` viene tolto dai campi — riscrivere `false` su una ricetta viva la farebbe sparire
dai menu senza che nessuno l'abbia chiesto.
⚠️ Le due approssimazioni sono **dette e non nascoste**: i millilitri contati come grammi, e quello
che non ha un peso («sale q.b.») lasciato fuori dal conto ed elencato.
`fuori_portata` adesso ha **un solo caso** — la regola su un tipo di dieta: quando resterà a zero,
quel tipo va tolto e non lasciato lì a fare da parcheggio.
Verifica: type-check **43 = baseline**, backoffice pulito, **1733 test** contro 1670 (+63).

### 13/8/2026 — «Aspetta te» dalla home (2 file)
Il blocco `b_assistente` in cima alla home della nutrizionista, con quello che aspetta lei:
proposte da approvare, domande aperte, sostituzioni da verificare.
⚠️ **Blocco e non modulo.** I moduli della dashboard funzionano a **inclusione** — chi ha già
personalizzato ha una lista salvata che non può contenere un id nato oggi — quindi proprio chi usa di
più il backoffice sarebbe l'unico a non vederlo mai. I blocchi funzionano a esclusione: si vedono, e
chi non li vuole li spegne da Impostazioni. È la stessa ragione per cui esiste `dashboardBlocksOff`.
⚠️ `home: ['nutritionist']` fa da filtro di ruolo da solo: quella home la aprono `nutritionist` e
`head_nutritionist` e nessun altro. Nessuna mappa di default per ruolo da inventare.
⚠️ Se non c'è niente da fare il blocco **sparisce**, invece di dire «zero»: un riquadro che dice zero
tutti i giorni insegna a non guardarlo. E nessun contatore di «regole create» — quello è una
medaglietta, si guarda due volte e poi mai più.
Nessuna modifica al backend: l'endpoint `/vera/aspetta-me` c'era già.

### 13/8/2026 — Il dizionario che invecchia: l'ultimo guasto silenzioso (7 file)
`famiglieCheForsePrendono` sapeva già rispondere a «questo alimento nuovo riguarda qualche
famiglia?», ma **non la chiamava nessuno**: mancava chi le portasse gli alimenti nuovi. Girata dalla
parte giusta — non «chi si accorge che è nata la burrata», ma «cosa è entrato da quando mi hai
insegnato questa parola» — la domanda si può fare da sola.
⚠️ La fa **l'assistente e non una schermata del catalogo**: chi pubblica una ricetta non sa cosa vuol
dire «molle» per Lucia, e chiederglielo lì vorrebbe dire far decidere a una persona il vocabolario di
un'altra — o, più probabilmente, far premere «avanti».
⚠️ È **ultima** fra le cose che l'assistente porta all'apertura: dietro le altre due code c'è
qualcuno che aspetta (una nutrizionista ferma, una cliente il cui piatto oggi non è filtrato); qui
dietro non c'è nessuno.
⚠️ Il confronto è sulla **parola-testa** («yogurt greco» → *yogurt*), non su una parola qualsiasi in
comune: condividere l'aggettivo non vuol dire essere lo stesso cibo, e una famiglia che si allarga
per un aggettivo comincia a togliere piatti che nessuno voleva togliere. Doppia radice, come
`chiaveLarga`, o «formaggio» e «formaggi» non combacerebbero mai.
⚠️ Un «**nessuno**» scrive lo stesso: sposta la data della voce. Sembra inutile ed è tutta la
differenza fra una domanda e un assillo — senza, la stessa domanda tornerebbe identica a ogni
apertura di pagina, per sempre.
⚠️ Entrano solo i nomi che erano fra i proposti: lì lei sta spuntando da un elenco, non dettando, e
un nome scritto a mano diventerebbe un membro che non corrisponde a nessun alimento vero — non toglie
niente e nessuno saprà mai perché è lì.
Verifica: type-check **43 = baseline**, backoffice pulito, **1692 test** (+22).

### 13/8/2026 — Consegne 3c e 4: chi è stato, e il collaudo che si costruisce da solo (22 file)
**Il registro dice chi è stato.** Sulle sue clienti scrivono in tanti, e quello che le mancava non
era «cosa ho fatto io»: era «cosa è cambiato». `unisciRegistro` fonde `AzioneVera`, `AuditLog` e
`FoodSwap` in un elenco solo con la colonna «Chi» (assistente · Gaia · la cliente · staff · motore).
⚠️ **Nessuna tabella nuova**: una copia va tenuta allineata per sempre, e il giorno che si disallinea
nessuno se ne accorge — un registro sbagliato non produce nessun errore. ⚠️ Solo le righe
dell'assistente sono annullabili da qui: disfare da questa pagina una scelta fatta dalla cliente sul
suo profilo sarebbe disfarla da una schermata che non è la sua. ⚠️ `profile.update` lo scrive **la
cliente dall'app**, `client.update` lo scrive lo staff: confonderli vorrebbe dire attribuire alla
nutrizionista una cosa che ha fatto la cliente, ed è esattamente la domanda a cui quella colonna
serve a rispondere.
**La pagina ha la sua chiave di permesso** (`nutri_assistant`), come chiesto dall'altra sessione e da
Simone il 13/8: con la chiave di `Sostituzioni` le due voci di menu si davano e si toglievano
insieme. ⚠️ La chiave nasce **insieme alla guardia che la legge** — e insieme alla riga
`can('nutri_assistant', 'manage')` nella pagina, che è il posto dove dimenticarsene non produce
nessun errore.
**Il testo incollato è una citazione.** Quello che sta dentro `>` o fra `"""` si legge, non si
esegue: se contiene qualcosa di azionabile l'assistente lo dice e chiede di dettarlo lei. Andava
fatto **prima** di aprire quella porta, non dopo.
**Fuori portata non è più solo un no**: una regola su un tipo di dieta o su una ricetta adesso
**apre una proposta** in coda al capo invece di finire in un messaggio che scende.
**Consegna 4 — che non marcisca.** (1) Una regola confermata sopra un vincolo sanitario avvisa i capi
**il giorno stesso**: la regola si scrive comunque — comanda lei, è un medico — ma di quella riga si
accorge qualcun altro entro sera, perché a fine mese quella cliente ha già mangiato trenta giorni di
menu. (2) Il **report del mese** si apre dalla pagina e **si ricalcola ogni volta**: un report
congelato comincia a mentire il giorno dopo, e chi lo legge non ha modo di accorgersene. Dentro non
c'è quante regole ha scritto ognuna — c'è **quante sono state scavalcate** e **quanto viene
annullato**, che è l'unico numero che dice se l'assistente ha smesso di capire. (3) Il **corpus**:
le frasi capite dal registro e quelle su cui si è fermato, prese accoppiando i messaggi — così
funziona anche sulle conversazioni già avvenute.
⚠️ Tolto un doppione in `voci-iniziali.ts`: le voci di Vera c'erano **due volte** con chiavi diverse
(le due sessioni hanno trascritto le stesse cose), e al primo `carica:lavori` sarebbero diventate
quattro righe doppie in pagina.
Verifica: type-check **43 = baseline**, backoffice pulito, **1670 test** contro 1627 (+43, di cui 30 nei file di Vera).

### 13/8/2026 — Consegna 3b: le domande che aspettano una nutrizionista (16 file)
Implementa `progetto/CONTRATTO_Vera_Richieste.md`. Quando il sistema incontra una parola che **non sa
tradurre** — «Favismo», che oggi non toglie un solo piatto perché non compare in nessun ingrediente —
non inventa e non blocca: apre una domanda. `apriRichiestaVera(prisma, dati)` è una **funzione**, non
un servizio da iniettare, così chi la chiama sta dentro il percorso del questionario senza legarcisi;
**non lancia mai**; ed è **idempotente sulla chiave**, che è ciò che la rende richiamabile da un
lavoro programmato ogni notte senza riempire la coda di doppioni.
⚠️ Le domande vivono in un **elenco** (`richiesta_vera`) e non solo come messaggi: se vivessero solo
nel dialogo, in due settimane sarebbero una chat lunga in cui le cose scendono e nessuno saprebbe più
cosa manca. La stessa ragione per cui è nata la pagina Lavori.
⚠️ **Da una risposta escono DUE scritture, e non si fondono**: gli alimenti sulla cliente (subito, e
**passando da `ClientsService.updateClient`**, il punto unico che controlla il permesso e lascia la
traccia) e la parola nel dizionario di tutte (**proposta in approvazione**, mai scrittura diretta).
Una traduzione clinica data di fretta su una cliente non entra nel vocabolario di tutte.
⚠️ `ClientsService` arriva **per token** e non per `import`: importarlo trascinava mezza applicazione
nel grafo di compilazione e i test di Vera smettevano di girare da soli.
Verifica: type-check **43 = baseline**, backoffice pulito, **1621 test** contro 1603.

### 13/8/2026 — Consegna 3a: la coda di Nocanty (9 file, solo `src/vera/`)
La Consegna 2 sapeva **creare** proposte «in approvazione» e non c'era modo di approvarle: restavano
ferme. Ora il capo apre la stessa pagina e il suo agente gli sottopone **una proposta per volta**,
già istruita, **in ordine di rischio** (prima i conflitti sanitari, poi il raggio largo, poi la più
vecchia). «Sì» approva e applica; «no» **chiede il motivo**, che è obbligatorio — un no senza
spiegazione è la cosa che insegna a smettere di proporre.
⚠️ Approvare è **l'unica azione del progetto che scrive su molte persone in una volta**: il perimetro
è quello di **chi ha proposto** e non di chi approva («a tutte» detto da una nutrizionista vuol dire
«a tutte le mie»), è idempotente, e sopra le **200 clienti** non scrive — dice quante sarebbero e si
ferma.
⚠️ Una sostituzione estesa **non** diventa un gruppo di equivalenza da qui: si scrive la riga
validata e la promozione resta «promuovi a regola», il gesto che esiste già. Una seconda strada per
creare gruppi prima o poi decide in modo diverso dalla prima.
Verifica: type-check **43 = baseline**, **1603 test** contro 1583.

### 13/8/2026 — Consegna 2: la chat, le due azioni, la pagina (13 file)
`capisci.ts` (riconoscitore puro, 16 casi), `vera-chat.ts` (stati e frasi), `vera-chat.service.ts`
(il giro: capisco → chiedo → mostro → aspetto il sì → scrivo), la pagina `/assistente` e la tabella
`messaggio_vera`. Verifica: type-check **42 = baseline**, backoffice pulito, **1545 test** contro
1508.
⚠️ Due difetti della stessa famiglia, trovati dai test: in JavaScript il **confine di parola `\b` è
ASCII**, quindi `perché\b` e `sì\b` non combaciano **mai**. Il primo faceva finire il motivo clinico
(«…perché ha il colesterolo alto») dentro l'elenco degli alimenti da vietare; il secondo faceva
leggere «sì» come «non ho capito» — cioè la risposta più naturale che esista alla domanda
«Confermi?». Rimedio: normalizzare gli accenti prima di confrontare, e per le parole accentate niente
`\b`.

### 12/8/2026 — Consegna 1 scritta (17 file, ~1620 righe)
Migrazione additiva (`menu_day.viewed_at`, `famiglia_alimento`, `azione_vera`), il modulo
`src/vera/` con i tre pezzi — controllo del pool, dizionario, registro con l'annulla — e `segnaVisti`
dentro `getMenu`. `MAIN_SLOTS`/`SLOT_LABEL` spostati in `common/slot-pasto.ts`: la soglia e i pasti su
cui si misura devono essere gli **stessi** con cui la base personale blocca il piano.
Verifica: **type-check 33 errori = baseline** (nessuno nuovo, e nessuno nei file di Vera), **1439 test
verdi** contro 1401 del baseline — i 38 in più sono i nuovi, e le 44 suite rosse sono le stesse di
prima (rumore dello stub Prisma in sandbox).
⚠️ Trovato scrivendo i test: **`chiaveAlimento` non fa combaciare singolare e plurale** («formaggi
molli» → `formagg moll`, «formaggio molle» → `formaggi moll`), perché toglie una sola vocale finale.
Senza rimedio l'agente richiederebbe una famiglia già imparata, e se lei rispondesse nascerebbe una
**seconda voce per la stessa parola**. Rimedio dentro Vera (`chiaveLarga`, seconda passata), **senza
toccare** `chiaveAlimento`: quella la usano le sostituzioni per contare, e renderla più aggressiva
accorperebbe righe che non c'entrano.

### 12/8/2026 — Specifica e verifica sul codice
Il discorso con Lucia diventa un documento. Tre scoperte che hanno ridotto il progetto:
**Vera esiste già in embrione** (`impara-dal-nutrizionista.ts`, scritto lo stesso giorno),
**allergie e intolleranze sono già distinte** (il cantiere è più piccolo del previsto), e
**il dato «menu già visto» non esiste** (`MenuDay.status` non viene mai aggiornato).
Il pool a vuoto non esiste ma è estrazione e non riscrittura: in `deliverIfEligible` non c'è nessuna
`$transaction` e la linea di taglio è la riga 675.
Aggiunte in giornata: la pagina dedicata con il registro sotto, il registro che mostra **tutto**
quello che cambia sulle clienti, i moduli in dashboard («quello che aspetta me») e l'interfaccia di
Nocanty con l'agente che sottopone invece di scrivere.
File: `Metabole_Specifica_Vera_Agente_Nutrizionista.md`, `progetto/VERA_AVANZAMENTO.md`.
