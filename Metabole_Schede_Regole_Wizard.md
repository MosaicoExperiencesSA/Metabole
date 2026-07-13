# MetaboleAI — Schede delle regole (microcopy del wizard "Crea nuovo prodotto")

Il testo che il nutrizionista **legge** mentre crea un prodotto, regola per regola. Linguaggio
semplice, niente tecnicismi. Ogni scheda ha: **titolo**, **cosa fa**, e — per le regole opzionali —
la **domanda di consenso** (Sì/No) con eventuali **parametri**. Le regole di sicurezza sono mostrate
come "sempre attive" (solo presa visione).

Codici allineati a `Metabole_Regole_Motore_Catalogo.md`.

---

## Prima di tutto — Obiettivo del prodotto
**Questo prodotto serve a far dimagrire o a mantenere il peso?**
- *Dimagrimento* — il sistema privilegia i menu che aiutano a perdere peso.
- *Mantenimento* — nessuna spinta al calo: si difende il risultato (es. un prodotto per le vacanze).
> Scegli: ○ Dimagrimento ○ Mantenimento

---

## 1. Regole di sicurezza — sempre attive 🔒
*(Non si possono disattivare: proteggono la persona. Ti chiediamo solo di prenderne visione.)*

**S1 · Ogni prodotto ha i suoi menu.** I menu che inserisci valgono **solo** per questo prodotto e non
si mescolano con altri. Anche se usassi gli stessi piatti di un altro prodotto, qui li reinserisci.

**S2 · Allergie e patologie prima di tutto.** Il sistema non proporrà mai un piatto che contiene un
alimento vietato dalla scheda clinica della persona.

**S3 · Se un cibo è escluso, si sostituisce o si blocca.** Se un ingrediente è escluso, il sistema lo
sostituisce con uno sicuro; se non è possibile, **blocca** quel menu e avvisa te e la coach.

**S4 · Porzioni giuste, niente fame.** Non si tagliano le porzioni per stare sotto un numero: la
persona non deve avere fame.

**S5 · Ritmo sostenibile.** Se il calo è troppo rapido, il sistema ti avvisa.

**S6 · Menu approvati.** Un menu diventa attivo solo dopo la tua approvazione (o del capo).

**S7 · Dati sanitari riservati.** Li vedete solo tu e la persona; non vengono usati per il marketing.

> ☑ Ho letto le regole di sicurezza.

---

## 2. Struttura del piano ⚙️

**E1 · Giornate equilibrate.** Colazione, pranzo e cena vengono bilanciate; spuntini e merende si
tengono d'occhio ma non entrano nel conteggio.
> Attivare? ○ Sì ○ No

**E2 · Menu ogni 2 giorni, cucinati in modo diverso.** Gli stessi menu per due giorni, ma con due
ricette diverse — stessa base, più varietà.
> Attivare? ○ Sì ○ No

**E3 · Numero di pasti.** Quanti pasti prevede questo prodotto?
> ○ 3 ○ 5 ○ Con integratori

**E4 · Stagionalità.** I menu tengono conto della stagione e dell'etichetta caldo/freddo.
> Attivare? ○ Sì ○ No

---

## 3. Valutazioni e apprendimento ⚙️

**L1 · Conta la ricetta più amata.** Il gradimento di un menu è la **stella più alta** tra le sue
ricette (non la media). Finché la persona non vota, si parte da 5 stelle.
> Attivare? ○ Sì ○ No

**L2 · "Hai seguito il menu?"** Ogni mattina si chiede se ha seguito il piano.
> Attivare? ○ Sì ○ No

**L3 · Esito su peso e misure.** A fine ciclo si registra se ha perso, è stabile o ha preso (peso e cm).
> Attivare? ○ Sì ○ No

**L4 · Il sistema impara cosa funziona.** Con l'uso, capisce quali menu aiutano di più quella persona.
> Attivare? ○ Sì ○ No

**L5 · Capire quale pasto fa la differenza.** Quando in un ciclo cambia un solo pasto, il sistema dà
più peso a quel cambiamento per capire cosa sposta i risultati.
> Attivare? ○ Sì ○ No · *(avanzato)*

**L6 · Sceglie i menu più efficaci e più graditi.** Il sistema propone tenendo conto sia dei risultati
sia del gusto.
> Attivare? ○ Sì ○ No · Bilancia: [risultati ⟷ gusto]

**L7 · Composizione automatica della giornata.** Il sistema compone la giornata puntando all'equilibrio
calorico del livello.
> Attivare? ○ Sì ○ No · *(avanzato)*

---

## 4. Comportamento dell'assistente (stati) ⚙️
*(Scegli quali "modi" attivare per questo prodotto.)*

**A1 · Normale.** Propone menu efficaci ma graditi. *(consigliato sempre attivo)*
> Attivare? ○ Sì ○ No

**A2 · Conforto.** Se la persona è giù di morale, propone i menu più amati per tirarla su.
> Attivare? ○ Sì ○ No · Max giorni di conforto: [ 3 ]

**A3 · Rientro.** Dopo un periodo di conforto, torna ai menu più efficaci.
> Attivare? ○ Sì ○ No

**A4 · Prima di un evento.** Prima di un evento in cui non vuole "stare a dieta", propone menu più
proteici per arrivare più leggera.
> Attivare? ○ Sì ○ No · Giorni prima: [ 3 ]

**A5 · Dopo un evento.** Rientro morbido dopo l'evento.
> Attivare? ○ Sì ○ No

**A6 · Stallo.** Se il peso non cala per un po', spinge sull'efficacia e ti avvisa.
> Attivare? ○ Sì ○ No · Dopo quanti cicli fermi: [ 3 ]

---

## 5. Avvisi (a chi segnalare) ⚙️
*(Il blocco di sicurezza e i temi clinici avvisano sempre — 🔒. Qui scegli gli altri.)*

**G2 · Nessun progresso.** Se non ci sono risultati, avvisa te e la coach.
> Attivare? ○ Sì ○ No

**G3 · Poca costanza.** Se la persona salta spesso i menu, avvisa la coach.
> Attivare? ○ Sì ○ No

**G4 · Morale basso a lungo.** Se l'umore resta basso, avvisa la coach.
> Attivare? ○ Sì ○ No

---

## 6. Garanzia di unicità ⚙️ *(avanzato)*

**C1 · Percorso personale e riproducibile.** Ogni persona ha un percorso unico, ricostruibile.
> Attivare? ○ Sì ○ No

**C2 · Nessuna dieta identica a un'altra.** Il sistema controlla e, se serve, cambia per evitare due
piani identici.
> Attivare? ○ Sì ○ No

**C3 · Certificato di personalizzazione.** Ogni ciclo è registrato in modo verificabile.
> Attivare? ○ Sì ○ No

---

## In coda — C'è un'altra regola?
Se ti serve una regola non presente qui, scrivila: la valuteremo e, se approvata, la aggiungeremo per
tutti i prodotti.
> [ campo di testo libero ] → invia proposta

---

## Nota per lo Sviluppo
Ogni scheda = una schermata (o riga) del wizard. Le risposte alimentano `ProductRule` (enabled +
params). Le 🔒 sono sola lettura con presa visione. La proposta va in `RuleProposal`.
