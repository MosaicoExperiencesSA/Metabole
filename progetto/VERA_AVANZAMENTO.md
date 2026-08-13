# Vera — avanzamento dei lavori

> Rapporto vivo sulla costruzione dell'agente discorsivo della nutrizionista.
> **Si aggiorna a ogni push**, insieme a `progetto/COMMIT.txt` e a `progetto/REGISTRO.md`.
> Specifica di riferimento: `Metabole_Specifica_Vera_Agente_Nutrizionista.md` (radice).
>
> «Vera» è il nome di lavoro. Nel prodotto **ogni nutrizionista chiama il proprio agente come vuole**:
> il nome glielo chiede l'agente stesso al primo incontro, e vive sul suo profilo.

---

## Stato in una riga

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
| 3c | Azioni a raggio largo, registro allargato, moduli in dashboard | ⬜ da iniziare |
| 4 | Che non marcisca (corpus di prova, rapporto mensile, dizionario vivo) | ⬜ da iniziare |
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
- [ ] Contenitore **«citazione»** per il testo incollato → rimandato, vedi sotto
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
- [ ] **Azione 4** — modifica di una ricetta → coda
- [ ] **Azione 5** — ricetta nuova → coda, macro dalla tabella nutrienti, mai inventati
- [ ] **Azione 6** — regola su un tipo di dieta → `EquivalenceGroup(productId)` / `ProductRule` /
      `RuleProposal`
- [ ] **Registro allargato**: tutto quello che cambia sulle sue clienti (`AuditLog` + `FoodSwap` +
      `Substitution` in `MenuDay.meals`), con filtri per cliente, tipo e periodo
- [ ] **Modulo dashboard di Lucia**: «quello che aspetta me»
- [x] **La coda di Nocanty**: il suo agente gli sottopone **una proposta per volta**, già istruita
      (chi, quando, la frase originale, cosa comporta), **in ordine di rischio** e non di data;
      ⚠️ **nessuna approvazione in blocco**, e nessun endpoint che la permetta
- [x] Approvare **applica** davvero: la restrizione estesa arriva sulle clienti **di chi ha
      proposto**, in modo idempotente e con un tetto di 200; respingere **richiede un motivo**
- [x] ⚠️ Una nutrizionista **non può approvarsi da sola**: il controllo sta nel servizio, non solo
      nella guardia del controller
- [ ] **Modulo dashboard di Nocanty**: la sua coda + avvisi immediati

---

## Consegna 4 — Che non marcisca

- [ ] **Corpus di prova** costruito dal registro, ripassato a ogni rilascio
- [ ] **Rapporto mensile** a Nocanty (solo ciò che merita attenzione)
- [ ] **Avviso immediato** sulle regole confermate sopra un vincolo sanitario
- [ ] Manutenzione del dizionario quando nasce un alimento nuovo

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
