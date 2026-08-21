# Metabole — passaggio di consegne

**Scritto il 21/8/2026 all'01:00, aggiornato alle 09:00 quando Simone ha fermato i lavori per
passare il testimone.**
Per chi prende in mano il lavoro dopo di me. Leggi tutto prima di toccare qualcosa: metà di questo
file è **cosa ho sbagliato**, e serve più dell'altra metà.

---

## 1. Il progetto in dieci righe

App di dimagrimento. Backend **NestJS + Prisma + PostgreSQL**, due frontend React: `app/` per le
clienti, `backoffice/` per lo staff.

- **Neon** (Postgres, Francoforte) · **Render** (backend) · **Vercel** (frontend) · **Brevo** (email)
- Il repo è `MosaicoExperiencesSA/Metabole`, ramo `main`, deploy automatico su push.
- Le migrazioni e il seed girano nel `preDeployCommand` di `render.yaml`, **a ogni deploy**.

I documenti che contano: `CLAUDE.md` (le regole di progetto), `progetto/REGISTRO.md` (il diario, si
aggiunge **in cima**), `progetto/COMMIT.txt` (si **appende**, mai si sovrascrive).

---

## 2. Come si lavora con Simone — le regole che non si negoziano

Queste non sono preferenze: ognuna è nata da un danno.

1. **Non committo e non pusho io.** Preparo i file, glieli mando, lui pusha da GitHub Desktop. Io
   fornisco **Summary + Description** già scritti.
2. **Mai comandi git sulla cartella montata del Mac.** Lascia un `index.lock` che poi non si toglie.
3. `progetto/COMMIT.txt` si **appende**; `REGISTRO.md` si **prepende**. Ogni consegna ha anche il suo
   `COMMIT_parte_<argomento>.txt`, perché due sessioni che scrivono insieme si sovrascrivono.
4. **Chiavi e stringhe di connessione mai nel repo né in chat.** Vanno nei pannelli Render/Neon/Brevo.
5. **Mai l'email di una cliente in un file versionato.**
6. Le migrazioni le applica Render, mai il Mac.
7. `device_bash` **non cancella file**: si spostano in `_to_delete/`.
8. **Ogni pagina nuova del backoffice ha una chiave di permesso sua** — tre passi obbligatori, sono
   scritti in `CLAUDE.md`.
9. Se una consegna tocca `app/` o `backoffice/`, si lancia il **vero** `npm run build`
   (`tsc -b && vite build`). `vitest` e `tsc --noEmit` **non** sono quel controllo: il 20/8 ho rotto
   la build del backoffice così, e il costo l'ha pagato lui, tre volte, prima che capissi.
10. E da stasera: **`npx jest --clearCache` prima del run finale**. Una cache vecchia mi ha fatto
    dichiarare verde una suite che verde non era.

### Il rito della consegna

`tar` dei file → `SendUserFile` → `device_commit_files` sul Mac
(`/Users/simonesalogni/Progetti/Metabole`) → `tar xzf --overwrite` dentro
`$HOME/mnt/Progetti--Metabole` → **md5 dalle due parti** → tarball in `_to_delete/`.
Il confronto md5 non è cerimonia: il ponte col Mac cade, ed è già successo.

---

## 3. Il metodo, che è la cosa più importante di tutte

**Misura prima di decidere, e non spacciare mai un ragionamento per una misura.**

Il 20/8 ho violato questa regola **cinque volte**, e ogni volta è costato:

- Ho detto che gli stati `liquido` e `fresco` non erano riconosciuti e ho cambiato 55 righe di un
  foglio. `normalizzaStato` li riconosce entrambi. Il mio stesso controllo aveva segnalato 21 righe
  e io ne avevo dichiarate 201. **Avevo ragionato invece di leggere l'esito.**
- Ho scritto in un commento che quattro alimenti «vengono saltati, è il comportamento giusto, non una
  fortuna». Non era vero: l'avevo **dedotto dall'ordine degli elenchi**. La prova a vuoto ha mostrato
  l'opposto.
- Ho scritto «da 11 a 9 voci aperte» in un messaggio di commit **senza ricontarle**. Erano 11.
- Ho dichiarato buono un foglio di 245 alimenti perché un controllo di coerenza ne segnalava una.
  173 righe su 245 erano **copiate**. Il controllo non aveva sbagliato: guardava una riga per volta.
- Ho accusato il seed di **falsificare una firma**. La firma era legittima, e il perché era scritto
  quaranta righe sopra quella che avevo letto. Stavolta l'accusa era al lavoro di una persona.

Se prendi una sola cosa da questo file, prendi questa: **quando stai per scrivere «quindi
succede X», fermati e chiediti se l'hai letto o se l'hai dedotto.** Se l'hai dedotto, dillo, o vai a
misurarlo.

### Gli strumenti che funzionano

- **Test a mutazione.** Non basta che il test sia verde: si rompe il codice apposta e si guarda se
  diventa rosso. Oggi **quattro mutazioni non hanno morso**, e ogni volta il test sbagliato ero io
  (un `find` dove serviva un `filter`, un permesso dato a un file che valeva per tutti…).
- **Test che leggono il sorgente**, quando il difetto non sta dentro una funzione ma nei punti che la
  copiano: `una-porta-sola.spec.ts`, `il-giorno-si-chiede.spec.ts`, `perimetro-una-porta-sola.spec.ts`,
  `giornata-in-tre-forme.spec.ts`, `chiave-e-una-parola.spec.ts`.
- **Le diagnostiche `npm run diag:*`**: leggono e basta, non scrivono. Ce ne sono una trentina. Ogni
  decisione irreversibile dovrebbe avere il suo numero prima.
- **La prova a vuoto** su ogni script che scrive: `CONFERMA=1` per scrivere davvero. Ha fermato un
  import che avrebbe rovinato la tabella degli alimenti.

### Le regole di casa che tornano di continuo

- *Un dato che agisce e non si vede.*
- *Se due punti rispondono alla stessa domanda, uno dei due deve chiamare l'altro.*
- *Un avviso che compare sempre non è un avviso.*
- *Una ragione falsa è peggio di un ordine sbagliato.*
- *«Non lo so» deve costare meno di «ho indovinato».*
- *Il verde non è una riga sola.*
- *Un test double che si comporta diversamente dall'originale non verifica niente.*
- *Niente tagli silenziosi: se si scarta qualcosa, si dice quanto.*

---

## 4. Dove siamo

### In volo, da non dimenticare

**Consegne 78 e 79** sono scompattate sul Mac in `~/Progetti/Metabole`. Verifica su GitHub se sono
state pushate: quando ho passato il testimone la 78 era pronta e la 79 appena consegnata.

- **78** — la correzione del seed (non azzera più i campi che non ha) + tre file di test del fuso
  sistemati + la voce Lavori riscritta.
- **79** — l'elenco Lavori allineato con tre voci nuove.

Il Summary e la Description di ognuna stanno nel loro `progetto/COMMIT_parte_*.txt`.

⚠️ Nel container ci sono **276 file modificati** rispetto a `origin/main`: è normale, è la mia copia
di lavoro e non è la fonte. La fonte è il Mac.

### ⛔ I test hanno il difetto del fuso — LA COSA PIÙ URGENTE

**✅ E c'è la prova, arrivata da sola la mattina dopo.** La stessa suite, senza toccare una riga:

    00:02 di Roma  →  13 test rossi in 6 file
    08:45 di Roma  →  4144 test verdi su 4144

Non è una modifica ad averla rotta: **è l'ora.** E questo la rende più insidiosa di come l'avevo
descritta — *un difetto che si ripara da solo alle 02:00 non verrà mai indagato da chi lo incontra
alle 09:00.*

Alle **00:02 di Roma** la suite era diventata rossa: 13 test in 6 file, tutti con una differenza di
**esattamente 86.400.000 ms**.

I test calcolano «domani» con `setHours(0,0,0,0)` o `new Date().toISOString().slice(0,10)` — il
giorno **UTC** — mentre il codice, curato durante la giornata, risponde col giorno di **Roma**. Fra
mezzanotte e le 02:00 le due risposte differiscono di un giorno.

**La suite è verde 22 ore su 24 e rossa 2.** Se un deploy capita in quella fascia, la CI fallisce
senza motivo apparente. È il difetto che abbiamo passato la giornata a togliere dal codice, rimasto
**dentro i test che lo verificano**.

✅ Corretti: `coach-tasks/apri-attivita`, `menu/sostituzione-chat.service`, `nutritionist/nutritionist.service`.
⛔ **Restano tre file**: `privacy/privacy.service`, `menu/data-inizio-chat.service`,
`coach-tasks/compiti-prova-in-coda`. Non li ho toccati di proposito: sono test su date con fixture
intrecciate, era l'una di notte, e **rendere verde un test in fretta è il modo di fargli smettere di
verificare**.

La correzione è sempre la stessa: il test deve chiedere il giorno **alla stessa porta del codice**
(`aGiorno`, `giornoLocale`, `toDateOnly` in `src/common/date-only.ts`), non ricalcolarselo.

### Gli alimenti — dove siamo arrivati

La giornata è stata quasi tutta qui. Riassunto onesto:

1. Un foglio di 245 alimenti è arrivato con **173 righe copiate** (99 alimenti diversi tutti a
   «25 kcal, 1,5, 3,5, 2,5, 0,3, 2,2»). Il mio controllo Atwater ne aveva vista **una**, perché
   guarda una riga per volta e una riga vera copiata resta coerente con sé stessa.
   → è nata `src/nutrient-facts/gemelli-alimenti.ts`, che raggruppa per valori identici e distingue
   «pomodoro fresco / pomodori freschi» (lo stesso alimento, passa) da «tahina / peperone rosso»
   (riempimento, ferma).
2. Simone ha rifatto le 173 righe. Il foglio nuovo è passato a **sei controlli** invece che a uno.
   **Zero riempimenti.**
3. L'import è andato: **286 alimenti hanno la riga a crudo**. Due cose sono rimaste storte e sono
   state riparate con `npm run ripara:alimenti` (stato di «carota», e undici doppioni).
4. Il seed cancellava i campi che non ha (`state: r.state ?? null`) — corretto nella 78.

**✅ CHIUSO il 21/8 mattina, e la mia ipotesi era sbagliata.** Nella pagina Alimenti `limone`,
`cipolla`, `brodo vegetale`, `spinaci freschi` risultavano «Non in tabella» anche dopo l'import, e
Simone ha chiesto *«stiamo perdendo pezzi invece di farli?»*. **Nessun pezzo perso.**
`aggiornaIngredientiScoperti` è un **passo notturno** che *scrive* l'elenco in `nutrient_lookup_miss`;
la pagina legge quelle righe, non un calcolo dal vivo. L'import è girato alle 19:43, il passo
notturno non era ancora passato — e infatti `diag:crudo-cotto`, che calcola dal vivo, quei quattro
non li segnalava già più. ⚠️ Il meccanismo che chiude un termine risolto **esiste già** dal 20/8: la
mia ipotesi («le domande vecchie non si chiudono mai») era falsa, verificata sul codice prima di
scriverla. ⛔ Quello che manca è **una riga di testo**: la pagina non dice **di quando** è l'elenco.
Voce `alimenti-da-correggere-senza-data`.

**⚠️ Aperto:** undici alimenti hanno perso lo stato che il foglio aveva compilato (il seed lo
azzerava). I valori ci sono ancora in `prisma/dati-alimenti-20-8.ts`: burro `crudo`, mandorle `secco`,
noci `secco`, mela `cruda`, pera `cruda`, fragole `crudo`, avocado `crudo`, parmigiano `fresco`,
miele `crudo`, pane integrale `secco`, ricotta `fresco`. Si rimettono con uno script **con prova a
vuoto**. Su olio e miele no: lì la risposta è «non si applica» e la scrive una persona.

### L'elenco Lavori

**14 aperte, 1 bloccante, 128 chiuse.** Vive in `src/lavori/voci-iniziali.ts` e si carica con
`CONFERMA=1 npm run carica:lavori`.

⚠️ **Simone si è lamentato, con ragione, che le voci aumentavano invece di chiudersi.** Tre di quelle
che avevo aperto non erano lavori: erano cose che potevo decidere io. **Prima di aprire una voce,
chiediti se è una decisione di prodotto o se stai solo delegando una scelta che ti compete.**

Le undici aperte, per chi le deve leggere:

| chiave | cosa aspetta |
|---|---|
| `whatsapp-numero` | il numero, a settembre |
| `coda-da-validare-b-c` | il numero di Nocanty (di quanto si alzano le calorie) |
| `percentuale-obiettivo-punti-rimasti` | la nutrizionista (`kgToLose` è clinico) |
| `tabella-alimenti-igiene` | olio/miele/sale/zucchero → «non si applica», dopo il fix del seed |
| `ricalcolo-e-tetto-mensile` | una decisione di Simone: il ricalcolo ripaga quello che il tetto aveva tolto? |
| `che-giorno-e-oggi-trenta-punti` | la metà grossa: il giorno di una data **salvata**. Ha il via libera |
| `seed-nutrienti-firma-falsa` | corretta nella 78, resta da rimettere gli undici stati |
| `esclusioni-chiave-dentro-parola` | leggere l'elenco raggruppato di `diag:esclusioni`, parola per parola |
| `pipeline-due-schede-indietro` | il rinnovo riporta la scheda indietro: regola candidata nel docblock |
| `clienti-senza-numero-di-pasti` | 17 su 56 senza pasti → nessuna dieta scelta. Quante hanno un piano attivo? |
| `chi-vede-tutte-le-clienti` | decisione: marketing vede tutte le clienti o no? |
| `test-col-difetto-del-fuso` | **bloccante** — 8 test rossi in tre file, fra mezzanotte e le 02:00 |
| `alimenti-da-correggere-senza-data` | una riga: dire di quando è l'elenco |
| `digiuno-pubblicazione` | aperta **prima di misurare**, e lo dichiara |

---

## 4-bis. Il digiuno intermittente — dove sono arrivato prima di fermarmi

Simone voleva pubblicarlo, ha chiesto di allineare prima la lista, e poi ha fermato i lavori. Ho
fatto in tempo a **leggere tutto il sottosistema**, e questo è quello che ho trovato — serve a chi
riprende, perché la conclusione è controintuitiva.

**Il motore c'è già, e più di quanto pensassi.** Le cose fatte, tutte con la loro voce chiusa:

- **il catalogo servito lo sceglie la FINESTRA**, non il tipo di percorso (`catalog/struttura-per-digiuno.ts`,
  17/8). Prima chi sceglieva «salta la cena» riceveva **un pasto al giorno** — una cliente vera l'ha
  subìto senza che nessun controllo lo segnalasse: la rete di sicurezza impediva la giornata *vuota*,
  non quella *monca*;
- **le porzioni si scalano sul fabbisogno** (`menu/porzione-scalata.ts`, 18/8, strada C decisa da
  Simone). Chiude il buco delle calorie: chi saltava la cena riceveva il 65% del suo fabbisogno;
- **la finestra si chiede** quando manca: si apre un'attività alla coach invece di indovinarla;
- le varianti a 3 pasti e digiuno sono generate per le famiglie esistenti;
- lato app la finestra si sceglie dal Profilo, e il percorso è già nell'onboarding.

Le tabelle e i ragionamenti stanno in `progetto/NOTA_Digiuno_E_Riempimento_Varianti.md`, che è scritto
bene e va letto prima di toccare qualsiasi cosa.

**⛔ Tre cose restano dichiarate come NON risolte**, e sono le candidate a essere «quello che manca»:

1. **La variante `fasting` del catalogo è di fatto «salta la colazione»**, e nessun campo lo dice.
   Oggi non fa danni perché la finestra dirotta sul catalogo giusto, ma è **un nome che mente**.
2. **Le porzioni sui cibi «a pezzo»**: ×1,5 di una mela è una mela e mezza. Il modulo *dichiara* di
   non aver preso quella decisione — va presa con la nutrizionista.
3. **Le varianti digiuno sono davvero approvate e complete?** Non lo sa nessuno: è il primo dei tre
   numeri qui sotto.

**⚠️ E la domanda vera è rimasta senza risposta: cosa vuol dire «pubblicare».** Gliel'ho chiesta con
quattro opzioni (metterlo in vendita / approvare le varianti / chiudere i tre punti / accenderlo per
chi ce l'ha già) e lui ha fermato i lavori prima di rispondere. **Non tirare a indovinare: chiediglielo.**
A seconda della risposta il lavoro è completamente diverso.

**I tre numeri da avere prima di scrivere una riga di codice** (leggono e basta):

    npm run diag:catalogo     quante varianti digiuno sono approvate e complete
    npm run diag:digiuni      quante clienti sono già in digiuno, e con che finestra
    npm run diag:kcal         quante giornate escono sotto il fabbisogno

---

## 5. Le tre cose da fare, in ordine

1. **I tre file di test del fuso** (`privacy`, `data-inizio-chat`, `compiti-prova-in-coda`). Finché
   ci sono, ogni deploy fra mezzanotte e le 02:00 fallisce. È l'unica voce **bloccante**.
2. **Gli undici stati da rimettere** agli alimenti (burro `crudo`, mandorle `secco`, …), con prova a
   vuoto. I valori sono in `prisma/dati-alimenti-20-8.ts`.
3. **Il digiuno**, ma solo dopo aver chiesto a Simone cosa intende per «pubblicare» e aver preso i
   tre numeri della sezione 4-bis.

E prima di tutto: **verificare che 78 e 79 siano state pushate.**

---

## 6. Una cosa sul tono

Simone lavora fino all'una di notte su questo prodotto e legge tutto quello che gli mandi. Merita:

- **il verdetto in due righe, subito**, e i dettagli dopo. Stasera gli ho detto «dammi dieci minuti»
  invece di dirgli quello che avevo già visto, e lui ha lanciato un `CONFERMA=1` che potevo fermare;
- **i comandi scritti per intero**, una riga per volta, copiabili. Due volte è partito un comando
  monco perché gliel'avevo scritto a pezzi;
- **che gli errori si dicano prima che li scopra lui.** Ogni volta che ho sbagliato e l'ho scritto
  chiaro, il lavoro è andato avanti. Le volte in cui ho lasciato che lo scoprisse lui, abbiamo perso
  un'ora.

Non cancellare una voce sbagliata: **riscrivila dicendo che era sbagliata.** Una voce sbagliata
cancellata è una voce che qualcun altro riscriverà uguale.
