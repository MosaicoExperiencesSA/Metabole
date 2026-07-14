# Metabole — Motore Intelligente: piano di sviluppo R8–R12 (mappatura sullo schema reale)

> **Scopo.** Tradurre le 12 regole del *Metodo del Motore Intelligente* (`percorsi/METODO_MOTORE_INTELLIGENTE.md`) in un piano di sviluppo concreto, **mappato sullo schema Prisma e sui servizi che esistono già**. È un documento **di allineamento**: il motore è dominio del socio, quindi qui evidenzio *cosa c'è*, *cosa manca* e le *decisioni aperte* — **prima di scrivere codice**.
>
> Riferimenti: `percorsi/METODO_MOTORE_INTELLIGENTE.md` (spec canonica), `percorsi/keto/regola6–10`, schema `backend/prisma/schema.prisma`, `backend/src/engine/*`.

---

## 0. Fase A (R1–R7) — già coperta

La costruzione della base (nutrizionista + strumenti) è sostanzialmente in piedi: `Diet` (con `objective`, `style`, `clientVisible`, campi scheda cliente), `DietDayTemplate` (giornate/livelli), `Recipe` (con `kcal` interne, `cookingMethods`, `tags`, `ingredients`), flusso di **approvazione del capo** (`status: draft→in_review→approved`, mai la propria dieta), e **isolamento per prodotto** (ogni `Diet` è il pool del suo percorso). R5 (metodi di cottura) è già un campo su `Recipe`. **Quello che segue riguarda solo la Fase B (R8–R12), cioè l'agente AI.**

---

## 1. Cosa c'è già (infrastruttura riutilizzabile)

| Pezzo | Modello/servizio esistente | Copre |
|---|---|---|
| Decisione giornaliera a regole | `EngineDecision` + `Protocol` + `engine.service` (5 segnali, guardrail, review) | Il **livello "protocollo"**: regole approvate che scattano su soglie/segnali. |
| Monitoraggio ciclo | **`CycleFeedback`** (`deltaWeightKg`, `deltaCm`, `esitoPeso`, `esitoCm`, `followed`) | **R10**: peso vs cm **separati**, seguito sì/no. Già pronto. |
| Gradimento | **`RecipeRating`** (`stars` 1–5, `tags`, per data) | **R10**: gradimento per ricetta. Già pronto. |
| Ranking personale | **`MenuWeight`** (`clientId`+`recipeId` → `score`, `samples`) | **R11**: apprendimento **per ricetta** (isola il pasto). Già pronto. |
| Segnalazioni | `Escalation` (`reason`, `source`, `assignedTo`, `status`) | **R12**: escalation. Manca il *routing* per categoria. |
| Regole per prodotto | `ProductRule` (`dietId`+`ruleCode`+`enabled`+`params`) · `RuleProposal` | **R8–R12** attivabili/parametrizzabili per prodotto. |
| Soglie | `ConfigParam` (`config_param`) | `w_eff`, `w_grad`, N cicli, K giorni… mai hardcoded. |
| Profilo cliente | `ClientProfile` (`intolerances[]`, `dislikedFoods[]`, `regime`, `dietStyle`, `lifestyle`, misure di partenza) | Base per R8. **Manca il campo allergie** (vedi §4). |

**Conclusione:** il socio ha già scaffoldato i modelli-dati di **R10 e R11** (`CycleFeedback`, `RecipeRating`, `MenuWeight`). Mancano soprattutto i pezzi di **R8–R9** (base personale, esclusioni, partenza/unicità) e la **logica** che lega tutto (l'agente).

---

## 2. La domanda architetturale chiave (da chiarire col socio)

Oggi esistono **due livelli** che vanno riconciliati:

- **Livello A — Protocollo/decisione giornaliera** (`EngineDecision`+`Protocol`): valuta 5 segnali e produce una *decisione a regole* con guardrail e revisione umana. È il motore "attuale".
- **Livello B — Agente di percorso (R8–R12)**: **genera e adatta il menu** del cliente ciclo per ciclo, con base personale, scoring, stati contestuali.

**Domanda:** l'Agente (B) è un **nuovo servizio** che *usa* il livello A per i guardrail clinici (screening, calo rapido → `Escalation`), oppure i due si fondono? La lettura più pulita: **B genera il menu; A resta il guardrail di sicurezza** (quando scatta, B non decide e si apre escalation). Da confermare col socio, perché cambia i confini dei moduli.

---

## 3. R8–R12: cosa manca, dettaglio

### R8 — Base personale + Agente Esclusioni → base personalizzata
**C'è:** `ClientProfile.intolerances`/`dislikedFoods`, `Recipe.ingredients`/`tags`, `ProductRule` per attivare la regola.
**Manca:**
- **Campo allergie** dedicato su `ClientProfile` (blocco duro ≠ intolleranza/gusto). → migrazione additiva `allergies String[]`.
- **Gruppi di equivalenza (R4)** come dato interrogabile: oggi non esiste un modello. Servono per *sostituire* (non solo rimuovere). → opzioni: (a) nuovo modello `EquivalenceGroup`, (b) convenzione su `Recipe.tags`/`ingredients`. **Decisione del socio.**
- **Modello "base personalizzata" per cliente**: la copia filtrata del pool del prodotto, isolata per `client_id`. Non esiste. → nuovo modello (es. `ClientMenuPool` / `PersonalBase`: `clientId`, `dietId`, insieme di `recipeId`/day-template ammessi, versione).
- **Logica agente**: sostituisci-poi-rimuovi; se nessuna sostituzione sicura → **non rimuovere in silenzio**, `Escalation` categoria `diet_blocked` (coach+nutrizionista) + messaggio rassicurante.

### R9 — Partenza differenziata + unicità certificata
**C'è:** niente di specifico.
**Manca:**
- **Seme personale** deterministico da `client_id` (+ traiettoria) → ordinamento/rotazione unici della base personale.
- **Collision check**: firma `hash(cliente, menu, ricette, stato, versione)`; se collide → rigenera.
- **Registro firmato + certificato** di personalizzazione (verificabile da auditor). → nuovo modello (es. `PersonalizationCertificate`: `clientId`, `signature`, `seed`, `version`, timestamp) o campi su `ClientProfile`. **Livello di rigore da concordare col socio** (basta seme+hash, o serve firma crittografica?).

### R10 — Ciclo bigiornaliero + Monitoraggio
**C'è:** `CycleFeedback` (peso/cm separati, `followed`), `RecipeRating` (gradimento). **Ottima base.**
**Manca:**
- **Modello del "ciclo attivo"**: quale menu/giornata è erogata nel ciclo corrente di 2 giorni, con le **2 cotture** (R5/R6). Oggi non c'è dove salvare "cosa sta mangiando ora". → nuovo modello `ClientCycle` (`clientId`, `cycleStart/End`, `dayTemplateId`/menu, `cotturaG1`, `cotturaG2`, stato).
- **Regola gradimento**: il menu vale **max(stelle)** delle sue ricette (non media); default **5★** se assente. → logica, non schema.
- Wiring: a fine ciclo, chiusura `CycleFeedback` **solo se** `followed=true` **e** misure aggiornate, altrimenti esito `n.d.`.

### R11 — Agente Adattamento (scelta + apprendimento + stati)
**C'è:** `MenuWeight` (ranking per ricetta), `ConfigParam` per i pesi.
**Manca:**
- **Scoring**: `score = w_eff·Efficacia + w_grad·Gradimento − penalità(ripetizione, stagione)`. Efficacia da `CycleFeedback`/`MenuWeight`; gradimento da `RecipeRating`. Pesi da `config_param`.
- **Regola exploit/explore**: 📈 preso peso → ripropone il menu che ha fatto **perdere di più** (ranking); ➖/📉 → **nuovo** menu dalla base personale.
- **Apprendimento che isola il pasto**: confrontare giornate che differiscono per **un solo pasto** → aggiorna `MenuWeight` per ricetta. (Il modello per-ricetta lo permette già.)
- **Stati contestuali**: Normale · Conforto · Rientro · Pre-evento · Post-evento · Plateau. → serve un **campo stato** per cliente (nuovo campo o su `ClientCycle`) e input da segnali umore/agenda (esistono `mood`, eventi). Guardrail sui giorni "conforto" (in `config_param`).

### R12 — Obiettivo, segnalazioni, accessi
**C'è:** `Diet.objective` (dimagrimento/mantenimento), `Escalation`, RBAC per ruolo, kcal nascoste al cliente, dati sanitari cifrati, `config_param`.
**Manca (poco):**
- **Routing escalation per categoria**: `diet_blocked` (coach+nutr), `no_progress` (nutr+coach), `low_adherence` (coach), `mood_risk` (coach), `clinical` (solo nutr). Oggi `Escalation` esiste ma senza queste categorie standardizzate. → enum/costanti + logica di assegnazione.
- Modulazione pesi da `objective` (mantenimento = efficacia neutra, niente deficit).

---

## 4. Lacune trasversali (da decidere prima di codare)

1. **Allergie** — campo dedicato `ClientProfile.allergies String[]` (migrazione additiva). Semplice, ma serve confermare che la **raccolta** (onboarding) le distingua da intolleranze/gusti.
2. **Gruppi di equivalenza (R4)** — modello dati vs convenzione su tag. È il perno delle sostituzioni R8. **Decisione del socio.**
3. **Base personale per cliente** — nuovo modello isolato per `client_id`. È il fondamento di R8–R11.
4. **Ciclo attivo** — nuovo modello per "cosa mangia ora" (menu + 2 cotture).
5. **Unicità/certificato (R9)** — livello di rigore (seme+hash vs firma crittografica + registro auditor).
6. **Stato contestuale** — dove vive lo stato (Conforto/Rientro/…) e quali segnali lo attivano.

---

## 5. Piano a fasi proposto (additivo, ogni fase testabile)

- **E0 — Allineamento col socio** (questo documento): confini A/B, gruppi di equivalenza, rigore unicità. *Nessun codice.*
- **E1 — Base personale + Esclusioni (R8):** campo `allergies`; modello base personale; agente esclusioni (sostituisci-poi-rimuovi) + `diet_blocked`. Sblocca tutto il resto.
- **E2 — Partenza + unicità (R9):** seme da `client_id`, collision check, certificato. Dipende da E1.
- **E3 — Ciclo + monitoraggio (R10):** modello `ClientCycle`; erogazione bigiornaliero (2 cotture); chiusura `CycleFeedback`/`RecipeRating` con le regole (max stelle, default 5★, esito solo se seguito+misure).
- **E4 — Adattamento + apprendimento (R11):** scoring da `config_param`, exploit/explore, aggiornamento `MenuWeight` per-pasto.
- **E5 — Stati contestuali (R11) + routing escalation (R12):** stati Conforto/Rientro/eventi; categorie escalation con routing; modulazione da `objective`.

Ogni fase è **additiva** (nuovi modelli/servizi, non tocca il motore giornaliero esistente) e **parametrizzata per `product_id`** via `ProductRule`, così lo stesso agente serve ogni percorso (Keto, Mediterranea, …).

---

## 6. Domande aperte per il socio (decisioni sue)

1. **Confini A/B**: l'Agente R8–R12 è un servizio nuovo che usa il motore giornaliero solo come guardrail di sicurezza? (proposta §2)
2. **Gruppi di equivalenza**: modello dedicato o convenzione sui tag delle ricette? Chi popola i gruppi (nutrizionista dal backoffice)?
3. **Unicità (R9)**: basta seme deterministico + hash di collisione, o serve una **firma/certificato** verificabile da auditor esterno? Con quale formato?
4. **Stato contestuale**: quali segnali attivano Conforto/Pre-evento (umore dai check-in? eventi dall'agenda "no dieta"?) e con quali soglie (`config_param`)?
5. **Onboarding allergie**: la raccolta distingue già allergie da intolleranze/gusti, o va aggiunta la domanda?

## 7. Cosa NON tocco senza il tuo ok
La logica del motore/agente è dominio del socio. Da qui in poi, prima di ogni fase (E1…E5) attendo l'allineamento su §6. Le uniche cose "sicure" e additive che potrei preparare subito, se volete, sono: il **campo `allergies`** (migrazione) e lo **scheletro dei modelli** (`ClientMenuPool`, `ClientCycle`) — senza logica — così le fasi successive partono già su binari condivisi.

---

**Stato:** proposta di sviluppo, da validare col socio. Nessun deploy, nessun codice del motore scritto.
