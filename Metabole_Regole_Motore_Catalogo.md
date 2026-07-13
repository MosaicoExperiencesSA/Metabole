# MetaboleAI — Catalogo delle regole del motore & wizard "Crea nuovo prodotto"

Due cose in un documento:

- **Parte A — Catalogo delle regole** del motore di generazione menu personalizzati: elenco numerato,
  classificato in **🔒 obbligatorie** (sicurezza, sempre attive) e **⚙️ opzionali** (si attivano con
  consenso, prodotto per prodotto).
- **Parte B — "Crea nuovo prodotto"**: la sezione di dashboard che chiedevi — nome + menu (colazione,
  pranzo, cena, e spuntini/merende opzionali) + **consenso regola-per-regola** + estendibilità + un
  **agente AI dedicato per ogni prodotto**.

Fonti: `Metabole_Motore_Personalizzazione.md`, `Metabole_Agente_AI_Dieta.md`,
`Metabole_Analisi_Motore_Certificazione.md`. Regola ferrea di base: **ogni prodotto ha i propri menu,
mai condivisi** (isolamento, §0 del motore).

---

# Parte A — Catalogo delle regole

Legenda tipo: **🔒 obbligatoria** (non disattivabile, mostrata solo per consenso informato) ·
**⚙️ opzionale** (attivabile/parametrizzabile per prodotto). "Config" = parametro in `config_param`.

## A1. Sicurezza (🔒 sempre attive)

| # | Regola | Cosa fa |
|---|---|---|
| S1 | **Isolamento menu per prodotto** | Ogni prodotto ha il proprio catalogo; menu mai condivisi/mischiati, a parità di piatti si duplicano. |
| S2 | **Vincoli assoluti** | Allergie, intolleranze, patologie/farmaci (dal nutrizionista): mai violati. |
| S3 | **Esclusioni → sostituzione o blocco** | Componente escluso → sostituzione equivalente sicura; se impossibile → **blocco erogazione + escalation** a coach e nutrizionista. |
| S4 | **Porzioni standard (niente fame)** | Non si tagliano le porzioni per un tetto calorico. |
| S5 | **Guardrail sostenibilità** | Ritmo di calo entro soglia; se superato → alert al nutrizionista. |
| S6 | **Solo menu approvati** | Un menu entra nel catalogo del prodotto solo dopo approvazione del nutrizionista (capo). |
| S7 | **Riservatezza dati sanitari** | Visibili solo a cliente e suo nutrizionista; **mai** usati per marketing. |

## A2. Struttura ed erogazione (⚙️ parametrizzabili)

| # | Regola | Cosa fa | Config |
|---|---|---|---|
| E1 | **Giornata bilanciata** | Colazione+pranzo+cena a totale ~costante; spuntini/merende **tracciati** ma **non conteggiati**. | target banda kcal |
| E2 | **Ciclo di 2 giorni** | Stessi menu per 2 giorni, **cucinati in modo diverso** (2 ricette/menu). Esito misurato a fine ciclo. | durata ciclo |
| E3 | **Numero pasti** | 3 / 5 / con integratori, scelto dal cliente. | — |
| E4 | **Stagionalità** | Menu con stagione + etichetta **caldo/freddo**. | — |

## A3. Valutazione & apprendimento (⚙️ opzionali)

| # | Regola | Cosa fa | Config / default |
|---|---|---|---|
| L1 | **Valutazione per ricetta = stella più alta** | Il valore di un menu = **max** stelle tra le sue ricette (non media). Default 5★ finché non valuta. | default 5★ |
| L2 | **Seguito sì/no** | Dal check-in del mattino. | on |
| L3 | **Esito peso/cm per ciclo** | Registra perso/stabile/preso su peso e cm a fine ciclo (se seguito). | soglie |
| L4 | **Learning (MenuWeight)** | Impara l'efficacia dei menu per il cliente (naive per giornata). | on |
| L5 | **Attribuzione causale del pasto** | Pesa il merito per **distintività** (la ricetta cambiata prende più credito). | `learning_distinctive_weighting` (off), `..._alpha` |
| L6 | **Selezione per punteggio** | `score = w_eff·efficacia + w_grad·gradimento − penalità`. | `w_eff`, `w_grad` |
| L7 | **Giornate bilanciate automatiche (DayCombo)** | Compone la giornata puntando alle kcal del livello. | `menu_daycombo_enabled` (off) |

## A4. Agente AI — stati (⚙️ scegli quali attivare per prodotto)

| # | Stato | Trigger | Cosa fa |
|---|---|---|---|
| A1 | **Normale** | default | Massimizza efficacia × gradimento. |
| A2 | **Conforto** | umore basso | Ciclo coi menu più amati (per risollevare). |
| A3 | **Rientro** | dopo conforto | Ciclo coi menu più efficaci. |
| A4 | **Pre-evento** | evento in agenda | Menu più proteici prima dell'evento. |
| A5 | **Post-evento** | dopo l'evento | Rientro morbido, riprende l'obiettivo. |
| A6 | **Plateau** | nessun calo per N cicli | Spinge l'efficacia e **segnala**. |

Config agente: `agent_comfort_max_days`, `agent_reentry_days`, giorni pre-evento, pesi `w_eff/w_grad`.
**Obiettivo del prodotto** (⚙️): *dimagrimento* (spinta efficacia) o *mantenimento* (efficacia neutra)
— è così che un prodotto come "Vacanze in Serenità" resta in mantenimento.

## A5. Segnalazioni / escalation

| # | Regola | A chi | Tipo |
|---|---|---|---|
| G1 | **Blocco sicurezza** 🔒 | Coach + Nutrizionista | `diet_blocked` |
| G2 | **Nessun progresso / plateau** ⚙️ | Nutrizionista + Coach | `no_progress` |
| G3 | **Aderenza bassa** ⚙️ | Coach | `low_adherence` |
| G4 | **Umore basso persistente** ⚙️ | Coach | `mood_risk` |
| G5 | **Tema clinico** 🔒 | Solo Nutrizionista | `clinical` |

## A6. Certificazione unicità (⚙️ opzionali — i 3 meccanismi)

| # | Regola | Cosa fa |
|---|---|---|
| C1 | **Seed personale + traiettoria stateful** | Percorso deterministico e riproducibile da identità+storia uniche. |
| C2 | **Vincolo di unicità + collision check** | Firma del piano; se collide con un altro cliente attivo → rigenera. |
| C3 | **Registro firmato + certificato** | Ogni ciclo firmato/registrato; certificato di personalizzazione verificabile. |

---

# Parte B — "Crea nuovo prodotto" (sezione dashboard)

Obiettivo: non si programma un prodotto da zero nel codice. Il **nutrizionista** (o admin) crea un
prodotto da un **wizard**, e il motore fa **esattamente ciò per cui è progettato**, secondo le regole
scelte.

## B1. Passi del wizard

1. **Nome del prodotto** (es. "Vacanze in Serenità") + eventuale **tag stagionale** (es. Estate),
   descrizione breve e **caratteristiche principali** (3–5 punti) — queste ultime **mostrate al
   cliente** quando tocca il piano a pagina 16 (es. "Menu freschi da viaggio", "Nessuna dieta rigida",
   "Seguita da coach e nutrizionista").
2. **Menu del prodotto** (il cuore): inserimento dei menu **propri** per
   **Colazione · Pranzo · Cena** (obbligatori) e **Spuntini · Merende** (opzionali). Per ogni menu, le
   **ricette** (modi di cottura, etichetta caldo/freddo). **Regola ferrea:** i menu si inseriscono qui,
   **non** si pescano da altri prodotti (a parità di piatti, si **duplicano**).
3. **Obiettivo del prodotto:** dimagrimento o mantenimento (A4).
4. **Regole del motore — consenso una a una.** Il wizard mostra le regole **⚙️ opzionali** del catalogo
   (Parte A), **una alla volta**, con spiegazione in linguaggio semplice; per ciascuna il nutrizionista
   dà il **consenso** (attiva/non attiva) e, se serve, imposta i **parametri**. Le regole **🔒 di
   sicurezza** sono mostrate come "sempre attive" (consenso informato, non disattivabili).
5. **"C'è un'altra regola?"** In coda, un campo aperto per **proporre una regola nuova** non presente in
   catalogo: entra in una **coda di approvazione** (nutrizionista capo / sviluppo); se approvata, viene
   aggiunta al catalogo e resa disponibile per tutti i prodotti.
6. **Attivazione:** salvato il prodotto, il sistema **istanzia un agente AI dedicato** a quel prodotto,
   configurato con le regole scelte, che ragiona **solo** sul catalogo di quel prodotto (un agente per
   prodotto, un'istanza di ragionamento per cliente).

## B2. Cosa vede il cliente

Il prodotto appare nella **lista prodotti a pagina 16** ("Stile che preferisci"), accanto a Mediterranea,
Proteica, ecc. (con l'eventuale tag stagionale). Da lì il cliente lo **sceglie**; il resto dell'app
(Home, menu del giorno, agenda) resta invariato.

## B3. I due protocolli estate = due prodotti creati così

- **Vacanze in Serenità**: prodotto con obiettivo **mantenimento**, menu propri (freddi/portabili),
  regole agente A1/A2/A3 attive (comfort/rientro), spinta efficacia neutra.
- **Ritorno in Equilibrio**: prodotto con obiettivo **dimagrimento graduale**, menu propri leggeri,
  regole agente con spinta efficacia progressiva (settimana reset → ritmo).

In entrambi i casi i **menu li fornisce il nutrizionista** dentro il wizard; l'AI non li inventa.

---

# Impatto [Sviluppo]

- **Modello dati:** entità `Product` (nome, tag, obiettivo, stato) → possiede `Menu`/`Recipe` con
  `product_id`; **nessun** riferimento a menu di altri prodotti (regola S1). `ProductRule` = insieme
  delle regole attive + parametri per prodotto (mappate su `config_param`).
- **Wizard backoffice:** form menu (colazione/pranzo/cena + snack opzionali + ricette caldo/freddo) →
  checklist regole opzionali con consenso e parametri → coda "regola proposta".
- **Agente per prodotto:** un'istanza configurata dalle `ProductRule`, che opera sul catalogo del
  prodotto (come già previsto in `Metabole_Agente_AI_Dieta.md` §8).
- **Pagina 16 (app):** la lista prodotti legge i `Product` attivi (con filtro stagionale se impostato).

## In una riga

Le regole del motore ora sono un **catalogo numerato** (sicurezza obbligatoria + comportamenti
opzionali); il **wizard "Crea nuovo prodotto"** fa inserire nome e menu propri, far scegliere le regole
**una a una con consenso**, permette di **proporne di nuove**, e per ogni prodotto accende un **agente
AI dedicato** che lavora solo sui menu di quel prodotto.
