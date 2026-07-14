# Metabole — Metodo del Motore Intelligente (regole canoniche per ogni percorso)

Questo documento **unifica** le regole di costruzione validate sulla **Mediterranea** e quelle sviluppate sul **Keto**, prendendo da ciascuna ciò che mancava all'altra. **Diventa lo standard**: ogni volta che si crea un nuovo percorso (Proteica, Low-carb, gravidanza, menopausa, sportivo, pre-matrimonio…) si applicano **queste stesse 12 regole**.

Riferimenti sorgente: `Metabole_Motore_Personalizzazione.md`, `Metabole_Agente_AI_Dieta.md`, `percorsi/keto/regola1–10`, `percorsi/keto/confronto_mediterranea.md`.

**Numero di regole: 12**, in **2 fasi**.
- **FASE A — Costruzione della base (R1–R7):** la fa il **nutrizionista + strumenti**; l'agente AI del cliente **non** interviene. Esito: una **base ufficiale approvata e isolata** per il prodotto.
- **FASE B — Motore intelligente / personalizzazione (R8–R12):** qui **interviene l'AGENTE AI del percorso** (uno per percorso, un'istanza di ragionamento per cliente). Esito: per ogni cliente una dieta **unica, che muta** nel tempo.

---

## FASE A — Costruzione della base (nutrizionista + strumenti)

### R1 — Raccolta menu
Si raccolgono i menu del percorso (fonti autorevoli + apporto del nutrizionista). Materia prima grezza.

### R2 — Catalogo diviso per pasto (× stagione se il percorso lo richiede)
Deduplica e organizza i piatti in **Colazioni · Pranzi · Cene · Spuntini · Merende**.
**Stagionalità opzionale**: se il percorso è stagionale (come la Mediterranea) si aggiunge la dimensione **Stagione** (Prim/Est/Aut/Inv/Tutte); se non serve (es. Keto) si usa "Tutte".

### R3 — Calorie per piatto (interne)
Si stima la **kcal totale di ogni piatto**. Le kcal servono **solo internamente** al bilanciamento e **non si mostrano mai al cliente**.

### R4 — Gruppi di equivalenza → sostituzioni → nuovi piatti/menu
Per ogni alimento si definisce il **gruppo di equivalenza** (es. pesci grassi: salmone↔sgombro↔aringa). Scambiando l'ingrediente cardine **a struttura e kcal invariate** nascono nuovi piatti e nuovi menu. È la base per gestire allergie/gusti in Fase B.

### R5 — Metodi di cottura (3–5 per piatto, kcal invariate)
Ogni piatto ha **3–5 modi di cottura** (forno/griglia/cartoccio/umido/vapore/padella…) con etichetta **caldo/freddo**, **stesse kcal** (frittura/impanatura escluse: cambiano le kcal). Danno varietà nel ciclo bigiornaliero.

### R6 — Bilanciamento della giornata
La **giornata** (Colazione+Pranzo+Cena) ha un **totale interno ~costante** (target = mediana). **Spuntino e merenda** restano **fuori dal bilancio calorico** (liberi) ma **vengono tracciati** (gradimento). **Porzioni standard, niente restrizione, "no fame"**: il risultato viene da qualità/abbinamento e dall'adattamento, non dal taglio delle porzioni.

### R7 — Approvazione del nutrizionista → base ufficiale isolata
Il nutrizionista controlla per categoria e **approva**. La base approvata diventa il **pool ufficiale del prodotto**, **isolato per `product_id`** e **mai mischiato** con altri percorsi (duplicazione voluta, mai condivisione). Ogni modifica futura ripassa dal nutrizionista con versione.

---

## FASE B — Motore intelligente (AGENTE AI del percorso, per cliente)

> **Da qui interviene l'agente AI.** È **unico per percorso** (un agente per la Keto, uno per la Mediterranea…), con **un'istanza di ragionamento per cliente**. Ragiona **solo** sul catalogo del suo percorso.

### R8 — Base personale + Agente Esclusioni → base personalizzata
Ogni cliente riceve una **copia** della base approvata (base personale). L'**Agente Esclusioni** applica il profilo:
- **Allergie** = blocco duro (incl. tracce/derivati); **intolleranze** e **non graditi** = **sostituzione** con gruppo di equivalenza (R4); **cultura/fede + veg/vegano**.
- **Ordine**: prima **sostituire** (varietà), poi rimuovere.
- **Se non esiste sostituzione sicura → NON si rimuove in silenzio**: si **blocca** quel menu e si apre **escalation a coach + nutrizionista** (`diet_blocked`), con messaggio rassicurante al cliente.
Esito: la **base personalizzata** del cliente (isolata per `client_id`).

### R9 — Partenza differenziata + unicità certificata
Ogni cliente parte da un **menu/ordine diverso** anche a pari percorso e stessa data d'inizio. Tre meccanismi garantiscono l'unicità **by design**:
1. **Seme personale + traiettoria stateful** (event sourcing): la dieta è funzione deterministica di identità + storia uniche;
2. **Collision check**: firma `hash(cliente, menu, ricette, stato, versione)`; se collide, **ri-genera**;
3. **Registro firmato + certificato** di personalizzazione, verificabile da un auditor.

### R10 — Erogazione a ciclo bigiornaliero + Monitoraggio
Erogazione **ogni 2 giorni**: **stesso menu** per i 2 giorni, **2 cotture diverse** (R5). A fine ciclo l'agente registra nella **tabella personale**:
- **Misure obbligatorie** → **due esiti separati**: **esito peso** (perso/stabile/preso) ed **esito cm** (vita+fianchi);
- **Seguito sì/no** (check-in): l'esito conta **solo se** seguito=sì **e** misure aggiornate, altrimenti *n.d.*;
- **Gradimento per ricetta**, **opzionale**, **default 5★**; il menu vale **max(stelle)** delle sue ricette (non la media).

### R11 — Agente Adattamento (scelta + apprendimento + stati)
A ogni ciclo l'agente sceglie il menu con uno **scoring**: `score = w_eff·Efficacia + w_grad·Gradimento − penalità(ripetizione, stagione)`.
- **Regola base**: 📈 **preso peso** → ripropone il **menu che ha fatto perdere di più** (ranking personale); ➖ **invariato** / 📉 **sceso** → **nuovo menu** dalla base personalizzata.
- **Apprendimento**: all'inizio attribuisce l'effetto all'**intera giornata**; nel tempo **isola il singolo pasto** (confronta giornate che differiscono per un solo pasto → pesa colazione/pranzo/cena).
- **Stati contestuali** (umore/eventi/agenda): **Normale**, **Conforto** (umore basso → menu più amati) → **Rientro** (ciclo dopo, più efficaci), **Pre-evento** (più proteico prima di un evento "no dieta"), **Post-evento** (rientro morbido), **Plateau** (sposta i pesi sull'efficacia). Guardrail sui giorni conforto.

### R12 — Obiettivo, segnalazioni ed accessi
- **Obiettivo del prodotto**: **dimagrimento** (spinge l'efficacia) o **mantenimento** (efficacia neutra, niente deficit) — parametro che modula i pesi.
- **Segnalazioni/escalation**: `diet_blocked` (blocco sicurezza → coach+nutrizionista), `no_progress` (plateau/aumento → nutrizionista+coach), `low_adherence` (→ coach), `mood_risk` (→ coach), `clinical` (→ solo nutrizionista).
- **RBAC/privacy**: nutrizionista tutto; coach solo aderenza/andamento (no dati clinici); cliente vede la sua dieta ma **non le kcal** né le logiche. Dati sanitari **cifrati**. Tutte le soglie (`w_eff`, `w_grad`, N cicli, K giorni…) in **`config_param`**, mai hardcoded.

---

## Dove interviene l'agente AI (mappa rapida)
| Fase | Regole | Chi agisce |
|---|---|---|
| Costruzione base | R1–R7 | Nutrizionista + strumenti (no agente cliente) |
| Personalizzazione iniziale | R8–R9 | **Agente AI** (esclusioni, partenza, unicità) |
| Ciclo di vita | R10–R12 | **Agente AI** (monitora, adatta, impara, segnala) |

L'agente AI è **unico per percorso** e lavora **solo** sulla base approvata del suo percorso, mai su altri.

---

## Verifica dell'audit precedente
**Domanda:** possiamo ancora dire che *ogni menu è personalizzato e muta in base ai bisogni del cliente*?
**Risposta: SÌ — ed è ora più solido di prima.** Con il metodo unificato:
- **Personalizzato**: base personale per cliente (R8) + partenza differenziata con **seme, collision check e certificato** (R9) → **due clienti non hanno mai la stessa dieta**, certificabile da un auditor.
- **Muta secondo i bisogni**: adattamento a ogni ciclo su **peso, cm, gradimento** (R10–R11), **apprendimento** che isola il pasto, e **stati** che rispondono a **umore ed eventi** (R11). Se serve, entra il **nutrizionista** (R12).
La certificazione di unicità (`Metabole_Analisi_Motore_Certificazione.md`) resta **valida** e viene **rafforzata**: l'allineamento aggiunge al Keto i pezzi che mancavano (seguito sì/no, peso vs cm separati, stati contestuali, collision check/certificato), portandolo alla **piena parità** con la Mediterranea.

---

**Stato:** metodo canonico definito. Da validare col nutrizionista per l'adozione ufficiale. Nessun deploy.
→ impatto [Sviluppo]: questo è lo **standard del motore** per ogni nuovo percorso — implementare R8–R12 come componenti riusabili (Agente Esclusioni, generatore partenza+unicità, Monitoraggio, Adattamento con stati, escalation/RBAC), parametrizzati per `product_id`.
