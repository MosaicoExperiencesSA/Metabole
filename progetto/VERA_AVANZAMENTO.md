# Vera — avanzamento dei lavori

> Rapporto vivo sulla costruzione dell'agente discorsivo della nutrizionista.
> **Si aggiorna a ogni push**, insieme a `progetto/COMMIT.txt` e a `progetto/REGISTRO.md`.
> Specifica di riferimento: `Metabole_Specifica_Vera_Agente_Nutrizionista.md` (radice).
>
> «Vera» è il nome di lavoro. Nel prodotto **ogni nutrizionista chiama il proprio agente come vuole**:
> il nome glielo chiede l'agente stesso al primo incontro, e vive sul suo profilo.

---

## Stato in una riga

**Specifica chiusa e verificata sul codice. Nessuna riga di codice ancora scritta.**

| Consegna | Cosa | Stato |
|---|---|---|
| — | Specifica e verifica sul codice | ✅ **fatta** — 12/8/2026 |
| 1 | Le fondamenta (dizionario, `viewedAt`, pool a vuoto, registro) | ⬜ da iniziare |
| 2 | Vera che parla, due azioni + la pagina | ⬜ da iniziare |
| 3 | Azioni a raggio largo, registro allargato, dashboard, pagina di Nocanty | ⬜ da iniziare |
| 4 | Che non marcisca (corpus di prova, rapporto mensile, dizionario vivo) | ⬜ da iniziare |
| — | Cantiere allergie/intolleranze (a parte) | ⬜ da iniziare |

---

## Consegna 1 — Le fondamenta

Nessuna chat. Utile anche da sola: il controllo del pool serve pure alla pagina Regole motore.

- [ ] Tabella **dizionario** (famiglia → alimenti, per nutrizionista, con promozione a comune)
- [ ] **`MenuDay.viewedAt`** valorizzato in `getMenu` (unico punto di lettura)
- [ ] **Pool a vuoto**: metodo pubblico estratto da `menu.service.ts`, taglio alla riga 675, sul
      modello di `simulaKcal` + test «la simulazione non salva niente»
- [ ] Neutralizzare le scritture collaterali di `deliverIfEligible` (373, 422-432, 483, 651, 692, 717)
- [ ] **Registro** delle azioni con frase originale e annulla

⚠️ Il rischio del progetto è concentrato qui: le scritture collaterali vanno rese opzionali senza
rompere il percorso vero. Si fa con un revisore che rilegge.

---

## Consegna 2 — Vera che parla, due azioni sole

- [ ] La **pagina dedicata**: chat sopra, registro sotto
- [ ] **Azione 1** — restrizione su una cliente (`dislikedFoods` / `intolerances`)
- [ ] **Azione 2** — sostituzione su una cliente (si appoggia a `FoodSwap`, che esiste)
- [ ] Disambiguazione della cliente (nome e cognome o email, mai indovinare)
- [ ] Il **dizionario che chiede** invece di indovinare
- [ ] Anteprima: regola tradotta **+ controllo del pool** con le vie d'uscita calcolate
- [ ] Domanda sull'ambito («solo per questa cliente o a tutte?», predefinito: solo questa)
- [ ] Avviso sui **conflitti con i vincoli sanitari** + conferma registrata
- [ ] Contenitore **«citazione»** per il testo incollato
- [ ] Il **nome** chiesto al primo incontro (campo sul profilo della nutrizionista)
- [ ] Tetto a due giri di chiarimento, poi si arrende

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
- [ ] **Pagina di Nocanty**: stessa interfaccia, agente che sottopone e non scrive; coda ordinata
      **per rischio**, non per data; ⚠️ **nessuna approvazione in blocco** (deciso 12/8)
- [ ] **Modulo dashboard di Nocanty**: la sua coda + avvisi immediati

---

## Consegna 4 — Che non marcisca

- [ ] **Corpus di prova** costruito dal registro, ripassato a ogni rilascio
- [ ] **Rapporto mensile** a Nocanty (solo ciò che merita attenzione)
- [ ] **Avviso immediato** sulle regole confermate sopra un vincolo sanitario
- [ ] Manutenzione del dizionario quando nasce un alimento nuovo

---

## Cantiere a parte — Allergie / intolleranze

- [ ] Scindere `allergies` da `allergiesOther` (`onboarding.service.ts:321,357`)
- [ ] Riallineare le chiavi inglesi delle intolleranze (`ALIAS` in `exclusions.ts:56-78`)
- [ ] **Visita medica obbligatoria** in caso di allergia (l'unica parte davvero nuova)
- [ ] Ri-domanda alle clienti già iscritte: notifica → chat con Gaia → due domande
- [ ] Stato **«non specificato»** (≠ «nessuna allergia») con freno forte finché non risponde

---

## Decisioni ancora aperte

1. ⛔ **Priorità** rispetto alla coda attuale (§15.2 C, revoca consenso, i tre vuoti del 12/8)
2. ⛔ **`ai_assistant_enabled`** è `'false'` in produzione: accenderlo è una decisione a sé
3. ⛔ Cliente già in piano che dichiara un'allergia: piano sospeso o visita in parallelo?
4. ⛔ Voce di dizionario promossa a comune: sovrascrive le personali o convivono?

---

## Storico delle push

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
