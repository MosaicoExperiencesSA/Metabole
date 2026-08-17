# Passaggio di consegne — Metabole, notte del 17/8/2026 (terzo turno)

Da incollare in cima a una chat nuova. **Sostituisce** `HANDOFF_2026-08-17_sera.md` (che a sua volta
sostituiva quello del mattino) per tutto ciò che si sovrappone. Tutto quello che c'è qui è verificato
nel codice o nei dati, non ricordato. ⚠️ E dove ci sono numeri di riga: sono stati ricontrollati
stanotte, ma il codice si muove — se non combaciano, ha ragione il codice.

---

## 0. Come si lavora qui (queste regole vengono prima di tutto)

- **Si verifica nel CODICE, non nei documenti.** Stanotte è successo di nuovo: l'handoff della sera
  citava «REGISTRO riga 5268» — numero mai verificato, e sbagliato. Nello stesso paragrafo in cui
  predicava di verificare.
- **Le decisioni si scrivono in un documento PRIMA del codice.** I fogli stanno in `progetto/`.
- **I test nuovi si vedono ROSSI prima**, e dove conta si fa il **controllo per mutazione**: si
  disattiva la riga e si conta quanti test cadono.
- ⚠️ **E si fa rileggere il lavoro da un revisore prima di chiudere la giornata.** Stanotte la
  revisione delle cinque consegne ha trovato **sette** cose, di cui tre serie: un avviso che sarebbe
  scattato su ogni rinnovo, una pulizia che riscriveva campi clinici a nome di chi non li aveva
  toccati, e un buco di sicurezza aperto togliendo `@Roles`. Tutte compilavano e passavano i test.
- **Ogni consegna:** `COMMIT_parte_*.txt` + append a `progetto/COMMIT.txt` + voce in cima a
  `progetto/REGISTRO.md` + **voce in `backend/src/lavori/voci-iniziali.ts`** + Summary/Description in
  chat (la push la fa Simone).
- **File condivisi** (`schema.prisma`, `REGISTRO.md`, `COMMIT.txt`, `voci-iniziali.ts`, `seed.ts`): si
  rileggono dal Mac, mai sovrascritti alla cieca; `REGISTRO.md` e `COMMIT.txt` si scrivono con
  `device_bash` e si **riverificano col grep**.
- ⚠️ **MAI comandi git sulla cartella montata**: lasciano `index.lock` non eliminabili. Se scappa, il
  lock si sposta subito in `_to_delete/`.
- Le migrazioni le applica **Render** al deploy. Il **seed gira a ogni deploy**: una chiave nuova in
  `CONFIG_PARAMS` arriva in `config_param` da sé, non si crea a mano.

### ✅ La CI si riproduce IN SANDBOX, coi tipi Prisma veri

```bash
cd backend
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY=/bin/true \
PRISMA_QUERY_ENGINE_LIBRARY=/bin/true CHECKPOINT_DISABLE=1 npx prisma generate --no-engine
npm run build && npx jest --ci
```
⚠️ **NON** `npm run typecheck` (si pianta sul mirror finto). E i due frontend si compilano davvero:
`cd backoffice && npm run build`, `cd app && npm run build` — la CI fa esattamente quelli.
⚠️ `npx tsc --noEmit -p tsconfig.json` (progetto intero) è **rosso da prima di stanotte** su tre
script in `prisma/` (`approve-diets`, `carica-lavori`, `dedupe-diets`): la CI non li compila, ma chi
lancia quel comando non si spaventi.

---

## 1. Cosa gira adesso

**Il cron del catalogo** — ogni 10 minuti, una settimana per chiamata. Simone: lasciarlo andare senza
fretta. È temporaneo: quando la risposta smette di dire «N clienti su questa famiglia» e comincia a
dire «nessun cliente sopra», il lavoro utile è finito.

**La seconda lettura di Vera** — accesa. `AI_API_KEY` c'è, e l'interruttore `vera_seconda_lettura` lo
scrive il seed al deploy.

---

## 2. Consegnato il 17/8 (sei consegne, tutte pushate)

| # | cosa | voce |
|---|---|---|
| 1 | Il foglio della strada C sulle porzioni | 255 (aperta: tre domande) |
| 2 | Il segnale della giornata sotto il fabbisogno (`daily_kcal_below_target`) | 260 ✅ |
| 3 | Il × dell'annullamento → permesso `cancel_subscription` | 261 ✅ |
| 4 | Le pastiglie dei piani: chi eroga e chi è in coda | 262 ✅ |
| 5 | La matita che avvisa prima di sovrapporre | 259 ✅ |
| 6 | I gusti scritti dalla scheda si ripuliscono | 263 ✅ |
| 7 | **Le correzioni della revisione** (sette rilievi) | 265 ✅ |

Stato finale: **3116 test in 203 suite**, backoffice e app compilati, **nessuna migrazione** in tutta
la giornata.

### ⚠️ Le tre cose serie che la revisione ha trovato — da non reintrodurre

1. **Un avviso che scatta sempre è un avviso che non c'è.** La matita contava il *passaggio di
   testimone* (piano A finisce il 25/08, piano B parte il 25/08) come sovrapposizione — ma quella è
   la coda che `finalizeApproval` costruisce **da sola**, mettendo l'inizio della coda alla fine del
   piano in corso. Sarebbe scattato su ogni rinnovo, anche risalvando la stessa data. Ora **toccarsi
   non è sovrapporsi**, e la sovrapposizione vera comincia dal giorno dopo.
2. **Il form della scheda rimanda TUTTI i campi a ogni salvataggio.** La pulizia dei gusti, applicata
   sempre, riscriveva le intolleranze di una cliente quando una coach correggeva il telefono — e il
   log modifiche lo attribuiva a lei. Ora si pulisce **solo quello che è davvero cambiato**, come già
   facevano `allergies` e `fastingWindow`. È una regola generale di quella funzione: *il permesso, e
   la modifica, valgono sul cambiamento, non sul salvataggio.*
3. **Togliere `@Roles` toglie anche la rete sotto al fail-open.** `PageGuard`, sugli errori di lettura
   dei permessi, tornava `true` «tanto `@Roles` resta applicato» — premessa non più vera su
   `impersonate` e `cancel_subscription`. Un blip del database e una cliente loggata poteva chiamare
   `POST /admin/subscriptions/:id/cancel` (che non verifica proprietà) e annullare il piano di
   chiunque. Ora il fail-open vale **solo se la rotta ha ancora un `@Roles`**; altrimenti chiude.

E le altre quattro: i due avvisi della matita si zittivano a vicenda (ora si chiedono insieme); il
giorno era confrontato in UTC invece che nel fuso aziendale; la scheda coach **in app** ignorava
`avvisiSpezie` come faceva il backoffice; un campo mancava nel tipo di `pulisci-spezie.ts`.

---

## 3. Aperto — e quasi tutto aspetta una decisione di Simone

### 3.1 ⛔ Le tre domande cliniche del foglio delle porzioni (voce 255)
`progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`, in testa: il **tetto** del moltiplicatore (uno solo
o uno per tipo di pasto), **cosa si fa quando il tetto non basta** (la finestra al 45% chiede ×2,22),
e **se scalano tutti allo stesso modo** o i pasti principali più degli spuntini.
Poi: Consegna 2 (il moltiplicatore nel motore) e Consegna 3 (app, lista della spesa, dettaglio
ricetta). ⚠️ Prima di scrivere la Consegna 2 si guarda **quante giornate sono davvero sotto target**:
l'evento `daily_kcal_below_target` esiste dalla sera del 17/8 ed è lì apposta.

### 3.2 ⛔ Le quattro frasi che promettono una cosa che il motore non fa
`app/src/pages/Profilo.tsx:226` (alla cliente), `vera-chat.service.ts:926` e `:992` (Vera a voce),
`schema.prisma:415`. Più il test che pretende la frase (`vera-chat.service.spec.ts:883`) e il commento
in `app/src/lib/spuntiniEsclusi.ts:5`. Non toccate: è **voce di prodotto**, serve il sì sul testo.
La strada C le renderà vere.

### 3.3 ⛔ Le due porte di Vera che scrivono i gusti (voce 264)
`vera-chat.service.scriviRestrizione` (una cliente) e `applica-proposta.applicaRestrizione` (una
**coorte**: un termine sporco si moltiplica su N profili). La domanda è di Simone: **se la
nutrizionista detta una spezia, cosa si fa?** Scartarla in silenzio è il difetto pagato quattro volte;
scartarla dicendolo vuol dire scrivere la frase che Vera risponde; tenerla vuol dire accettare che il
pool si svuoti. Restano anche `substituteDisliked` con `scope: 'forever'` e Gaia (rischio basso).

### 3.4 ⛔ Voce 252: `allergensReviewed` va azzerato quando cambiano gli ingredienti dal backoffice?
Tre strade, decide Simone. Su 315 clienti azzerare sempre toglie dai menu ogni ricetta toccata.

### 3.5 In coda, senza decisioni in mezzo
- **Lo stato `queued`** (voce 258): censimento già fatto, **non rifarlo** — 47 letture di
  `status: 'active'`, 27 solo-active, 15 anche-queued, 5 da decidere, più 5 filtri in memoria.
  ⚠️ Il vincolo in banca dati **non** va nella stessa consegna dello stato.
- **Voce 253**: sei dati che il server manda alla cliente e nessuna schermata mostra. Le prime tre
  sono **pagine nuove**, vanno disegnate.
- **Voce 256**: a Maria la finestra del digiuno non è mai stata chiesta. Va chiesta — dal questionario
  e, per chi c'è già, da Gaia o dalla coach.
- ⚠️ La famiglia **«Digiuno intermittente (16:8)» non ha la variante a 5 pasti** (12 caselle,
  riempibili **senza AI**). Oggi non morde nessuno; morderebbe se una sua cliente passasse a «salto la
  cena».

---

## 4. Da fare dopo il deploy (in quest'ordine)

1. **Dare la spunta del permesso** «Annulla un abbonamento» al capo nutrizionista in pagina Permessi:
   finché non c'è, il × lo vede solo l'admin.
2. **«Aggiorna dal rilascio»** in pagina Lavori (o `CONFERMA=1 npm run carica:lavori`): ci sono sei
   voci nuove del 17/8 da caricare e spuntare.
3. **`npm run pulisci:spezie`** *senza* `CONFERMA`, dalla shell di Render: adesso vede anche i tag con
   più alimenti dentro, quindi l'elenco sarà più lungo di quello dell'8/8. Poi, se convince,
   `CONFERMA=1`.
4. Guardare `analytics_event` per `daily_kcal_below_target`: è il numero da cui parte la Consegna 2.
5. ⚠️ Il workflow **«pages build and deployment»** (GitHub Pages di `docs/`) risultava rosso: **non è
   la CI** (`ci.yml`). Da controllare se era rosso anche nei push precedenti — dal sandbox i log delle
   Actions non si leggono (`gh` non c'è e serve autenticazione).

---

## 5. I numeri, per non rifare le stesse domande

- **306 diete** in catalogo; con qualcuno sopra: **16**, per **25 clienti**, in **12 gruppi** di
  ricette. Tutti `dimagrimento`, 11 su 12 `omnivore`.
- **7 clienti in digiuno**: 5 «salta colazione» (100% delle kcal), 1 «salta cena» (Sonia: pasti giusti
  dal 17/8, **65%** delle calorie), 1 senza finestra (Maria).
- Le percentuali delle finestre — **contate, non stimate**, e ricontrollate in revisione:
  100% · 65% · 65% · 55% · 45%; spuntini tolti da Vera: 80% (due) e 90% (uno).
- ⚠️ **Aggiungere giornate NON aggiunge varietà**: il motore prende le ricette e ricompone. Quello che
  una cliente percepisce è *quante ricette diverse ha ogni pasto*.

---

## 6. Il difetto di famiglia, e il suo corollario

**«Un dato che agisce e non si vede.»** Pagato nove volte. E il corollario, che stanotte è tornato
tre volte: **se due punti rispondono alla stessa domanda, uno dei due deve chiamare l'altro** — il
motore e `diag:digiuni` sul digiuno, la soglia kcal, `staErogando` per le pastiglie. Ogni consegna
della serata ha riusato la funzione che c'era invece di scriverne una seconda.

E quello nuovo, dalla revisione: **un avviso che compare sempre non è un avviso.** Vale per il 409
della matita, e varrà per qualunque cosa si aggiunga alla Consegna 2.
