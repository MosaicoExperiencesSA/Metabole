# MetaboleAI — Gestione eventi programmabili

Sezione di dashboard per **programmare gli eventi** della vita del cliente (matrimonio, vacanze, sgarro,
periodo di fermo, e altri) e far reagire l'app di conseguenza — fase per fase. Configurabile da
**nutrizionista** e **admin**, senza toccare il codice (data-driven, zero-redeploy).

Si aggancia a ciò che esiste già: gli stati dell'agente **pre_evento / post_evento**
(`Metabole_Agente_AI_Dieta.md`) e le fasi **Prima / Il giorno / Dopo** già presenti nell'agenda del
cliente. Qui le rendiamo **template programmabili**.

---

## 0. Due entità

- **EventType (template)** — es. "Matrimonio", "Vacanze", "Sgarro". Definisce le **fasi** e il
  **comportamento** dell'app in ciascuna. Lo creano/modificano **nutrizionista capo / admin**.
- **ClientEvent (istanza)** — l'evento di *quella* cliente con una **data** (es. "Matrimonio il 12/9").
  Lo inserisce la cliente dalla sua **agenda** (o coach/nutrizionista). Il sistema applica il template
  giorno per giorno in base alla data.

Regola: i **template** sono dato configurabile → aggiungere un nuovo tipo di evento **non richiede
ripubblicazione** dell'app.

---

## 1. Modello a fasi (timeline)

Ogni EventType ha una linea del tempo con **fasi** ancorate al giorno dell'evento (giorno 0):

- **Prima** — da giorno −N a −1 (N configurabile, es. 5).
- **Il giorno** — giorno 0.
- **Dopo** — da giorno +1 a +M (M configurabile).

Ogni fase ha la propria **configurazione di comportamento** (§2). Si possono definire anche più
sotto-fasi (es. "Dopo, settimana 1" e "Dopo, settimana 2").

---

## 2. Le leve configurabili per fase (le "regole" dell'evento)

| Leva | Valori | A cosa serve |
|---|---|---|
| **Modalità menu** | dimagrimento · mantenimento · **nessun menu** | Come si comporta il motore in quella fase. "Nessun menu" = al posto del menu compare un **messaggio**. |
| **Messaggio Home** | testo libero | Sostituisce il box "menu di oggi" (es. *"Goditi il tuo matrimonio: anche se prendi peso, lo gestiremo nei prossimi giorni."*). |
| **Integratori suggeriti** | piano integratori (opz.) | **Prescritto dal nutrizionista**, **non selezionabile** dalla cliente; compare all'occorrenza (es. per cali di umore/energia). |
| **Politica misure** | obbligatorie (blocco) · **facoltative (no blocco)** | Es. in vacanza: niente blocco se non inserisce peso/misure. |
| **Consigli AI** | attivi · **spenti** | Il giorno dell'evento l'app **spegne ogni consiglio**. |
| **Attenzione umore/energia** | on/off | Considera possibili cali; può alzare il gradimento e/o segnalare. |
| **Coach** | normale · **più attiva (alert)** | Nei giorni critici la coach viene **allertata** per seguire di più. |
| **Soglia allerta** | Δkg / Δcm | Se la cliente prende più di X kg o cm → **alert alla coach**. |

Tutte le soglie e i testi stanno in configurazione (per template), mai hardcodati.

---

## 3. I tre eventi di esempio (già configurati)

### 3.1 Matrimonio
| Fase | Modalità menu | Messaggio Home | Integratori | Misure | Consigli | Coach / Alert |
|---|---|---|---|---|---|---|
| **Prima (−5→−1)** | Mantenimento | (normale) | Piano integratori del nutrizionista (umore/energia), non selezionabile | obbligatorie | attivi | attenzione umore/energia |
| **Il giorno (0)** | Nessun menu | *"Goditi il tuo matrimonio: anche se prendi peso, lo gestiremo nei prossimi giorni."* | — | facoltative | **spenti** | — |
| **Dopo (+1→+M)** | Dimagrimento | (normale, incoraggiante) | eventuale | obbligatorie | attivi | **coach più attiva** (umore possibile giù) + alert |

### 3.2 Vacanze
| Fase | Modalità menu | Messaggio Home | Misure | Alert |
|---|---|---|---|---|
| **Durante** | Nessun menu | *"Goditi le tue vacanze. Inserisci comunque peso e misure: se prendi peso, quando vuoi ti darò i menu per rientrare."* | **facoltative (nessun blocco)** | se Δ > soglia (kg/cm) → **coach allertata** |
| **Dopo** | Dimagrimento | (rientro morbido) | obbligatorie | — |

### 3.3 Sgarro (giornata di riposo)
| Fase | Modalità menu | Messaggio Home | Misure |
|---|---|---|---|
| **Il giorno** | Nessun menu | *"Goditi la tua giornata di riposo."* | facoltative |
| **Dopo (ripartenza)** | Dimagrimento | (normale) | obbligatorie |

---

## 4. Altri periodi (estendibili)

Con lo stesso schema si creano nuovi EventType dalla dashboard: es. **Periodo di fermo**, **Viaggio di
lavoro**, **Esami/stress**, **Feste comandate**. Bastano: nome, fasi, e le leve §2. Nessuno sviluppo
nuovo per aggiungerli.

---

## 5. Chi configura e chi attiva

- **EventType (template):** nutrizionista capo / admin, dalla sezione **Eventi** della dashboard
  (crea/modifica fasi e leve).
- **ClientEvent (istanza con data):** la cliente lo aggiunge dalla **agenda** (o lo aggiunge
  coach/nutrizionista). Il sistema applica il template dalla data.
- **Piano integratori dell'evento:** lo definisce **solo il nutrizionista** (clinico); **non è
  selezionabile dalla cliente**, arriva quando la fase lo prevede.

---

## 6. Esperienza cliente

- **Home:** nelle fasi con "Nessun menu", il box del menu mostra il **messaggio** dell'evento al posto
  dei piatti; nelle fasi con menu, il motore propone in modalità mantenimento/dimagrimento.
- **Agenda:** le fasi Prima / Il giorno / Dopo dell'evento (già presenti nel prototipo).
- **Misure:** rispettano la **politica** dell'evento (in vacanza/sgarro nessun blocco; altrove restano
  richieste).
- **Consigli:** spenti il giorno dell'evento (nessuna notifica/consiglio).

---

## 7. Impatto [Sviluppo]

- **Dati:** `EventType` (nome, attivo), `EventPhase` (offset giorni, leve §2 in JSON), `ClientEvent`
  (client_id, event_type_id, data), `EventSupplementPlan` (integratori, prescritti dal nutrizionista).
  Tutto data-driven → **zero-redeploy** per nuovi tipi di evento.
- **Motore/agente:** ogni giorno, dato `ClientEvent` + data odierna, si calcola la **fase attiva** e si
  applica la config: modalità menu (mantenimento/dimagrimento) all'agente, **override del box Home**,
  politica misure, spegnimento consigli. Riusa gli stati `pre_evento`/`post_evento` esistenti.
- **Alert engine:** nuove regole event-driven — coach "più attiva" nelle fasi critiche; alert se
  Δpeso/Δcm supera la soglia dell'evento; mood risk.
- **RBAC:** template e piani integratori gestiti da nutrizionista/admin; la cliente inserisce solo la
  data in agenda.
- **Sicurezza:** integratori/clinico = solo nutrizionista; misure sanitarie riservate; le fasi "no
  blocco" non impediscono mai l'uso dell'app.

## In una riga

Una sezione **Eventi** dove nutrizionista e admin **programmano** cosa fa l'app **prima, durante e dopo**
ogni evento (menu di mantenimento/dimagrimento o nessun menu con messaggio, integratori prescritti,
misure con o senza blocco, coach allertata su soglie) — con template **estendibili** e **data-driven**,
che riusano gli stati dell'agente e l'agenda già esistenti.
