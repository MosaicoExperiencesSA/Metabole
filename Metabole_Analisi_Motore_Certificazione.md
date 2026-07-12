# Metabole — Analisi tecnica del motore e certificazione dell'unicità

Analisi tecnica del motore di personalizzazione (dieta mediterranea come caso). Rispondiamo a due
domande: **(1) possiamo certificare che la dieta è personalizzata e che non esistono due diete
uguali?** e **(2) cosa manca per potenziarlo?** In chiusura, i **3 meccanismi** che trasformano
l'unicità da *probabile* a *garantita*.

---

## 1. Il motore come sistema (formalizzazione)

Per il cliente *u* il motore non produce una lista statica ma una **traiettoria** di cicli (2 giorni).
Ad ogni ciclo *t*:

```
plan(u,t) = π( S(u,t) ; Θ )
S(u,t+1) = f( S(u,t), feedback(u,t) )
```

- **S(u,t)** = stato del cliente: profilo, esclusioni, obiettivo (peso/cm, ritmo), misure/trend,
  `RecipeRating` (gradimento), `MenuWeight` appreso (efficacia), umore, eventi in agenda, stagione,
  n° pasti, stato dell'agente (Normale/Conforto/Rientro/Pre-evento/Plateau).
- **π** = politica dell'agente (scoring `w_eff·Efficacia + w_grad·Gradimento − penalità`, entro i
  vincoli di sicurezza), con i pesi che dipendono dallo stato.
- **feedback** = seguito sì/no, Δpeso/Δcm di fine ciclo, nuove valutazioni.
- **Θ** = soglie in `config_param` (versionate).

Il **piano di ciclo** è: 1 menu per pasto (uguale nei 2 giorni) × 2 ricette (giorno 1/giorno 2).

## 2. Dimensioni di personalizzazione

La dieta di *u* è funzione di: regime · **esclusioni** (allergie/intolleranze/gusti) · **obiettivo** ·
stagione · n° pasti · **gradimento** (evolve) · **efficacia appresa** (evolve) · **umore** (temporale) ·
**eventi** (temporale) · storia di aderenza. Le ultime cinque sono **dinamiche e individuali**: due
persone dovrebbero avere lo *stesso profilo e la stessa identica storia* (stesse valutazioni negli
stessi ordini, stessi esiti, stesso umore, stessi eventi negli stessi giorni) per convergere allo
stesso percorso.

## 3. Analisi combinatoria (ordine di grandezza)

Stima conservativa **per un solo ciclo**, dopo il filtro-cliente in una stagione:
≈10 colazioni × 12 pranzi × 14 cene ≈ **1.680** combinazioni-giornata. Ogni menu ha ~4 ricette; per i
2 giorni si scelgono 2 ricette ordinate = 4·3 = 12 per pasto → 12³ ≈ **1.728** varianti di cottura.

```
piani per singolo ciclo ≈ 1.680 × 1.728 ≈ 2,9 milioni
traiettoria stagionale (~45 cicli) ≈ (2,9·10^6)^45  →  ~10^295
```

Con 4 stagioni, n° pasti, e le permutazioni di esclusioni, lo spazio supera di **centinaia di ordini
di grandezza** il numero di esseri umani mai esistiti. **Conclusione pratica: la probabilità che due
diete-traiettoria coincidano è nulla.**

## 4. "Praticamente impossibile" ≠ "certificabile"

Un numero enorme rende l'unicità *estremamente probabile*, non *garantita*. Per **certificare** servono
proprietà dimostrabili, non statistiche:

- **Riproducibilità**: dato lo stato, l'output è deterministico e ricalcolabile.
- **Unicità per costruzione**: un vincolo che *impedisce* attivamente due piani identici, non solo li
  rende improbabili.
- **Verificabilità**: un terzo (auditor, nutrizionista capo, ente) può *provare* a posteriori che una
  dieta è derivata dai fattori di quel cliente e che differisce da ogni altra.

Senza questi, potremmo solo *affermare* l'unicità; con questi possiamo **certificarla**.

## 5. I 3 meccanismi che la rendono GARANTITA

**① Seme personale + traiettoria stateful (identità del percorso).**
Ogni cliente riceve un **seed crittografico unico** alla creazione. Ogni scelta pseudo-casuale del
motore usa `PRNG(seed_u, S(u,t))`, e lo stato è un **log append-only** (event sourcing) della sua
storia. Effetto: la traiettoria è una **funzione deterministica di un'identità unica + storia unica** →
riproducibile e impossibile da replicare per un altro cliente (seed diverso, storia diversa).

**② Vincolo di unicità + collision check (unicità per costruzione).**
Per ogni piano di ciclo si calcola una **firma** `H = hash(u, menus, ricette, stato, Θ_version)`. Prima
di erogare, il motore verifica in un **indice globale delle firme attive** che non esista lo stesso
piano su un altro cliente nello stesso periodo; in caso di collisione **ri-genera** (cambia
ricetta/variante). Effetto: due diete identiche diventano **impossibili by design**, non solo rare.

**③ Registro firmato + certificato di personalizzazione (verificabilità/audit).**
Ogni ciclo viene **firmato e registrato in modo immutabile** (hash-chain/append-only, timestamp) con i
**fattori che l'hanno prodotto** (esclusioni, valutazioni, esiti, stato agente, versione config). Da
qui si emette, per cliente, un **certificato di personalizzazione** verificabile: un auditor può
**riprodurre** i piani dallo stato e provare che (a) derivano dai dati *di quel* cliente e (b)
differiscono da chiunque altro (firme distinte). Effetto: personalizzazione e unicità **dimostrabili**,
non dichiarate.

> Con ①+②+③ possiamo dichiarare, in modo difendibile: *"ogni dieta è personalizzata (derivata dai
> fattori del singolo cliente) e non esistono due diete uguali (garantito per costruzione e
> verificabile)."*

## 6. Cosa manca per potenziarlo ancora

- **Modello nutrizionale completo**: oggi le kcal servono solo al bilanciamento. Aggiungere **macro**
  (proteine/carbo/grassi), **fibra**, **micronutrienti**, adeguatezza proteica → ottimizzazione
  multi-obiettivo (peso + nutrizione + aderenza + varietà + costo/tempo) con vincoli.
- **Layer di regole cliniche**: interazioni **farmaco-alimento** (es. anticoagulanti/vitamina K),
  patologie (diabete, ipertensione, tiroide) → hard-constraint validati dal nutrizionista.
- **Spiegabilità (XAI)**: "perché questo menu" per cliente/coach/nutrizionista → fiducia e audit.
- **Apprendimento robusto**: bandit contextual / RL **off-policy con guardrail di sicurezza**,
  **cold-start** con priori di popolazione, esplorazione controllata, **drift detection**.
- **Feedback più ricco**: foto del piatto (ha davvero mangiato?), aderenza di porzione, avanzi,
  gradimento implicito (skip, sostituzioni), passi/sonno/attività, meteo, budget, tempo di cottura.
- **Attribuzione causale forte**: dal "naive per giornata" a **inferenza causale** (A/B tra cicli che
  cambiano un solo pasto, controllo dei confondenti) per isolare l'effetto del singolo menu.
- **Sicurezza & fairness**: monitoraggio di bias, robustezza, limiti di ritmo (guardrail sostenibilità),
  audit continuo.
- **Privacy/GDPR by design**: pseudonimizzazione, minimizzazione, possibile calcolo on-device.

## 7. Conclusione

Tecnicamente il motore è un **sistema stateful a politica adattiva su cicli di 2 giorni**, con uno
spazio di traiettorie di fatto illimitato: l'unicità è già *praticamente certa*. Con i **3 meccanismi**
(seme+traiettoria, vincolo di unicità, registro firmato) diventa **certificabile e garantita**. I
potenziamenti nutrizionali, clinici e di apprendimento la portano da "personalizzata e unica" a
"personalizzata, unica **e clinicamente ottimale**".
