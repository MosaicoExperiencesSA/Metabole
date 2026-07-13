# Metabole — Motore di personalizzazione dei menu (spec)

Come si passa da **un catalogo per dieta** (es. mediterranea) a **una dieta personalizzata per ogni
cliente**, con apprendimento su gradimento ed efficacia. File di riferimento:
`Metabole_Catalogo_Menu_Mediterranea.xlsx` (menu + ricette), `Metabole_Giornate_Mediterranea.xlsx`
(giornate bilanciate), `Metabole_Dieta_Cliente_Giulia_Mediterranea.xlsx` (esempio per-cliente).

---

## 0. REGOLA FONDAMENTALE — isolamento dei menu per prodotto (BLOCCO)

> **Ogni prodotto/protocollo ha il PROPRIO catalogo di menu, separato e indipendente. I menu non si
> mischiano MAI tra prodotti diversi, nemmeno per riferimento.**

- Vale per **ogni** prodotto: dieta Mediterranea, protocolli stagionali (Vacanze in Serenità, Ritorno
  in Equilibrio) e ogni prodotto futuro (es. "gravidanza/allattamento", "proteica", ecc.).
- Se un nuovo prodotto usa **gli stessi piatti o combinazioni** di uno esistente, si esegue comunque un
  **nuovo inserimento completo** di tutti i suoi menu: **si duplicano, non si condividono**.
- I menu li fornisce e li valida il **nutrizionista** (o Antonio). L'AI **non inventa** menu e **non li
  prende in prestito** da un altro prodotto.
- **Modello dati**: ogni menu/ricetta è legato a un `product_id` (o `protocol_id`); **nessun** riferimento
  condiviso e **nessun** join di menu tra prodotti diversi. La duplicazione è voluta.
- **Perché**: tracciabilità, responsabilità clinica per prodotto (ogni menu è approvato nel suo
  contesto), e nessuna contaminazione tra regimi/diete.

## 1. Ingredienti del motore (catalogo per regime)

- **Menu** = la/le pietanze per UN pasto (es. "Pollo con funghi"). Ogni abbinamento diverso = nuovo menu.
- Catalogo diviso per **Pasto** (Colazione, Spuntino, Pranzo, Merenda, Cena) × **Stagione** (Primavera/
  Estate/Autunno/Inverno; "Tutte").
- **Ricette** = i **modi di cucinare** ogni menu (3–5): es. pollo a fettine con funghi trifolati, a
  straccetti al pepe, cosce al forno… ognuna con etichetta **caldo/freddo**.
- Kcal indicative (da CREA) usate **solo internamente** (bilanciamento), mai esposte al cliente.
- Workflow catalogo: bozza → in revisione → **approvata dal nutrizionista capo** → entra nel catalogo.

## 2. Dieta del cliente = catalogo filtrato

Alla scelta del regime, si genera la dieta del cliente partendo dal catalogo approvato e applicando:

- **Esclusioni** (allergie, intolleranze, cibi non graditi — dal questionario): per ogni menu che
  contiene un cibo escluso →
  1. **Sostituzione equivalente** del componente (stessa struttura/kcal): es. `funghi → cavolfiore`,
     latticini → "senza lattosio", una proteina con un'altra della stessa categoria.
  2. Se **non** esiste una sostituzione sicura (es. allergia alla frutta secca in un menu che la
     contiene come cardine) → **l'app si blocca** su quel menu/giornata e apre un'**escalation a coach
     + nutrizionista**, con messaggio al cliente che "non va bene, interveniamo". Non si rimuove in
     silenzio: la situazione viene presa in carico da chi di dovere.
- **Porzioni standard**: non si tagliano le porzioni per stare in un tetto calorico. La cliente **non
  deve avere fame**; il risultato viene dalla qualità/abbinamento dei cibi e dall'adattamento del
  motore, non dalla restrizione.

Il risultato è la **dieta mediterranea di quel cliente** (tabella salvata nella sua scheda sul server).

## 3. Giornate bilanciate

- Una **Giornata** = Colazione + Pranzo + Cena della stessa stagione, con **totale interno più o meno
  costante** (target = mediana dei totali possibili). Serve a comporre giornate equilibrate.
- **Spuntino e merenda**: non entrano nel bilanciamento calorico (liberi), **ma vengono tracciati**
  (gradimento) e fanno parte della giornata.
- **Erogazione ogni 2 giorni, stessi menu**: nel ciclo di 2 giorni si propongono **gli stessi menu**
  (colazione, pranzo, cena) per **entrambi** i giorni, **cucinati in modo diverso** — 2 ricette per
  menu, una per giorno (es. giorno 1 pollo a fettine con funghi trifolati, giorno 2 pollo al forno con
  funghi). Stessa base, varietà nella preparazione. L'esito (peso/cm) si misura a **fine ciclo** (2°
  giorno) e si riferisce quindi a **quella** combinazione di menu, rendendo più pulita l'attribuzione.
  L'agente ragiona e propone su questa cadenza (vedi `Metabole_Agente_AI_Dieta.md`).

## 4. Tracking e feedback (per cliente)

Due livelli (come da decisione): **tabella viva per-menu** + **log eventi**.

**Valutazione (gradimento).** La valutazione è **per ricetta** (modo di cottura). Il valore di un menu
= **la stella più alta** tra le sue ricette (NON la media): se una preparazione è a 5★, è quella da
riproporre. **Default 5★** finché il cliente non valuta. Tra pari stelle, si preferisce la ricetta
che ha fatto **perdere peso/cm**.

**Seguito sì/no.** Dal check-in del mattino: il cliente indica se ha seguito il menu.

**Esito (efficacia).** Attribuito all'**intera GIORNATA** (i pasti *abbinati*, non il singolo piatto),
misurato sul **ciclo di 2 giorni** (finestra di erogazione + aggiornamento misure). Due esiti separati:
- **Esito peso**: perso / stabile / preso.
- **Esito cm** (vita + fianchi): perso / stabile / preso.
Registrato **solo se** "seguito = sì" **e** misure aggiornate nel ciclo; altrimenti *n.d.*.

## 5. Selezione (come sceglie il motore)

Per ogni pasto della giornata:
1. Filtra i menu **approvati** del regime del cliente, per **stagione** corrente, **esclusioni**,
   **n° pasti** scelto.
2. Compone la **giornata bilanciata**.
3. Sceglie la **ricetta migliore** del menu: stelle più alte e/o quella che ha fatto perdere peso/cm;
   per i menu nuovi vale il default 5★.
4. Il cliente può **alternare** le ricette dello stesso menu.

## 6. Apprendimento (learning)

- **All'inizio è "naive"**: attribuisce l'effetto (peso/cm) all'**intera giornata**, perché non sa
  ancora quale pasto pesa di più.
- **Nel tempo isola l'effetto del singolo pasto**: confrontando giornate che differiscono per **un solo
  pasto** (es. stessa colazione e cena, pranzo diverso → si vede se cambia l'esito), il motore aggiorna
  i "pesi" dei singoli menu. Così impara che magari cambiando **solo la cena** o **solo il pranzo** le
  cose cambiano.
- Il segnale combina **efficacia** (peso/cm) e **gradimento** (stelle): alza i menu efficaci e amati,
  abbassa quelli bocciati o inefficaci.

## 7. Blocco & escalation (safeguard)

Quando le esclusioni (o altre condizioni) rendono impossibile comporre un menu/giornata sicuri:
- l'app **blocca l'erogazione** di quel menu,
- crea un **Alert/Escalation** verso **coach e nutrizionista** (`type: diet_blocked`),
- mostra al cliente un messaggio rassicurante ("stiamo sistemando il tuo piano con la nutrizionista").
Questo vale anche quando la sostituzione non è possibile (§2.2).

## 8. Entità server (delta modello dati)

- **DietCatalog / Menu / Recipe(modo di cottura)**: catalogo per regime; Recipe con `serving`
  (caldo/freddo), `steps`; `status` (bozza/in_review/approved).
- **RecipeRating**: `client_id`, `recipe_id`, `stars`, `date`. Il menu eredita **max(stars)** delle
  sue ricette per quel cliente.
- **ClientDiet**: dieta filtrata del cliente (menu personalizzati, con note di sostituzione).
- **DayCombo**: giornata bilanciata (colazione+pranzo+cena) proposta.
- **Erogation / FeedbackLog** (ciclo 2 gg): `client_id`, `date_cycle`, `daycombo_id`, `followed`,
  `delta_weight`, `delta_cm`, `esito_peso`, `esito_cm`.
- **MenuWeight** (appreso): peso/efficacia stimata del singolo menu per il cliente (aggiornato dal
  learning).
- **DietBlock/Escalation**: blocco + presa in carico coach/nutrizionista.

## 9. Visibilità (RBAC)

- **Nutrizionista**: tutto (dieta, esiti, esclusioni, dati sanitari del suo paziente).
- **Coach**: aderenza (seguito sì/no), valutazioni e andamento; **non** i dati sanitari/clinici.
- **Cliente**: la sua dieta e le ricette; non vede kcal né logiche interne.

## 9bis. Garanzia di personalizzazione e unicità (3 meccanismi)

Per poter **certificare** che ogni dieta è personalizzata e che non esistono due diete uguali (non solo
renderlo probabile), il motore integra tre meccanismi. Dettaglio in
`Metabole_Analisi_Motore_Certificazione.md`.

1. **Seme personale + traiettoria stateful.** Ogni cliente ha un **seed** unico; ogni scelta pseudo-
   casuale usa `PRNG(seed_u, stato)` e lo stato è un log **append-only** (event sourcing). La dieta è
   una funzione **deterministica e riproducibile** di un'identità e di una storia uniche.
2. **Vincolo di unicità + collision check.** Ogni piano di ciclo produce una **firma**
   `hash(cliente, menu, ricette, stato, versione_config)`; prima dell'erogazione si verifica l'assenza
   di collisioni con i piani attivi e, se serve, si **ri-genera**. Due diete identiche sono impossibili
   **by design**.
3. **Registro firmato + certificato.** Ogni ciclo è **firmato e registrato in modo immutabile**
   (hash-chain, timestamp) con i fattori che l'hanno prodotto; da qui si emette un **certificato di
   personalizzazione** per cliente, **verificabile** da un auditor (ricalcolo dallo stato).

## 10. In una riga

Un catalogo per dieta → filtrato per cliente (con blocco/escalation se non sostituibile) → giornate
bilanciate a **porzioni standard** → il cliente valuta le **ricette** (si tiene la stella più alta) e le
misure danno l'**esito** (peso e cm) per **giornata/ciclo di 2 giorni** → il motore **impara** quale
pasto pesa e propone i menu più **amati ed efficaci**. Stesso schema per ogni altra dieta.
