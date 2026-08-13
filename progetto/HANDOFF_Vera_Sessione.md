# Vera — passaggio di consegne a una sessione nuova

> Scritto il 13/8/2026, alla fine della sessione che l'ha costruita (12-13/8), perché quella chat è
> diventata troppo lunga per andare avanti.
>
> ⚠️ **Leggi questo prima di toccare `backend/src/vera/`.** Metà delle scelte che lì dentro sembrano
> strane sono difetti già pagati una volta: rifarle «più semplici» vuol dire ripagarli.

---

## 1. Cos'è Vera, in dieci righe

Lucia è la nutrizionista nuova. Ha chiesto **«un sistema che apprende da me in maniera discorsiva»**:
detta a parole cosa vuole — «a Giulia Rossi non dare più formaggi molli, solo il grana» — e
l'assistente lo traduce in **regole vere** dentro i moduli dell'app.

È una Gaia rivolta all'interno: stessa idea di conversazione, destinatario diverso. Il nome «Vera» è
di lavoro: **ogni nutrizionista chiama il proprio agente come vuole**, e glielo chiede l'agente
stesso al primo incontro (`staff.nomeAgente`).

L'idea che regge tutto: **la chat è un compilatore, non un giudice**. Una frase viene tradotta **una
volta** in una regola strutturata; da lì in poi il motore la applica in modo deterministico. Non c'è
nessun modello che decide, a ogni menu, cosa lei intendeva.

---

## 2. Come si lavora con Simone — le regole di processo

Sono sue, ripetute più volte. Non sono preferenze di stile: sono il modo in cui lui riesce a
seguire il lavoro.

1. **Ogni volta che deve fare una push servono Summary e Description.** Il Summary è il titolo del
   commit, la Description il corpo. Vanno scritti in chat, e messi anche in `progetto/COMMIT.txt`
   (che è in `.gitignore`) così può fare `git commit -F progetto/COMMIT.txt`.
   ⚠️ `COMMIT.txt` il 13/8 è stato sovrascritto **due volte in un'ora** da due sessioni diverse: la
   propria parte va tenuta anche in un file tracciato `progetto/COMMIT_parte_*.txt`, e in `COMMIT.txt`
   si **aggiunge in coda**, non al posto dell'altra.
2. **Con il Summary, il punto della situazione**: dove siamo con Vera, cosa manca. Chiesto
   esplicitamente il 13/8.
3. **`progetto/VERA_AVANZAMENTO.md` si aggiorna a ogni push.** È il rapporto vivo sul progetto: stato
   in una riga, tabella delle consegne, checklist, e lo **storico delle push** in fondo (il più
   recente in cima).
4. **`progetto/REGISTRO.md`**: una voce per push, **in cima** alla sezione del giorno. Formato
   `data · [Team] · area — cosa`. ⚠️ Non si cancella niente.
5. **La pagina Lavori** (`/lavori`, permesso `dev_backlog`): «ogni consegna finisce anche qui: spunti
   quello che hai chiuso e aggiungi quello che hai scoperto e non hai fatto». Le voci nuove si
   aggiungono in `backend/src/lavori/voci-iniziali.ts`; lui pusha, Render riavvia, e poi lancia
   `CONFERMA=1 npm run carica:lavori` (salta apposta tutto quello che esiste già).
   ⚠️ **Chiudere un lavoro è spuntarlo, non cancellarlo.** E non si rilancia `carica:lavori` per
   «riallineare». Il rosso della pagina vuol dire «dietro c'è una fila ferma», mai «urgente».
   ⚠️ Modificare il `dettaglio` di una voce già caricata **non ha effetto**: il caricamento salta le
   chiavi esistenti. Se una voce va corretta, si corregge dalla pagina.
6. **Non si scrive mai direttamente sul suo Mac senza dirglielo**: si produce una patch contro
   `origin/main`, si applica (vedi §7) e si dice cosa lanciare.
7. **Quando lavora un'altra sessione in parallelo, non si toccano i suoi file.** Il 13/8 due sessioni
   hanno lavorato insieme e ci sono state due collisioni vere (`schema.prisma` con tre pezzi persi,
   `COMMIT.txt` riscritto, le voci di Lavori duplicate).

---

## 3. Dov'è il codice

Tutto in **`backend/src/vera/`** (più due file di frontend). Il modulo è isolato di proposito: non
importa `MenuModule` e **non può far fallire l'erogazione** dei menu.

| File | Cosa fa |
|---|---|
| `capisci.ts` | **Il traduttore.** Frase → intento. Deterministico, nessun modello. `null` = «non ho capito», che è una risposta. Contiene anche `separaCitazione` (il testo incollato). |
| `vera-chat.ts` | Stati del dialogo e **tutte le frasi**. Nessun accesso alla banca dati: le parole si correggono senza toccare niente che scriva. |
| `vera-chat.service.ts` | Il giro completo: capisco → chiedo → mostro → aspetto il sì → scrivo. È il file più grande e il più intrecciato. |
| `pool-disponibile.ts` / `.service.ts` | **Il freno.** Quante ricette restano se si esclude questo. Funzione pura sopra il catalogo: non ha Prisma sotto mano, quindi non può scrivere. |
| `dizionario.service.ts` | Cosa vuol dire «formaggi molli» **per questa nutrizionista**. Impara la sua lingua, non la nutrizione. |
| `dizionario-invecchiato.ts` | Cosa è entrato in catalogo da quando ha insegnato una parola. |
| `registro.service.ts` | Il registro, l'annulla, la coda del capo (approva/respingi), il report mensile, il corpus. |
| `registro-allargato.ts` | Fonde `AzioneVera` + `AuditLog` + `FoodSwap` in un elenco solo, con la colonna «chi è stato». |
| `applica-proposta.ts` | Cosa succede quando il capo approva una proposta a raggio largo. |
| `avvisa-capo.ts` | La notifica immediata sui vincoli sanitari scavalcati. |
| `report-mensile.ts` | Il foglio del mese (funzione pura: numeri **e** testo). |
| `corpus.ts` | Le frasi capite e quelle no, per il collaudo. |
| `apri-richiesta.ts` | **La porta per le altre sessioni**: apre una domanda per la nutrizionista. Contratto in `progetto/CONTRATTO_Vera_Richieste.md`. |
| `richieste.service.ts` | L'elenco delle domande aperte e cosa succede quando risponde. |
| `ricetta-dettata.ts` | Legge la ricetta scritta a mano (nome, ingredienti con le quantità, pasto, regime). |
| `macro-da-ingredienti.ts` | Somma kcal e macro **dalla tabella nutrienti**. |
| `scrittura-ricetta.ts` | Il token per scrivere in catalogo (vedi §4.6). |
| `vera.controller.ts` / `vera.module.ts` | Rotte e collegamenti. |

Frontend: **`backoffice/src/pages/Vera.tsx`** (chat sopra, registro sotto) e il blocco
`b_assistente` dentro `backoffice/src/pages/NutritionistHome.tsx`.

Permesso: **`nutri_assistant`** (`view` per leggere, `manage` per dettare) in
`backend/src/permissions/pages.ts`.

---

## 4. Le regole che non si negoziano

Sono il progetto. Se una modifica ne rompe una, non è una semplificazione: è un difetto.

1. **Non si indovina mai.** Zero risultati → lo dico; più d'uno → chiedo. Una frase non capita costa
   dieci secondi per riformularla; una frase capita male costa cibo sbagliato nel piatto di una
   persona. `capisci` restituisce `null` senza vergogna.
2. **Prima di scrivere si mostra**, sempre, anche per la frase facile e anche per la ventesima volta.
   Il giorno in cui una scrittura passa senza anteprima, il registro smette di raccontare cosa è
   successo davvero.
3. **Il freno è il pool.** Prima di ogni restrizione si dice quante ricette restano: «toglie 2
   ricette dalle 40 che aveva: ne restano 38». Se un pasto resta scoperto, si offre un'alternativa
   **che esiste in catalogo** — mai inventata.
4. **Quello che vale per più di una persona nasce come proposta**, e la approva il capo
   nutrizionista, **una per volta**. ⚠️ *Non esiste l'approvazione in blocco*, ed è una decisione
   esplicita di Simone: un «approva tutte» in tre settimane diventa l'unico pulsante che si preme.
5. **La frase originale si conserva per intero.** Non riassunta, non normalizzata. È l'annulla, è
   l'audit, ed è il collaudo (`corpus.ts`).
6. **Un punto di scrittura solo per ogni dato.** Le esclusioni di una cliente passano da
   `ClientsService.updateClient`, le ricette da `CatalogService`. ⚠️ Arrivano **per token**
   (`SCRITTURA_CLIENTE`, `SCRITTURA_RICETTA`) e non per `import`: importarli trascina mezza
   applicazione nel grafo di compilazione e i test di Vera smettono di girare da soli.
7. **I numeri non si inventano.** I macro di una ricetta si sommano dalla tabella nutrienti; se un
   alimento non c'è, **la ricetta si ferma** e il termine finisce in `NutrientLookupMiss`.
8. **Quello che nasce nuovo nasce spento.** Una ricetta attiva entra nel motore, e il motore non
   chiede il permesso a nessuno.
9. **Le approssimazioni si dichiarano.** I millilitri contati come grammi, «sale q.b.» fuori dal
   conto: detto in chat. Un'approssimazione dichiarata è un dato, una nascosta è un errore.
10. **Il testo incollato è una citazione**: si legge, non si esegue. Se contiene qualcosa di
    azionabile, l'agente lo dice e chiede di dettarlo lei.
11. **Se una regola scavalca un vincolo sanitario si scrive lo stesso** — comanda lei, è un medico —
    ma resta segnata e **il capo lo sa il giorno stesso**.
12. **Il modello, se un giorno entrerà, entra DOPO `capisci` e mai al posto suo**: quando `capisci`
    torna `null` può proporre, e la proposta passa dall'anteprima e dal sì come tutto il resto.

---

## 5. Cosa c'è già (tutto in produzione al 13/8)

- **Consegna 1** — dizionario, `MenuDay.viewedAt`, controllo del pool, registro con l'annulla.
- **Consegna 2** — la chat, le due azioni su una cliente (restrizione → `dislikedFoods`,
  sostituzione → `FoodSwap`), la pagina `/assistente`, il nome chiesto al primo incontro.
- **Consegna 3a** — la coda del capo: sottopone una proposta per volta, in **ordine di rischio**;
  approvare **applica davvero** (perimetro di chi ha proposto, idempotente, tetto a 200 clienti);
  respingere **richiede un motivo**.
- **Consegna 3b** — le domande che il sistema non sa tradurre («Favismo»): `apriRichiestaVera`,
  idempotente sulla chiave, non lancia mai. Da una risposta escono **due scritture separate**.
- **Consegna 3c** — il registro allargato («chi è stato»), la chiave di permesso propria, la
  citazione, «fuori portata» che apre una proposta invece di rifiutare.
- **Consegna 4** — avviso immediato sui conflitti sanitari, report mensile, corpus di collaudo,
  dizionario che si accorge di essere invecchiato.
- **In home** — il blocco `b_assistente` con «quello che aspetta te».
- **Azioni 4 e 5** — le ricette: dettarne una nuova (nasce spenta) e cambiarne una esistente (la
  modifica vive nella proposta finché non è approvata).

**219 test** dentro `src/vera/`. Il totale del backend è **1733**, tutti verdi.

---

## 6. Cosa resta — e sono due decisioni, non due compiti

### 6.1 Azione 3 — la variante di piano per una cliente ⛔ decisione di Simone/Lucia

«Creo una variante di dieta per quella cliente» può voler dire due cose molto diverse:

- **(a)** cambiare i **pasti dei giorni futuri** di quella persona, lasciandola sulla sua dieta;
- **(b)** **spostarla** su una dieta diversa o su una variante della sua.

La (b) fa ripartire il piano e cambia tutto quello che ha visto finora; la (a) no, ma non si porta
dietro le regole della dieta nuova. ⚠️ È l'unica azione in cui indovinare male non dà nessun errore:
dà solo un piano diverso da quello che lei voleva.

### 6.2 Azione 6 — la regola su un tipo di dieta ⛔ tocca il motore

«Nella mediterranea non deve comparire più il tonno.» Oggi l'assistente la **riconosce** e apre una
proposta in coda al capo; alla frase risponde onestamente che non la sa ancora applicare.

⚠️ **Verificato sul codice il 13/8: l'esclusione a livello di dieta non esiste.** Le primitive di
`menu/exclusions.ts` sono agnostiche, ma **ogni** chiamante costruisce le chiavi dal `ClientProfile`
e da nient'altro. Finora il divieto per-dieta si è fatto **a mano** creando una dieta variante
(«Mediterranea senza glutine»), e la regola vive come **testo** in `RulePreset.clinicalNotes`, che
nessun codice legge.

Punti dove andrebbe agganciata, in ordine di robustezza:

1. `menu.service.evaluateMeals(clientId, meals)` — il **punto obbligato di ogni erogazione**. Oggi
   non riceve `dietId`: va passato.
2. `menu.service.buildScoringContext` / la costruzione dello `slotPool` — filtro **a monte**, così la
   dieta non propone mai il piatto vietato. ⚠️ Lì oggi si selezionano solo `kcal/macros/seasons`:
   servirebbero anche `name` e `ingredients`.

Contenitore già esistente e utilizzabile **senza migrazione**: `ProductRule` (`{dietId, ruleCode,
enabled, params}`, unique su `[dietId, ruleCode]`) con un `ruleCode` nuovo, letto a parte e non da
`dietRuleOverrides` (che scarta i valori non numerici).

**Decisione già data da Simone (13/8):** «se è per la cliente applica, la regola generale va come
proposta al capo». Interpretazione registrata e non smentita: quando il capo approva, si applica
davvero — con lo stesso freno di tutto il resto (anteprima di quante ricette restano, quante clienti
tocca, e sopra la soglia non si scrive).

⚠️ È l'unico pezzo del progetto che tocca il percorso che porta il pasto nel piatto di domani, su
315 persone. Va fatto con Simone sveglio, non di sera.

### 6.3 Il resto è in lista Lavori

`vera-report-invio-mensile` (il report si apre ma nessuno lo manda il 1° del mese),
`vera-notifica-conflitto-canale` (l'avviso è solo in-app), `vera-ricetta-allergeni`,
`vera-ricetta-crudo-cotto`, `vera-dizionario-cibi-diversi`, `vera-corpus-prima-del-rilascio`,
`vera-modello-seconda-passata`, `vera-dizionario-comune-conflitto`.

---

## 7. Come si verifica e come si consegna

### In sandbox (dove lavora la sessione)

⚠️ Il client Prisma in sandbox è **uno stub**: il numero assoluto di errori di `tsc` non vuol dire
niente, e ~49 suite falliscono a compilare **anche su `main` pulito**. Si guarda solo la
**differenza dal baseline**:

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"     # deve restare 43
npx jest --silent                                            # 0 test falliti, e il totale sale
cd ../backoffice && npx tsc -b                               # deve essere muto
```

Per misurare il baseline vero: `git worktree add /tmp/base origin/main`, si linka
`node_modules`, si rilancia lì. ⚠️ `npx prisma generate` **si pianta** in sandbox e nella VM: non
provarci.

### Sul Mac di Simone (l'unica verifica che vale)

```bash
cd ~/Progetti/Metabole/backend
npm run prisma:tipi && npm run typecheck
npx jest src/app.module.spec.ts
```

⚠️ `app.module.spec.ts` è **l'unico test che vede un modulo senza il suo import**: Nest risolve le
dipendenze all'**avvio**, non alla compilazione. Il 12/8 un modulo senza import ha fatto uscire il
processo con 1 al primo boot su Render, con `tsc` verde e 1794 test verdi.

Per una consegna di solo frontend: `cd backoffice && npx tsc -b`.

### La consegna

1. `git diff --cached --binary > /tmp/patch` contro `origin/main` aggiornato (⚠️ **rebase prima**: una
   patch contro un `main` vecchio cancella il lavoro dell'altra sessione);
2. si manda il file a Simone e lo si scrive sul suo disco;
3. `git apply --check` e poi `git apply` sulla cartella montata;
4. si verificano gli md5 dei file toccati fra sandbox e Mac;
5. si scrive `progetto/COMMIT.txt`;
6. Summary + Description + punto della situazione in chat.

---

## 8. Le trappole già pagate (non ripagarle)

- ⚠️ **`\b` in JavaScript è ASCII.** `perché\b` e `sì\b` non combaciano **mai**. Costo: il motivo
  clinico finito dentro l'elenco degli alimenti da vietare, e «sì» letto come «non ho capito» — cioè
  la risposta più naturale che esista a «Confermi?». Rimedio: normalizzare gli accenti prima di
  confrontare, e per le parole accentate niente `\b`.
- ⚠️ **`chiaveAlimento` non fa combaciare singolare e plurale**: toglie **una** vocale finale, quindi
  «formaggi molli» → `formagg moll` e «formaggio molle» → `formaggi moll`. Nel dizionario si applica
  la radice **due volte** (`chiaveLarga`). ⚠️ Non si tocca `chiaveAlimento`: la usano le sostituzioni
  per contare, e renderla più aggressiva accorperebbe righe che non c'entrano.
- ⚠️ **`combaciaAlimento(nome, termine)` non è simmetrica**: ogni parola del *termine* deve trovarsi
  nel *nome*. «yogurt» prende «yogurt magro», non viceversa.
- ⚠️ **`title` e `body` delle notifiche vivono dentro `payload`**: la tabella non ha quelle colonne, e
  scriverle come campi fa esplodere Prisma a runtime.
- ⚠️ **`git status` sulla cartella montata lascia `.git/index.lock`** e `device_bash` non può
  cancellare: si sposta in `_to_delete/`, altrimenti il git di Simone si blocca.
- ⚠️ **Due sessioni sullo stesso file**: `REGISTRO.md` ha perso voci due volte e `schema.prisma` tre
  pezzi. Si scrive in-place con python e si verifica con `grep`; mai riscrivere un file condiviso da
  una copia in memoria.
- ⚠️ **Le voci di Lavori duplicate**: il 13/8 le stesse cose sono finite due volte con chiavi diverse.
  Prima di aggiungerne, si controlla che non ci sia già la stessa cosa detta in un altro modo.

---

## 9. Documenti da leggere, in ordine

1. **`Metabole_Specifica_Vera_Agente_Nutrizionista.md`** (radice) — la specifica, 17 sezioni.
2. **`progetto/VERA_AVANZAMENTO.md`** — dove siamo, e lo storico di ogni push con il perché.
3. **`progetto/CONTRATTO_Vera_Richieste.md`** — il confine con le altre sessioni.
4. **`progetto/ISTRUZIONI_Pagina_Lavori.md`** — prima di toccare la pagina Lavori.
5. `progetto/Decisioni_Simone_20260812.md` e `..._20260813.md` — le decisioni di prodotto.

---

## 10. Se devi dire una cosa sola a chi riprende

Il valore di Vera non è che capisce tante frasi: è che **sa quando non ha capito**, e che tutto
quello che scrive è passato davanti agli occhi di una persona che ha detto sì. Ogni volta che una
modifica rende l'agente più bravo a indovinare, sta togliendo valore invece di aggiungerne.
