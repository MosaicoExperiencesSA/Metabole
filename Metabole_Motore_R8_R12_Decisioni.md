# Metabole — Motore R8–R12: risposte alle decisioni aperte (per Simone)

Risposta al tuo `Metabole_Motore_Piano_R8_R12.md`. Ho verificato la mappatura sullo schema: **è corretta**. `CycleFeedback` (peso/cm separati + `followed`), `RecipeRating`, `MenuWeight` (per ricetta), `EngineDecision`/`Protocol`, `Escalation`, `ProductRule` esistono; `ClientProfile` ha `intolerances[]`+`dislikedFoods[]` ma **non** `allergies`; mancano `EquivalenceGroup`, `ClientCycle`, `ClientMenuPool`. Confermo la tua diagnosi.

Sotto, le decisioni sulle 5 domande di §6 + via libera a §7. Dove è strategia pura lo segnalo (Antonio può ritoccare), il resto è deciso.

---

## D1 — Confini A/B (Agente vs motore giornaliero) → **DECISO: B nuovo servizio, A resta il guardrail**
La tua lettura di §2 è quella giusta e la adottiamo: **l'Agente di percorso (B, R8–R12) genera e adatta il menu**; il **motore a protocolli (A, `EngineDecision`+`Protocol`) resta il guardrail clinico di sicurezza**. Non si fondono.
- Prima di erogare un ciclo, B **consulta A**: se scatta una condizione di sicurezza (screening, calo troppo rapido, segnale critico), **B non decide** e si apre `Escalation` → il ciclo è messo in pausa/presa in carico.
- A non compone menu; B non scavalca A. Confini netti = responsabilità clinica chiara. Coerente con R8 (blocca+escala) e R12.

## D2 — Gruppi di equivalenza (R4) → **DECISO: modello dedicato `EquivalenceGroup`, di proprietà del nutrizionista**
Non convenzione sui tag. Motivo: le sostituzioni R8 sono **safety-critical** (sostituire un allergene con l'alimento sbagliato è un rischio clinico), quindi servono un dato **interrogabile, versionato e approvato**, non un tag libero.
- Modello: `EquivalenceGroup` (`id`, `name`, `productId?` o globale, `members` = lista alimenti/`recipeId`/ingredienti, `status` draft→approved, `version`). Popolato e approvato dal **nutrizionista dal backoffice**, stesso workflow del catalogo.
- **Seed di partenza pronto**: i **23 gruppi** già scritti in `percorsi/keto/regola4_sostituzioni.md` (uova, pollame, pesci grassi/bianchi, crostacei, carne rossa, salumi, proteine veg, latticini, formaggi, noci/semi, oli, verdure a foglia/crucifere/low-carb, basi finto-carbo, frutti keto, dolcificanti…). Si caricano come base, poi il nutrizionista li valida.
- Nota: i gruppi possono essere **globali** (validi per più percorsi) ma le **sostituzioni restano dentro il pool del prodotto** (isolamento R7 non si viola: si sostituisce solo con piatti già nel pool Keto del cliente).

## D3 — Unicità / certificato (R9) → **DECISO per l'MVP; rigore massimo rimandato** *(Antonio confermi il claim marketing)*
Due livelli, per non sovra-ingegnerizzare ora:
- **Adesso (obbligatorio):** seme deterministico da `client_id` + **collision check** con firma `hash(cliente, menu, ricette, stato, versione)`; se collide → rigenera. Questo **già garantisce** "due diete mai identiche".
- **Certificato:** modello `PersonalizationCertificate` (`clientId`, `seed`, `signature`, `version`, `timestamp`) con **hash-chain + HMAC** (chiave server). Verificabile internamente e ricalcolabile → sufficiente per un audit.
- **Rimandato:** firma crittografica PKI / verificabilità da auditor **esterno indipendente**. Serve solo se vogliamo trasformare "unicità certificata" in un **claim pubblico forte** (marketing/legale). → **Antonio decide** se e quando: se sì, diventa una fase E6 dedicata; per l'MVP l'HMAC+hash-chain basta.

## D4 — Stato contestuale (R11) → **DECISO**
Segnali e casa dello stato come da `Metabole_Agente_AI_Dieta.md` §4:
- **Conforto**: umore basso dal check-in del mattino → il ciclo corrente usa i menu più amati. **Rientro**: ciclo subito successivo, menu più efficaci.
- **Pre-evento**: evento in agenda marcato "non voglio stare a dieta" entro **K giorni** → menu più proteici. **Post-evento**: rientro morbido.
- **Plateau**: nessun calo per **N cicli** o peso in aumento → sposta i pesi sull'efficacia + segnala.
- **Dove vive:** lo stato attivo sul **`ClientCycle`** (è una decisione per-ciclo), con un puntatore "stato corrente" sul cliente.
- **Soglie** (`K`, `N`, max giorni conforto/settimana, pesi) tutte in **`config_param`**. Guardrail conforto: se troppi giorni conforto o umore basso persistente → **niente moltiplicazione**, si apre `mood_risk` alla coach.

## D5 — Onboarding allergie → **DECISO: campo dedicato + domanda separata**
Le allergie **non** sono intolleranze né gusti (allergia = **blocco duro**, incluse tracce/derivati). Oggi manca.
- **Schema:** migrazione additiva `ClientProfile.allergies String[] @default([])`.
- **Onboarding:** aggiungere una **domanda dedicata** "allergie" distinta da intolleranze e cibi non graditi (tre input separati). Confermato: va aggiunta.

---

## Via libera operativo (tuo §7 e §5)
Il piano a fasi **E0→E5 è approvato** così com'è (additivo, per `product_id` via `ProductRule`). Puoi partire subito con le cose **sicure e additive**:
1. **Migrazione `allergies String[]`** su `ClientProfile` (+ domanda onboarding).
2. **Scheletro modelli senza logica**: `EquivalenceGroup`, `ClientMenuPool` (base personale), `ClientCycle`, `PersonalizationCertificate`.
3. Poi **E1 (R8)** sblocca il resto.

Nessuna di queste tocca il motore giornaliero esistente. Procedi pure con 1 e 2; per la **logica** dell'agente (E1→E5) restiamo sul tuo approccio "una fase alla volta, testabile".

## Punti che restano ad Antonio (strategia, non tecnica)
- **D3**: livello di rigore del certificato di unicità se diventa un **claim pubblico** (basta HMAC interno o serve auditor esterno?).
- Priorità E1–E5 rispetto ai **blocker go-live** (lead endpoint, scoping, config prod): quelli vengono **prima**.

---

**Stato:** decisioni di prodotto per sbloccare R8–R12. Nessun codice del motore scritto dal lato Prodotto. Additivo, isolato per prodotto, soglie in `config_param`.
