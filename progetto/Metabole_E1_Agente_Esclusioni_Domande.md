# Metabole — E1 (Agente Esclusioni, R8): cosa serve per implementarlo

**A chi:** socio (Prodotto/motore). **Da:** Sviluppo (Simone + Claude).
**Scopo:** definire le ultime decisioni per costruire E1 in sicurezza. Le tue risposte a **Q1** e **Q2** sono le uniche davvero bloccanti; le altre sono conferme di scope MVP con una proposta già pronta (spesso basta "ok").

---

## Dove siamo (già fatto in E0, additivo)
- Campo **`allergies`** sul profilo cliente + **domanda onboarding** dedicata (allergie separate da intolleranze e gusti).
- Modello **`ClientMenuPool`** (la "base personale" del cliente, isolata per `client_id`) — scheletro pronto, senza logica.
- Modello **`EquivalenceGroup`** + **23 gruppi** caricati (bozza) + **gestione backoffice** (il nutrizionista li rivede/approva). Il motore userà solo i gruppi **approvati**.

## Cosa fa E1 (dalla tua spec R8)
Ogni cliente riceve una **copia** della base approvata del prodotto scelto (Keto, Mediterranea…). L'**Agente Esclusioni** la filtra sul profilo (allergie = blocco duro; intolleranze/gusti = sostituzione; veg/vegano). Se un pasto resta senza opzioni sicure → **non rimuove in silenzio**: blocca e apre `diet_blocked` (coach+nutrizionista) con messaggio rassicurante al cliente. Output = **base personalizzata** del cliente.

---

## Q1 — [BLOCCANTE] Come riconosciamo un allergene/alimento dentro una ricetta?
È il pezzo di **sicurezza** più importante. Per bloccare un'allergia ("arachidi") o sostituire un ingrediente non tollerato/non gradito, l'agente deve sapere **quali ricette lo contengono**. Le ricette oggi hanno una lista `ingredients` (testo).

- **Opzione A — match sul nome dell'ingrediente (testo).** Semplice ma **rischiosa**: "latte" non trova "burro/formaggio", non gestisce sinonimi, plurali, errori di battitura. **Per le allergie è pericolosa.**
- **Opzione B — [consigliata] tag allergeni normalizzati sulle ricette.** Ogni ricetta viene taggata con gli allergeni che contiene (es. `glutine`, `lattosio`, `frutta_secca`, `pesce`, `crostacei`, `uova`, `soia`…). L'agente blocca/filtra sui tag, non sul testo libero. Richiede che il **nutrizionista tagghi le ricette** (una tantum, dal backoffice — te lo predisponiamo).

**Domande:**
1. Adottiamo i **tag allergeni** (Opzione B)? 
2. Che **lista** usiamo — i **14 allergeni UE** (glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini, molluschi)? Aggiungiamo/togliamo qualcosa?
3. Confermi che il **taggaggio lo fa il nutrizionista** dal backoffice (predisponiamo noi la UI)?

_Proposta di default: Opzione B con i 14 allergeni UE, taggati dal nutrizionista._

## Q2 — [BLOCCANTE] Derivati e tracce (allergie = blocco duro)
Un'allergia al **latte** deve bloccare anche **burro, formaggi, panna, yogurt** (derivati). Con i tag questo è automatico: se tagghi tutti i latticini con `lattosio`/`latte`, l'allergene copre già i derivati.

**Domanda:** confermi che gestiamo i derivati **tramite i tag** (un tag = alimento + tutti i suoi derivati)? In più: vuoi un campo "tracce" separato (es. "prodotto in stabilimento che tratta frutta a guscio") o per l'MVP basta il tag principale?

_Proposta di default: derivati via tag; "tracce" rimandato a dopo l'MVP._

## Q3 — Sostituzione: a livello di ricetta o di ingrediente?
La tua R4 mostra "nuovi piatti per sostituzione" (COL02b, CE08b…). Per l'MVP:

- **Opzione A — [consigliata] filtro delle ricette.** L'agente NON genera nuovi piatti: dalla base del prodotto **tiene solo le ricette sicure** per quel cliente. La varietà resta perché ogni pasto ha più ricette alternative; le sostituzioni "vere" (salmone→sgombro) le sfruttiamo perché quelle varianti sono **già ricette nel catalogo**.
- **Opzione B — generazione di varianti a livello ingrediente** (crea nuovi piatti scambiando l'ingrediente col gruppo di equivalenza). Più potente, ma molto più complesso e **ogni variante andrebbe validata dal nutrizionista** (sicurezza).

**Domanda:** per l'MVP va bene l'**Opzione A** (filtro + varianti già a catalogo), rimandando la generazione automatica di nuovi piatti?

_Proposta di default: Opzione A._

## Q4 — Cosa contiene la "base personale" (`ClientMenuPool`)
**Proposta:** `recipeIds` = tutte le ricette approvate del prodotto scelto **meno** quelle non sicure per il cliente. Il motore comporrà le giornate pescando da qui (rispettando slot pasto e kcal). 

**Domanda:** ok così, oppure preferisci filtrare direttamente i **template-giornata** invece delle ricette?

_Proposta di default: filtro sulle ricette (recipeIds)._

## Q5 — Veg/vegano e cultura/religione
Abbiamo già `regime` (onnivoro/vegetariano/vegano) raccolto in onboarding. **Cultura/religione** non è un campo.

**Domanda:** per l'MVP gestiamo **veg/vegano** (già c'è) e **rimandiamo cultura/religione** (halal/kosher…) a una fase successiva con un campo dedicato? O ti serve subito?

_Proposta di default: veg/vegano ora; cultura/religione dopo._

## Q6 — Blocco + escalation (`diet_blocked`)
Se, dopo le esclusioni, **un pasto resta senza ricette sicure** (troppe esclusioni), l'agente non deve improvvisare.

**Proposta:** se anche **un solo slot** (colazione/pranzo/cena) resta senza opzioni sicure → si apre **`diet_blocked` a coach + nutrizionista**, la dieta **non parte** finché il nutrizionista non interviene, e il cliente vede un messaggio rassicurante.

**Domande:**
1. Confermi la **granularità** (basta un pasto scoperto per bloccare)?
2. Mi dai il **testo del messaggio** al cliente? _(proposta: "Stiamo perfezionando il tuo menu con il nutrizionista per renderlo perfetto per te. Ti avvisiamo appena è pronto.")_

## Q7 — Quando gira l'agente
**Proposta:** alla **fine dell'onboarding** (scelta stile + assegnazione nutrizionista) e di nuovo se il cliente **aggiorna allergie/intolleranze/gusti**.

**Domanda:** ok? Aggiungiamo un pulsante "rigenera base" per il nutrizionista?

_Proposta di default: sì a entrambi._

## Q8 — Soglia minima di varietà
Quante ricette sicure minime servono **per pasto** perché la dieta possa partire senza escalation?

**Domanda:** un numero (es. **≥3 opzioni per slot**)? Lo mettiamo in `config_param` così lo cambi senza deploy.

_Proposta di default: ≥3 per slot, parametrizzabile._

---

## In sintesi — cosa mi serve da te
1. **Q1 + Q2 (bloccanti):** ok ai tag allergeni (14 UE, taggati dal nutrizionista) + derivati via tag.
2. **Q3–Q8:** un "ok" alle proposte di default, oppure le tue correzioni.
3. Il **testo del messaggio** di Q6.

Con Q1/Q2 sbloccate parto: predispongo il **taggaggio allergeni sulle ricette** (backoffice) e l'**agente esclusioni** che genera la base personale e apre `diet_blocked` quando serve. Tutto additivo, testabile, isolato per prodotto.
